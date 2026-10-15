import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button, LoadingBlock } from '../components/common';
import { useAuth } from '../hooks/useAuth';
import { homePathForRole } from './roleRouting';

export function RequireAuth() {
  const { loading, session, profile, authError, refreshProfile, logout } = useAuth();
  const [logoutError, setLogoutError] = useState('');
  const location = useLocation();

  if (loading) {
    return <LoadingBlock label="Restoring your session…" />;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!profile) {
    async function handleLogout() {
      try {
        await logout();
      } catch (error) {
        setLogoutError(
          error instanceof Error
            ? `Could not sign out: ${error.message}`
            : 'Could not sign out. Please try again.',
        );
      }
    }

    return (
      <div className="auth-restore-error" role="alert">
        <p>{authError || 'Your account profile could not be loaded.'}</p>
        {logoutError && <p>{logoutError}</p>}
        <Button variant="secondary" onClick={refreshProfile}>Retry</Button>
        <Button variant="ghost" onClick={handleLogout}>Sign out</Button>
      </div>
    );
  }

  return <Outlet />;
}

export function RequireAdmin() {
  const { profile } = useAuth();
  return profile?.user_type === 'admin'
    ? <Outlet />
    : <Navigate to={homePathForRole(profile?.user_type)} replace />;
}

export function RequirePlayer() {
  const { profile } = useAuth();

  if (profile?.user_type === 'player') return <Outlet />;
  if (profile?.user_type === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/login" replace />;
}

export function RoleHomeRedirect() {
  const { loading, session, profile } = useAuth();

  if (loading) return <LoadingBlock label="Restoring your session…" />;
  if (!session) return <Navigate to="/login" replace />;

  return <Navigate to={homePathForRole(profile?.user_type)} replace />;
}
