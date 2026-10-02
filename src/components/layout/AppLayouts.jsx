import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  CircleHelp,
  Gamepad2,
  LayoutDashboard,
  Menu,
  Swords,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
import { adminNav, player } from '../../data/mockData'

const playerNavigation = [
  ['Dashboard', '/dashboard', LayoutDashboard],
  ['Games', '/games', Gamepad2],
  ['My matches', '/match/NX-2841', Swords],
  ['Wallet', '/wallet', Wallet],
  ['Support', '/support', CircleHelp],
]

function Brand({ isAdmin = false }) {
  const destination = isAdmin ? '/admin/summary' : '/dashboard'

  return (
    <Link to={destination} className="brand">
      <span className="brand-mark"><Zap size={18} fill="currentColor" /></span>
      <span>play<span>nexa</span></span>
      {isAdmin && <small>ADMIN</small>}
    </Link>
  )
}

function PlayerSidebar({ closeMenu, profile }) {
  const playerName = profile?.full_name || player.name
  const initials = playerName
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <aside className="sidebar">
      <Brand />
      <small className="nav-label">PLAYER MENU</small>
      <nav aria-label="Player menu">
        {playerNavigation.map(([label, path, Icon]) => (
          <NavLink
            key={label}
            to={path}
            onClick={closeMenu}
            className={({ isActive }) => 'nav-link ' + (isActive ? 'active' : '')}
          >
            <Icon size={17} />
            <span>{label}</span>
            {label === 'My matches' && <i>2</i>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="support-mini">
          <span><CircleHelp size={17} /></span>
          <strong>Need help?</strong>
          <small>Our team is here for you.</small>
          <Link to="/support">Contact support →</Link>
        </div>
        <div className="profile-chip">
          <span className="profile-avatar">{initials}</span>
          <span>
            <strong>{playerName}</strong>
            <small>{profile?.phone || player.phone}</small>
          </span>
          <ChevronDown size={15} />
        </div>
      </div>
    </aside>
  )
}

function AdminIcon({ label }) {
  const icons = {
    Deposits: Wallet,
    Payouts: Wallet,
    Settlements: Swords,
    Games: Gamepad2,
    Payments: Wallet,
    Users,
    Support: CircleHelp,
    Summary: LayoutDashboard,
  }
  const Icon = icons[label] || LayoutDashboard

  return <Icon size={17} />
}

function AdminSidebar({ closeMenu }) {
  return (
    <aside className="sidebar admin-sidebar">
      <Brand isAdmin />
      <small className="nav-label">OPERATIONS</small>
      <nav aria-label="Admin menu">
        {adminNav.map(([label, path]) => (
          <NavLink
            key={path}
            to={path}
            onClick={closeMenu}
            end={path === '/admin/summary'}
            className={({ isActive }) => 'nav-link ' + (isActive ? 'active' : '')}
          >
            <AdminIcon label={label} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="admin-session">
          <span className="admin-session-dot" />
          <span>
            <strong>Admin session</strong>
            <small>Administrator access</small>
          </span>
        </div>
        <Link className="back-player" to="/dashboard">← Player view</Link>
      </div>
    </aside>
  )
}

function Topbar({ title, onMenu, isMenuOpen, isAdmin, profile, onLogout }) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const accountName = profile?.full_name || (isAdmin ? 'Admin' : player.name)
  const initials = accountName
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    if (!isNotificationsOpen) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsNotificationsOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isNotificationsOpen])

  return (
    <header className="topbar">
      <button
        className="mobile-menu icon-btn"
        onClick={onMenu}
        aria-label={isMenuOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={isMenuOpen}
      >
        <Menu size={19} />
      </button>

      <div className="breadcrumb">
        <span>{isAdmin ? 'Administration' : 'Play Nexa'}</span>
        <b>/</b>
        <strong>{title}</strong>
      </div>

      <div className="top-actions">
        <div className="notification-wrap">
          <button
            className="icon-btn notification"
            aria-label="Notifications"
            aria-expanded={isNotificationsOpen}
            aria-controls="notification-list"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
          >
            <Bell size={17} />
            <i />
          </button>
          {isNotificationsOpen && (
            <div
              id="notification-list"
              className="notification-popover"
              role="region"
              aria-label="Recent notifications"
            >
              <strong>Notifications</strong>
              <p><span /> Deposit confirmed · ₹500 added to your wallet</p>
              <p><span /> Match NX-2841 is ready for review</p>
              <button onClick={() => setIsNotificationsOpen(false)}>Close</button>
            </div>
          )}
        </div>
        <span className="top-divider" />
        <span className="top-user">{initials}</span>
        <span className="top-user-name">{accountName}</span>
        <ChevronDown size={14} />
        <button type="button" className="text-link" onClick={onLogout}>Sign out</button>
      </div>
    </header>
  )
}

function useMobileMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    if (!isMenuOpen) return undefined

    const previousFocus = document.activeElement
    document.querySelector('.sidebar-wrap.open a')?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus?.()
    }
  }, [isMenuOpen])

  return [isMenuOpen, setIsMenuOpen]
}

function MobileSidebar({ isMenuOpen, closeMenu, isAdmin, profile }) {
  return (
    <>
      <button
        aria-label="Close navigation overlay"
        aria-hidden={!isMenuOpen}
        tabIndex={isMenuOpen ? 0 : -1}
        className={'mobile-scrim ' + (isMenuOpen ? 'visible' : '')}
        onClick={closeMenu}
      />
      <div className={'sidebar-wrap ' + (isMenuOpen ? 'open' : '')}>
        {isAdmin
          ? <AdminSidebar closeMenu={closeMenu} />
          : <PlayerSidebar closeMenu={closeMenu} profile={profile} />}
        <button className="mobile-close" aria-label="Close navigation" onClick={closeMenu}>
          <X size={18} />
        </button>
      </div>
    </>
  )
}

export function PlayerLayout({ children, title, profile, onLogout }) {
  const [isMenuOpen, setIsMenuOpen] = useMobileMenu()

  return (
    <div className="app-shell">
      <MobileSidebar
        isMenuOpen={isMenuOpen}
        closeMenu={() => setIsMenuOpen(false)}
        profile={profile}
      />
      <div className="main-area" inert={isMenuOpen}>
        <Topbar
          title={title}
          onMenu={() => setIsMenuOpen(true)}
          isMenuOpen={isMenuOpen}
          profile={profile}
          onLogout={onLogout}
        />
        <main className="page-content">
          {children}
          <footer className="footer">
            <span>© 2026 Play Nexa</span>
            <span>Play fair. Play smart.</span>
            <Link to="/support">Help center</Link>
          </footer>
        </main>
        <nav aria-label="Player navigation" className="bottom-nav">
          {playerNavigation.filter((_, index) => index !== 2).map(([label, path, Icon]) => (
            <NavLink
              key={label}
              to={path}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <Icon size={18} />
              <small>{label === 'Dashboard' ? 'Home' : label}</small>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

export function AdminLayout({ children, title, profile, onLogout }) {
  const [isMenuOpen, setIsMenuOpen] = useMobileMenu()

  return (
    <div className="app-shell admin-shell">
      <MobileSidebar
        isMenuOpen={isMenuOpen}
        closeMenu={() => setIsMenuOpen(false)}
        isAdmin
      />
      <div className="main-area" inert={isMenuOpen}>
        <Topbar
          title={title}
          onMenu={() => setIsMenuOpen(true)}
          isMenuOpen={isMenuOpen}
          isAdmin
          profile={profile}
          onLogout={onLogout}
        />
        <main className="page-content">
          {children}
          <footer className="footer">
            <span>Play Nexa Admin · Internal operations</span>
            <Link to="/dashboard">Return to player app</Link>
          </footer>
        </main>
        <nav aria-label="Admin navigation" className="bottom-nav admin-bottom-nav">
          {adminNav.map(([label, path]) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <AdminIcon label={label} />
              <small>{label}</small>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
