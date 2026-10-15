import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizeAuthenticatedUser } from '../src/services/authRole.js'

describe('authenticated user role normalization', () => {
  it('uses the canonical role returned by the server', () => {
    const user = { id: 'admin-1', role: 'admin' }
    assert.equal(normalizeAuthenticatedUser(user), user)
  })

  it('accepts the legacy server field without guessing a missing role', () => {
    const user = normalizeAuthenticatedUser({ id: 'admin-1', user_type: 'admin' })
    assert.equal(user.role, 'admin')
  })

  it('rejects missing or unsupported roles', () => {
    assert.throws(
      () => normalizeAuthenticatedUser({ id: 'user-1' }),
      /invalid account role/,
    )
    assert.throws(
      () => normalizeAuthenticatedUser({ id: 'user-1', role: 'ADMIN' }),
      /invalid account role/,
    )
  })
})
