export const transactions = [
  { id: 'TX-1048', title: 'Match winnings · Chess', date: 'Today, 11:42 AM', amount: 194, kind: 'credit', status: 'Completed' },
  { id: 'TX-1044', title: 'Match entry · Ludo', date: 'Today, 10:18 AM', amount: -50, kind: 'debit', status: 'Completed' },
  { id: 'TX-1030', title: 'Wallet top-up', date: 'Yesterday, 5:06 PM', amount: 500, kind: 'credit', status: 'Completed' },
  { id: 'TX-1022', title: 'Withdrawal request', date: 'Yesterday, 2:15 PM', amount: -1000, kind: 'debit', status: 'Processing' },
]

export const deposits = [
  { id: 'DP-10582', user_id: 'PL-8992', amount: 1000, status: 'PENDING', proof_path: null, created_at: '2026-10-02T11:28:00+05:30', payment_method: { display_name: 'UPI · GPay', provider: 'manual_upi' }, user: { full_name: 'Vikram Patel', phone: '+91 98201 55210' } },
  { id: 'DP-10580', user_id: 'PL-8950', amount: 500, status: 'PENDING', proof_path: null, created_at: '2026-10-02T10:54:00+05:30', payment_method: { display_name: 'UPI · PhonePe', provider: 'manual_upi' }, user: { full_name: 'Meera Nair', phone: '+91 98470 33218' } },
  { id: 'DP-10573', user_id: 'PL-9018', amount: 2000, status: 'APPROVED', proof_path: null, created_at: '2026-10-02T09:16:00+05:30', payment_method: { display_name: 'UPI · Paytm', provider: 'manual_upi' }, user: { full_name: 'Priya Sharma', phone: '+91 98990 66124' } },
  { id: 'DP-10564', user_id: 'PL-9018', amount: 500, status: 'REJECTED', proof_path: null, created_at: '2026-10-01T20:40:00+05:30', payment_method: { display_name: 'UPI · GPay', provider: 'manual_upi' }, user: { full_name: 'Priya Sharma', phone: '+91 98990 66124' } },
]

export const payouts = [
  { id: 'PO-2098', amount: 2500, payout_upi_id: 'rohan.k@okaxis', status: 'INITIATED', created_at: '2026-10-02T10:12:00+05:30', wallet: { user: { id: 'PL-8800', full_name: 'Rohan Kapoor', phone: '+91 98100 12234' } } },
  { id: 'PO-2093', amount: 1000, payout_upi_id: 'priya.s@okicici', status: 'PROCESSING', created_at: '2026-10-02T09:35:00+05:30', wallet: { user: { id: 'PL-9018', full_name: 'Priya Sharma', phone: '+91 98990 66124' } } },
  { id: 'PO-2080', amount: 5000, payout_upi_id: 'kabir@oksbi', status: 'SUCCESS', created_at: '2026-10-01T19:02:00+05:30', wallet: { user: { id: 'PL-8890', full_name: 'Kabir Singh', phone: '+91 98710 77312' } } },
]
