import { getSupabaseClient } from '../lib/supabase'

const supportTicketFields = `
  id,
  user_id,
  subject,
  category,
  description,
  status,
  resolution,
  image_path,
  created_at,
  updated_at
`

async function requireUser(client) {
  const { data: { user }, error } = await client.auth.getUser()
  if (error) throw error
  if (!user) throw new Error('Sign in to access support tickets.')
  return user
}

async function includeSignedImage(client, ticket) {
  if (!ticket.image_path) return { ...ticket, image_url: null }

  const { data, error } = await client.storage
    .from('support_images')
    .createSignedUrl(ticket.image_path, 600)

  if (error) throw error
  return { ...ticket, image_url: data.signedUrl }
}

export async function getMySupportTickets() {
  const client = getSupabaseClient()
  const user = await requireUser(client)
  const { data, error } = await client
    .from('support_tickets')
    .select(supportTicketFields)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return Promise.all(data.map(ticket => includeSignedImage(client, ticket)))
}

export async function createSupportTicket({ subject, category, description, imageFile }) {
  const client = getSupabaseClient()
  const user = await requireUser(client)
  const ticketId = crypto.randomUUID()
  let imagePath = null

  if (imageFile && imageFile.size > 0) {
    const extensionByType = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    }
    const extension = extensionByType[imageFile.type]
    if (!extension) throw new Error('Support image must be a JPEG, PNG, or WebP image.')
    if (imageFile.size > 10 * 1024 * 1024) {
      throw new Error('Support image must be smaller than 10 MB.')
    }

    imagePath = `${user.id}/${ticketId}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await client.storage
      .from('support_images')
      .upload(imagePath, imageFile, { contentType: imageFile.type, upsert: false })
    if (uploadError) throw uploadError
  }

  try {
    const { data: createdId, error } = await client.rpc('create_support_ticket', {
      p_ticket_id: ticketId,
      p_subject: subject,
      p_category: category,
      p_description: description,
      p_image_path: imagePath,
    })
    if (error) throw error
    return createdId
  } catch (error) {
    if (imagePath) {
      const { error: cleanupError } = await client.storage
        .from('support_images')
        .remove([imagePath])
      if (cleanupError) {
        throw new Error(
          `Ticket creation failed and the uploaded image could not be removed: ${cleanupError.message}`,
          { cause: error },
        )
      }
    }
    throw error
  }
}

export async function getAdminSupportTickets() {
  const client = getSupabaseClient()
  await requireUser(client)
  const { data, error } = await client
    .from('support_tickets')
    .select(`${supportTicketFields}, user:users!support_tickets_user_id_fkey(full_name, phone)`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return Promise.all(data.map(ticket => includeSignedImage(client, ticket)))
}

export async function updateSupportTicket({ ticketId, status, resolution }) {
  const client = getSupabaseClient()
  await requireUser(client)
  const { data, error } = await client.rpc('update_support_ticket', {
    p_ticket_id: ticketId,
    p_status: status,
    p_resolution: resolution,
  })

  if (error) throw error
  return data
}
