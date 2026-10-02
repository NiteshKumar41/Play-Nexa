import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthContext } from './auth-context'
import { getSession, onAuthStateChange, signIn, signOut, signUp, verifyPhoneOtp } from '../services/authService'
import { getUserProfile } from '../services/userService'

function getProfileAccessError(profile) {
  if (profile.is_blocked) {
    return 'This account has been blocked. Contact support for help.'
  }
  if (!profile.active) {
    return 'This account is inactive. Contact support for help.'
  }
  return null
}

function errorMessage(error) {
  return error instanceof Error ? error.message : 'An unexpected authentication error occurred.'
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [profileRevision, setProfileRevision] = useState(0)
  const sessionRef = useRef(null)
  const authEventRevision = useRef(0)

  useEffect(() => {
    let mounted = true
    let subscription

    try {
      const authState = onAuthStateChange((event, nextSession) => {
        authEventRevision.current += 1
        const previousUserId = sessionRef.current?.user?.id
        const nextUserId = nextSession?.user?.id
        sessionRef.current = nextSession
        setSession(nextSession)

        if (!nextSession) {
          setProfile(null)
          setLoading(false)
          return
        }

        if (previousUserId !== nextUserId) {
          setProfile(null)
          setLoading(true)
        }
        if (event === 'SIGNED_IN') setAuthError('')
      })
      subscription = authState.data.subscription

      const initialRevision = authEventRevision.current
      getSession()
        .then(({ data, error }) => {
          if (error) throw error
          if (!mounted || authEventRevision.current !== initialRevision) return

          sessionRef.current = data.session
          setSession(data.session)
          if (!data.session) setLoading(false)
        })
        .catch(error => {
          if (!mounted) return
          setAuthError(errorMessage(error))
          setLoading(false)
        })
    } catch (error) {
      queueMicrotask(() => {
        if (!mounted) return
        setAuthError(errorMessage(error))
        setLoading(false)
      })
    }

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return undefined

    let current = true
    getUserProfile(userId)
      .then(async nextProfile => {
        if (!current) return
        const accessError = getProfileAccessError(nextProfile)
        if (accessError) {
          setAuthError(accessError)
          try {
            await signOut()
          } catch (error) {
            if (current) setAuthError(`${accessError} Sign-out failed: ${errorMessage(error)}`)
          }
          return
        }

        setProfile(nextProfile)
        setAuthError('')
      })
      .catch(error => {
        if (current) setAuthError(`Could not load your account profile: ${errorMessage(error)}`)
      })
      .finally(() => {
        if (current) setLoading(false)
      })

    return () => {
      current = false
    }
  }, [session?.user?.id, profileRevision])

  const refreshProfile = useCallback(() => {
    setLoading(true)
    setProfileRevision(revision => revision + 1)
  }, [])

  const login = useCallback(credentials => signIn(credentials), [])
  const signup = useCallback(details => signUp(details), [])
  const verifyPhone = useCallback(details => verifyPhoneOtp(details), [])
  const logout = useCallback(() => signOut(), [])

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      loading,
      authError,
      login,
      signup,
      verifyPhone,
      logout,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
