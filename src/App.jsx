import { useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { Toast } from './components/common';
import { AdminLayout, PlayerLayout } from './components/layout/AppLayouts';
import { AuthProvider } from './contexts/AuthContext';
import { titleFor } from './data/mockData';
import { useAuth } from './hooks/useAuth';
import { AdminPage } from './pages/admin/AdminPages';
import { AuthPage } from './pages/auth/AuthPage';
import {
  Dashboard,
  GamesPage,
  Lobby,
  MatchPage,
  SupportPage,
  WalletPage,
} from './pages/player/PlayerPages';
import { RequireAdmin, RequireAuth } from './routes/ProtectedRoutes';
import { ROUTES } from './constants/routes';
import './App.css';

function PlayerPage({ title, children, profile, onLogout }) {
  return (
    <PlayerLayout title={title} profile={profile} onLogout={onLogout}>
      {children}
    </PlayerLayout>
  );
}

function AdminPageLayout({ title, section, notify, profile, onLogout }) {
  return (
    <AdminLayout title={title} profile={profile} onLogout={onLogout}>
      <AdminPage section={section} notify={notify} />
    </AdminLayout>
  );
}

function AppContent() {
  const [toastMessage, setToastMessage] = useState('');
  const location = useLocation();
  const { profile, logout } = useAuth();

  function notify(message) {
    setToastMessage(message);
    window.clearTimeout(window.__playNexaToast);
    window.__playNexaToast = window.setTimeout(() => setToastMessage(''), 3200);
  }

  async function handleLogout() {
    try {
      await logout();
      notify('You have been signed out.');
    } catch (error) {
      notify(
        error instanceof Error
          ? `Could not sign out: ${error.message}`
          : 'Could not sign out. Please try again.',
      );
    }
  }

  const adminMatch = location.pathname.match(
    /^\/admin(?:\/(summary|deposits|payouts|settlements|games|payments|users|support))?\/?$/,
  );
  const adminSection = adminMatch?.[1] || 'summary';
  const adminTitle = titleFor[`${ROUTES.admin}/${adminSection}`] || 'Summary';

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to={ROUTES.dashboard} replace />} />
        <Route path={ROUTES.login} element={<AuthPage mode="login" onSuccess={notify} />} />
        <Route path={ROUTES.signup} element={<AuthPage mode="signup" onSuccess={notify} />} />
        <Route
          path={ROUTES.forgotPassword}
          element={<AuthPage mode="forgot-password" onSuccess={notify} />}
        />

        <Route element={<RequireAuth />}>
          <Route
            path={ROUTES.dashboard}
            element={(
              <PlayerPage title="Dashboard" profile={profile} onLogout={handleLogout}>
                <Dashboard />
              </PlayerPage>
            )}
          />
          <Route
            path={ROUTES.games}
            element={(
              <PlayerPage title="Games" profile={profile} onLogout={handleLogout}>
                <GamesPage />
              </PlayerPage>
            )}
          />
          <Route
            path={`${ROUTES.games}/:gameId`}
            element={(
              <PlayerPage title="Game lobby" profile={profile} onLogout={handleLogout}>
                <Lobby key={location.pathname} notify={notify} />
              </PlayerPage>
            )}
          />
          <Route path={`${ROUTES.matches}/`} element={<Navigate to={ROUTES.defaultMatch} replace />} />
          <Route
            path={`${ROUTES.matches}/:id`}
            element={(
              <PlayerPage title="Match details" profile={profile} onLogout={handleLogout}>
                <MatchPage notify={notify} />
              </PlayerPage>
            )}
          />
          <Route
            path={ROUTES.wallet}
            element={(
              <PlayerPage title="Wallet" profile={profile} onLogout={handleLogout}>
                <WalletPage notify={notify} />
              </PlayerPage>
            )}
          />
          <Route
            path={ROUTES.support}
            element={(
              <PlayerPage title="Support" profile={profile} onLogout={handleLogout}>
                <SupportPage notify={notify} />
              </PlayerPage>
            )}
          />

          <Route element={<RequireAdmin />}>
            <Route
              path={ROUTES.admin}
              element={(
                <AdminPageLayout
                  title={adminTitle}
                  section="summary"
                  notify={notify}
                  profile={profile}
                  onLogout={handleLogout}
                />
              )}
            />
            <Route
              path={`${ROUTES.admin}/:section`}
              element={(
                <AdminPageLayout
                  title={adminTitle}
                  section={adminSection}
                  notify={notify}
                  profile={profile}
                  onLogout={handleLogout}
                />
              )}
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
      </Routes>
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
