export function isAdminPath(pathname = '') {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

export function homePathForRole(role) {
  if (role === 'admin') return '/admin'
  if (role === 'player') return '/dashboard'
  return '/login'
}

export function postAuthPath(role, from) {
  const homePath = homePathForRole(role)
  const pathname = from?.pathname

  if (!pathname || pathname === '/' || pathname === '/login' || pathname === '/signup') {
    return homePath
  }

  if ((role === 'admin') !== isAdminPath(pathname)) return homePath

  return `${pathname}${from.search || ''}${from.hash || ''}`
}
