import { useCallback, useEffect, useState } from 'react'
import { AuthContext } from './auth-context'
import { AUTH_EXPIRED_EVENT } from '../services/apiClient'
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  signup as signupRequest,
} from '../services/authService'
import { clearAuthToken, getAuthToken } from '../services/tokenStorage'
import { connect as connectSocket, disconnect as disconnectSocket } from '../services/socketService'

function createProfile(user) {
  if (!user) return null

  return {
    id: user.id,
    full_name: user.fullName,
    phone: user.phone,
    email: user.email || '',
    dob: user.dob || '',
    gender: user.gender || '',
    upi_id: user.upiId || '',
    user_type: user.role,
    active: true,
    is_blocked: false,
  }
}

function createSession(user, token) {
  if (!token) return null

  return {
    access_token: token,
    user: user
      ? {
          id: user.id,
          phone: user.phone,
          role: user.role,
          user_metadata: { full_name: user.fullName },
        }
      : null,
  }
}

export function AuthProvider({ children }) {
  const [initialToken] = useState(() => getAuthToken())
  const [token, setToken] = useState(initialToken)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(initialToken))
  const [authError, setAuthError] = useState('')

  const profile = createProfile(user)
  const session = createSession(user, token)
  const isAuthenticated = Boolean(user && token)

  useEffect(() => {
    let isMounted = true

    function handleExpiredSession() {
      disconnectSocket()
      setToken(null)
      setUser(null)
      setAuthError('Your session has expired. Please sign in again.')
      setLoading(false)
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession)

    if (!initialToken) {
      return () => {
        isMounted = false
        window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession)
      }
    }

    getCurrentUser()
      .then(currentUser => {
        if (!isMounted) return
        setUser(currentUser)
        setAuthError('')
      })
      .catch(error => {
        if (!isMounted) return

        if (error.status === 403) {
          clearAuthToken()
          setToken(null)
          setUser(null)
        }

        setAuthError(
          error instanceof Error
            ? error.message
            : 'Could not restore your account. Please try again.',
        )
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession)
    }
  }, [initialToken])

  useEffect(() => {
    if (token) connectSocket(token)
    else disconnectSocket()
  }, [token])

  useEffect(() => () => disconnectSocket(), [])

  const login = useCallback(async credentials => {
    const result = await loginRequest(credentials)
    setToken(result.token)
    setUser(result.token ? result.user : null)
    setAuthError('')
    return result
  }, [])

  const signup = useCallback(async details => {
    const result = await signupRequest(details)
    setToken(result.token)
    setUser(result.token ? result.user : null)
    setAuthError('')
    return result
  }, [])

  const logout = useCallback(async () => {
    await logoutRequest()
    disconnectSocket()
    setToken(null)
    setUser(null)
    setAuthError('')
  }, [])

  const refreshUser = useCallback(async () => {
    if (!getAuthToken()) {
      setToken(null)
      setUser(null)
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      setAuthError('')
    } catch (error) {
      if (error.status === 403) {
        clearAuthToken()
        setToken(null)
        setUser(null)
      }
      setAuthError(error instanceof Error ? error.message : 'Could not load your account.')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      token,
      session,
      isAuthenticated,
      loading,
      authError,
      login,
      signup,
      logout,
      refreshUser,
      refreshProfile: refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
