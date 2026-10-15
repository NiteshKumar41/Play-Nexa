const VALID_ROLES = new Set(['admin', 'player'])

// Some older backend responses used user_type/userType. Accept those names
// only when they are supplied by the authenticated server response; never
// infer a role when the response is missing it.
export function normalizeAuthenticatedUser(user) {
  if (!user || typeof user !== 'object') {
    throw new Error('The server returned an invalid authentication response.')
  }

  const role = user.role ?? user.user_type ?? user.userType
  if (!VALID_ROLES.has(role)) {
    throw new Error('The server returned an invalid account role.')
  }

  return user.role === role ? user : { ...user, role }
}
