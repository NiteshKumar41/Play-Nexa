export const adminNav = [
  ['Summary', '/admin/summary'], ['Deposits', '/admin/deposits'], ['Payouts', '/admin/payouts'],
  ['Settlements', '/admin/settlements'], ['Games', '/admin/games'], ['Payments', '/admin/payments'],
  ['Users', '/admin/users'], ['Support', '/admin/support'],
]

export const titleFor = Object.fromEntries(adminNav.map(([name, path]) => [path, name]))

export const paymentMethods = [
  { id: 'PM-001', display_name: 'Primary UPI collection', provider: 'manual_upi', upi_id: 'playnexa@okaxis', payee_name: 'Play Nexa Technologies', qr_storage_path: null, qr_url: null, is_active: true },
  { id: 'PM-002', display_name: 'Backup UPI collection', provider: 'manual_upi', upi_id: 'payments@okicici', payee_name: 'Play Nexa Technologies', qr_storage_path: null, qr_url: null, is_active: false },
]
