import { getCurrentUserId } from './userService'
import { makeId, mockStore, now } from './mockStore'

function withUser(ticket) {
  const user = mockStore.users.find(item => item.id === ticket.user_id)
  return { ...ticket, user: user ? { full_name: user.full_name, phone: user.phone } : null }
}

export async function getMySupportTickets() {
  const userId = getCurrentUserId()
  return mockStore.supportTickets
    .filter(ticket => ticket.user_id === userId)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map(ticket => ({ ...ticket, image_url: ticket.image_url || null }))
}

export async function createSupportTicket({ subject, category, description, imageFile }) {
  const ticket = {
    id: makeId('TK'), user_id: getCurrentUserId(), subject: String(subject).trim(), category,
    description: String(description).trim(), status: 'OPEN', resolution: null, created_at: now(),
    image_url: typeof File !== 'undefined' && imageFile instanceof File ? URL.createObjectURL(imageFile) : null,
  }
  mockStore.supportTickets.unshift(ticket)
  return ticket.id
}

export async function getAdminSupportTickets() {
  return mockStore.supportTickets.map(withUser)
}

export async function updateSupportTicket({ ticketId, status, resolution }) {
  const ticket = mockStore.supportTickets.find(item => item.id === ticketId)
  if (!ticket) throw new Error('Support ticket could not be found.')
  ticket.status = status
  ticket.resolution = resolution || null
  ticket.updated_at = now()
  return ticket.id
}
