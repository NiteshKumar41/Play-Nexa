import { useCallback, useEffect, useRef, useState } from 'react'
import { ShieldCheck, UserCircle } from 'lucide-react'
import { Button, CopyButton, DataState, FormField, PageTitle, Panel } from '../../components/common'
import { useAuth } from '../../hooks/useAuth'
import { getProfile, updateProfile } from '../../services/profileService'
import { formatIndiaDateTime } from '../../utils/formatDate'

function dateInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function createForm(profile) {
  return {
    fullName: profile?.fullName || '',
    email: profile?.email || '',
    dob: dateInputValue(profile?.dob),
    gender: profile?.gender || '',
    upiId: profile?.upiId || '',
  }
}

export function ProfilePage() {
  const { refreshUser } = useAuth()
  const requestVersion = useRef(0)
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(createForm(null))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const displayProfile = profile || {
    phone: '',
    referralCode: '',
    hasReferrer: false,
    role: 'player',
    createdAt: null,
  }

  const loadProfile = useCallback(async () => {
    const version = ++requestVersion.current
    setLoading(true)
    setError('')
    try {
      const currentProfile = await getProfile()
      if (version !== requestVersion.current) return
      setProfile(currentProfile)
      setForm(createForm(currentProfile))
    } catch (loadError) {
      if (version === requestVersion.current) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load your profile.')
      }
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(loadProfile)
    return () => { requestVersion.current += 1 }
  }, [loadProfile])

  function updateField(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }))
    setFormError('')
    setSuccess('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setSuccess('')
    try {
      const updatedProfile = await updateProfile(form)
      setProfile(updatedProfile)
      setForm(createForm(updatedProfile))
      await refreshUser()
      setSuccess('Profile updated successfully.')
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Unable to update your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="ACCOUNT"
        title="Your profile"
        subtitle="Keep your account details current. Referral attribution and account access remain protected."
      />

      <DataState loading={loading} error={error} retry={loadProfile} empty={!profile}>
        <div className="content-grid">
          <Panel title="Profile details" subtitle="Only supported account fields can be edited.">
            <form className="form-stack" onSubmit={handleSubmit}>
              <FormField label="Full name">
                <input name="fullName" value={form.fullName} onChange={updateField} maxLength="120" required />
              </FormField>
              <FormField label="Phone number" hint="Your sign-in number cannot be changed here.">
                <input value={displayProfile.phone || ''} readOnly disabled />
              </FormField>
              <FormField label="Email address">
                <input name="email" type="email" value={form.email} onChange={updateField} maxLength="254" />
              </FormField>
              <div className="form-grid">
                <FormField label="Date of birth">
                  <input name="dob" type="date" value={form.dob} onChange={updateField} />
                </FormField>
                <FormField label="Gender">
                  <input name="gender" value={form.gender} onChange={updateField} maxLength="50" />
                </FormField>
              </div>
              <FormField label="UPI ID" hint="Used only where an existing wallet flow asks for it.">
                <input name="upiId" value={form.upiId} onChange={updateField} maxLength="200" placeholder="name@bank" />
              </FormField>
              {formError && <p className="auth-error" role="alert">{formError}</p>}
              {success && <p className="form-disclaimer" role="status">{success}</p>}
              <div className="button-row">
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
              </div>
            </form>
          </Panel>

          <div>
            <Panel title="Referral code" subtitle="Share your code with friends.">
              <div className="room-code">
                <div>
                  <small>YOUR CODE</small>
                  <strong>{displayProfile.referralCode || 'Unavailable'}</strong>
                </div>
                {displayProfile.referralCode && <CopyButton value={displayProfile.referralCode} />}
              </div>
              <p className="form-disclaimer">
                {displayProfile.hasReferrer
                  ? 'Your referral attribution is locked to the account used at registration.'
                  : 'Referral attribution is locked after registration.'}
              </p>
            </Panel>
            <Panel title="Account" subtitle="Security-sensitive fields are not editable here.">
              <div className="compact-row">
                <span className="profile-avatar"><UserCircle size={18} /></span>
                <div className="row-grow">
                  <strong>{displayProfile.role === 'admin' ? 'Administrator' : 'Player account'}</strong>
                  <small>Created {formatIndiaDateTime(displayProfile.createdAt)}</small>
                </div>
                <ShieldCheck size={18} color="#4ade80" aria-label="Protected account" />
              </div>
            </Panel>
          </div>
        </div>
      </DataState>
    </>
  )
}
