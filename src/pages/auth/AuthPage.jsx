import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button, FormField } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';

export function AuthPage({ mode, onSuccess }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup: register, authError } = useAuth();
  const isSignup = mode === 'signup';
  const isForgotPassword = mode === 'forgot-password';

  const [isSent, setIsSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [sentMessage, setSentMessage] = useState('');

  const pageTitle = isSignup
    ? 'Create your account'
    : isForgotPassword
      ? 'Reset your passcode'
      : 'Welcome back';

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSignup) {
      const formValues = new FormData(event.currentTarget);
      const passcode = formValues.get('passcode');
      const confirmedPasscode = formValues.get('confirmPasscode');

      if (passcode !== confirmedPasscode) {
        const confirmationField = event.currentTarget.elements.confirmPasscode;
        confirmationField.setCustomValidity('Passcodes do not match.');
        confirmationField.reportValidity();
        return;
      }
    }

    setFormError('');

    if (isForgotPassword) {
      setIsSent(true);
      setSentMessage('Passcode reset is not connected yet. Contact support to recover your account.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formValues = new FormData(event.currentTarget);

      if (isSignup) {
        const result = await register({
          phone: formValues.get('phone'),
          passcode: formValues.get('passcode'),
          fullName: formValues.get('fullName'),
          email: formValues.get('email'),
          upiId: formValues.get('upi'),
        });

        if (!result.session) {
          setIsSent(true);
          setSentMessage('Check your email for a confirmation link to finish creating your account.');
          return;
        }

        onSuccess?.('Your account is ready.');
      } else {
        await login({
          phone: formValues.get('phone'),
          passcode: formValues.get('passcode'),
        });
        onSuccess?.('Signed in successfully.');
      }

      const previousLocation = location.state?.from;
      const destination = previousLocation
        ? `${previousLocation.pathname || '/dashboard'}${previousLocation.search || ''}${previousLocation.hash || ''}`
        : '/dashboard';

      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Unable to authenticate. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function clearConfirmationError(event) {
    event.currentTarget.setCustomValidity('');
  }

  return (
    <div className="auth-layout">
      <Link to="/login" className="brand">
        <span className="brand-mark">✦</span>
        <span>play<span>nexa</span></span>
      </Link>

      <div className="auth-card">
        <div className="eyebrow">PLAY NEXA · SKILL GAMING</div>
        <h1>{pageTitle}</h1>
        <p>
          {isForgotPassword
            ? 'We’ll help you securely get back into your account.'
            : isSignup
              ? 'Join the community and put your skills to the test.'
              : 'Sign in securely with your phone number.'}
        </p>

        {(formError || (!isSent && !isSignup && !isForgotPassword && authError)) && (
          <p className="auth-error" role="alert">{formError || authError}</p>
        )}

        {isSent ? (
          <div className="notice">
            <ShieldCheck size={18} />
            <p>{sentMessage}</p>
          </div>
        ) : (
          <form className="form-stack" onSubmit={handleSubmit}>
            {isSignup && (
              <>
                <FormField label="Full name">
                  <input name="fullName" placeholder="e.g. Aarav Mehta" required />
                </FormField>
                <PhoneField />
              </>
            )}

            {isSignup ? (
              <FormField label="Email address (optional)">
                <input name="email" type="email" placeholder="you@example.com" />
              </FormField>
            ) : (
              <PhoneField />
            )}

            {isSignup && (
              <FormField label="UPI ID (optional)">
                <input name="upi" placeholder="name@bank" />
              </FormField>
            )}

            {!isForgotPassword && (
              <FormField label="6-digit passcode">
                <input
                  name="passcode"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength="6"
                  placeholder="••••••"
                  required
                />
              </FormField>
            )}

            {isSignup && (
              <FormField label="Confirm passcode">
                <input
                  name="confirmPasscode"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength="6"
                  placeholder="••••••"
                  required
                  onInput={clearConfirmationError}
                />
              </FormField>
            )}

            <Button type="submit" disabled={isSubmitting} className="auth-submit">
              {isSubmitting
                ? 'Please wait…'
                : isForgotPassword
                  ? 'Send reset instructions'
                  : isSignup
                    ? 'Create account'
                    : 'Sign in'}
              {' '}→
            </Button>
          </form>
        )}

        {!isSignup && !isForgotPassword && (
          <Link className="auth-help" to="/forgot-password">Forgot passcode?</Link>
        )}

        {!isForgotPassword && (
          <div className="auth-switch">
            {isSignup ? 'Already have an account?' : 'New to Play Nexa?'}{' '}
            <Link to={isSignup ? '/login' : '/signup'}>
              {isSignup ? 'Sign in' : 'Create account'}
            </Link>
          </div>
        )}

        {isForgotPassword && !isSent && (
          <div className="auth-switch">
            <Link to="/login">← Back to sign in</Link>
          </div>
        )}

        <small className="auth-safe">
          <ShieldCheck size={14} />{' '}
          {isForgotPassword
            ? 'Passcode recovery is not connected yet.'
            : 'Connected to the Play Nexa backend.'}
        </small>
      </div>

      <span className="auth-footer">© 2026 Play Nexa · Play fair. Play smart.</span>
    </div>
  );
}

function PhoneField() {
  return (
    <FormField label="Phone number">
      <div className="phone-input">
        <span>🇮🇳 +91</span>
        <input
          name="phone"
          type="tel"
          inputMode="numeric"
          pattern="[0-9]{10}"
          placeholder="98765 43210"
          required
        />
      </div>
    </FormField>
  );
}
