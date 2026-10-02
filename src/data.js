import { calculateMatchFinancials } from './finance'

export const player = { name: 'Aarav Mehta', phone: '+91 98765 43210', initials: 'AM', balance: 12450 }

export const games = [
  { id: 'chess', name: 'Chess', category: 'Strategy', players: 1248, entry: 50, symbol: '♟', theme: 'chess' },
  { id: 'ludo', name: 'Ludo', category: 'Board game', players: 856, entry: 100, symbol: '🎲', theme: 'ludo' },
  { id: 'pool', name: '8 Ball Pool', category: 'Sports', players: 642, entry: 50, symbol: '🎱', theme: 'pool' },
  { id: 'carrom', name: 'Carrom', category: 'Classic', players: 391, entry: 100, symbol: '◉', theme: 'carrom' },
]

export const matches = [
  { id: 'NX-2841', game: 'Chess', opponent: 'Priya Sharma', entry: 100, prizePool: calculateMatchFinancials(100, 100).grossPool, status: 'In progress', room: 'CH-7294' },
  { id: 'NX-2838', game: 'Ludo', opponent: 'Rohan Kapoor', entry: 50, prizePool: calculateMatchFinancials(50, 50).grossPool, status: 'Awaiting result', room: 'LU-1382' },
  { id: 'NX-2812', game: '8 Ball Pool', opponent: 'Ishita Rao', entry: 100, prizePool: calculateMatchFinancials(100, 100).grossPool, status: 'Completed', room: 'PB-5520' },
]

export const transactions = [
  { id: 'TX-1048', title: 'Match winnings · Chess', date: 'Today, 11:42 AM', amount: 194, kind: 'credit', status: 'Completed' },
  { id: 'TX-1044', title: 'Match entry · Ludo', date: 'Today, 10:18 AM', amount: -50, kind: 'debit', status: 'Completed' },
  { id: 'TX-1030', title: 'Wallet top-up', date: 'Yesterday, 5:06 PM', amount: 500, kind: 'credit', status: 'Completed' },
  { id: 'TX-1022', title: 'Withdrawal request', date: 'Yesterday, 2:15 PM', amount: -1000, kind: 'debit', status: 'Processing' },
]

export const lobbyMatches = [
  { id: 'NX-2852', game: 'Chess', creator: 'Neha Verma', entry: 50, pool: calculateMatchFinancials(50, 50).grossPool, status: 'Open' },
  { id: 'NX-2850', game: 'Chess', creator: 'Kabir Singh', entry: 100, pool: calculateMatchFinancials(100, 100).grossPool, status: 'Open' },
  { id: 'NX-2849', game: 'Chess', creator: 'Ananya Iyer', entry: 500, pool: calculateMatchFinancials(500, 500).grossPool, status: 'Open' },
  { id: 'NX-2847', game: 'Ludo', creator: 'Sana Khan', entry: 100, pool: calculateMatchFinancials(100, 100).grossPool, status: 'Open' },
  { id: 'NX-2846', game: '8 Ball Pool', creator: 'Dev Malhotra', entry: 50, pool: calculateMatchFinancials(50, 50).grossPool, status: 'Open' },
  { id: 'NX-2845', game: 'Carrom', creator: 'Aditi Bose', entry: 500, pool: calculateMatchFinancials(500, 500).grossPool, status: 'Open' },
]

export const tickets = [
  { id: 'TK-4038', subject: 'Result not updated', category: 'Match issue', date: 'Today, 10:32 AM', status: 'In Progress' },
  { id: 'TK-3991', subject: 'Withdrawal status', category: 'Payments', date: 'Yesterday, 4:10 PM', status: 'Open' },
  { id: 'TK-3844', subject: 'Update my UPI ID', category: 'Account', date: 'Sep 25, 2026', status: 'Resolved' },
]

export const adminNav = [
  ['Summary', '/admin/summary'], ['Deposits', '/admin/deposits'], ['Payouts', '/admin/payouts'],
  ['Settlements', '/admin/settlements'], ['Games', '/admin/games'], ['Payments', '/admin/payments'],
  ['Users', '/admin/users'], ['Support', '/admin/support'],
]
export const titleFor = Object.fromEntries(adminNav.map(([name,path]) => [path, name]))

export const deposits = [
  { id: 'DP-10582', user: 'Vikram Patel', phone: '+91 98201 55210', amount: 1000, method: 'UPI · GPay', date: 'Oct 02, 11:28 AM', status: 'Pending' },
  { id: 'DP-10580', user: 'Meera Nair', phone: '+91 98470 33218', amount: 500, method: 'UPI · PhonePe', date: 'Oct 02, 10:54 AM', status: 'Pending' },
  { id: 'DP-10573', user: 'Arjun Das', phone: '+91 98300 70814', amount: 2000, method: 'UPI · Paytm', date: 'Oct 02, 9:16 AM', status: 'Completed' },
  { id: 'DP-10564', user: 'Diya Shah', phone: '+91 98980 26140', amount: 500, method: 'UPI · GPay', date: 'Oct 01, 8:40 PM', status: 'Failed' },
]

export const payouts = [
  { id: 'PO-2098', user: 'Rohan Kapoor', phone: '+91 98100 12234', amount: 2500, upi: 'rohan.k@okaxis', date: 'Oct 02, 10:12 AM', status: 'Pending' },
  { id: 'PO-2093', user: 'Priya Sharma', phone: '+91 98990 66124', amount: 1000, upi: 'priya.s@okicici', date: 'Oct 02, 9:35 AM', status: 'Processing' },
  { id: 'PO-2080', user: 'Kabir Singh', phone: '+91 98710 77312', amount: 5000, upi: 'kabir@oksbi', date: 'Oct 01, 7:02 PM', status: 'Completed' },
]

export const users = [
  { id: 'PL-9021', name: 'Aarav Mehta', phone: '+91 98765 43210', joined: 'Sep 14, 2026', matches: 48, balance: 12450, status: 'Active', role: 'Player' },
  { id: 'PL-9018', name: 'Priya Sharma', phone: '+91 98990 66124', joined: 'Sep 12, 2026', matches: 32, balance: 8320, status: 'Active', role: 'Player' },
  { id: 'PL-8992', name: 'Vikram Patel', phone: '+91 98201 55210', joined: 'Sep 08, 2026', matches: 12, balance: 1500, status: 'Blocked', role: 'Player' },
  { id: 'PL-8950', name: 'Meera Nair', phone: '+91 98470 33218', joined: 'Aug 30, 2026', matches: 76, balance: 21100, status: 'Active', role: 'Moderator' },
]

export const formatINR = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
