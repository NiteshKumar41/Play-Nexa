import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { homePathForRole, isAdminPath, postAuthPath } from '../src/routes/roleRouting.js'

describe('role-based authentication routing', () => {
  it('uses the correct home route for each server-provided role', () => {
    assert.equal(homePathForRole('admin'), '/admin')
    assert.equal(homePathForRole('player'), '/dashboard')
    assert.equal(homePathForRole('unknown'), '/login')
  })

  it('preserves only role-compatible protected destinations', () => {
    assert.equal(isAdminPath('/admin/users'), true)
    assert.equal(isAdminPath('/dashboard'), false)
    assert.equal(postAuthPath('admin', { pathname: '/admin/users', search: '?page=2', hash: '#users' }), '/admin/users?page=2#users')
    assert.equal(postAuthPath('admin', { pathname: '/dashboard' }), '/admin')
    assert.equal(postAuthPath('player', { pathname: '/admin' }), '/dashboard')
    assert.equal(postAuthPath('player', { pathname: '/games/ludo' }), '/games/ludo')
  })
})
