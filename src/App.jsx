import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Bell, ChevronDown, CircleHelp, Gamepad2, LayoutDashboard, Menu, Swords, Users, Wallet, X, Zap } from 'lucide-react'
import { Button, LoadingBlock, Toast } from './components'
import { AdminPage } from './AdminPages'
import { AuthPage, Dashboard, GamesPage, Lobby, MatchPage, SupportPage, WalletPage } from './PlayerPages'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/useAuth'
import { adminNav, player, titleFor } from './data'
import './App.css'

const playerNav = [
  ['Dashboard','/dashboard',LayoutDashboard],['Games','/games',Gamepad2],['My matches','/match/NX-2841',Swords],['Wallet','/wallet',Wallet],['Support','/support',CircleHelp],
]
function Brand({admin=false}) { return <Link to={admin?'/admin/summary':'/dashboard'} className="brand"><span className="brand-mark"><Zap size={18} fill="currentColor"/></span><span>play<span>nexa</span></span>{admin&&<small>ADMIN</small>}</Link> }

function PlayerSidebar({close,profile}) {
  const name=profile?.full_name||player.name
  const initials=name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase()
  return <aside className="sidebar"><Brand/><small className="nav-label">PLAYER MENU</small><nav aria-label="Player menu">{playerNav.map(([label,path,Icon])=><NavLink key={label} to={path} onClick={close} className={({isActive})=>`nav-link ${isActive?'active':''}`}><Icon size={17}/><span>{label}</span>{label==='My matches'&&<i>2</i>}</NavLink>)}</nav><div className="sidebar-bottom"><div className="support-mini"><span><CircleHelp size={17}/></span><strong>Need help?</strong><small>Our team is here for you.</small><Link to="/support">Contact support →</Link></div><div className="profile-chip"><span className="profile-avatar">{initials}</span><span><strong>{name}</strong><small>{profile?.phone||player.phone}</small></span><ChevronDown size={15}/></div></div></aside>
}

function AdminSidebar({close}) {
  return <aside className="sidebar admin-sidebar"><Brand admin/><small className="nav-label">OPERATIONS</small><nav aria-label="Admin menu">{adminNav.map(([label,path])=><NavLink key={path} to={path} onClick={close} end={path==='/admin/summary'} className={({isActive})=>`nav-link ${isActive?'active':''}`}><AdminIcon label={label}/><span>{label}</span></NavLink>)}</nav><div className="sidebar-bottom"><div className="admin-session"><span className="admin-session-dot"/><span><strong>Admin session</strong><small>Administrator access</small></span></div><Link className="back-player" to="/dashboard">← Player view</Link></div></aside>
}
function AdminIcon({label}) { const Icon=({Deposits:Wallet,Payouts:Wallet,Settlements:Swords,Games:Gamepad2,Payments:Wallet,Users,Support:CircleHelp,Summary:LayoutDashboard})[label]||LayoutDashboard; return <Icon size={17}/> }

function Topbar({title,onMenu,menuOpen=false,admin=false,profile,onLogout}) {
  const [notificationsOpen,setNotificationsOpen]=useState(false)
  useEffect(()=>{if(!notificationsOpen)return;const onKey=event=>event.key==='Escape'&&setNotificationsOpen(false);document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[notificationsOpen])
  const name=profile?.full_name||(admin?'Admin':player.name)
  const initials=name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase()
  return <header className="topbar"><button className="mobile-menu icon-btn" onClick={onMenu} aria-label={menuOpen?'Close navigation':'Open navigation'} aria-expanded={menuOpen}><Menu size={19}/></button><div className="breadcrumb"><span>{admin?'Administration':'Play Nexa'}</span><b>/</b><strong>{title}</strong></div><div className="top-actions"><div className="notification-wrap"><button className="icon-btn notification" aria-label="Notifications" aria-expanded={notificationsOpen} aria-controls="notification-list" onClick={()=>setNotificationsOpen(!notificationsOpen)}><Bell size={17}/><i/></button>{notificationsOpen&&<div id="notification-list" className="notification-popover" role="region" aria-label="Recent notifications"><strong>Notifications</strong><p><span/> Deposit confirmed · ₹500 added to your wallet</p><p><span/> Match NX-2841 is ready for review</p><button onClick={()=>setNotificationsOpen(false)}>Close</button></div>}</div><span className="top-divider"/><span className="top-user">{initials}</span><span className="top-user-name">{name}</span><ChevronDown size={14}/><button type="button" className="text-link" onClick={onLogout}>Sign out</button></div></header>
}

function PlayerLayout({children,title,profile,onLogout}) {
  const [menu,setMenu]=useState(false)
  useEffect(()=>{if(!menu)return;const previous=document.activeElement;document.querySelector('.sidebar-wrap.open a')?.focus();const onKey=event=>event.key==='Escape'&&setMenu(false);document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);previous?.focus?.()}},[menu])
  return <div className="app-shell"><button aria-label="Close navigation overlay" aria-hidden={!menu} tabIndex={menu?0:-1} className={`mobile-scrim ${menu?'visible':''}`} onClick={()=>setMenu(false)}/><div className={`sidebar-wrap ${menu?'open':''}`}><PlayerSidebar close={()=>setMenu(false)} profile={profile}/><button className="mobile-close" aria-label="Close navigation" onClick={()=>setMenu(false)}><X size={18}/></button></div><div className="main-area" inert={menu}><Topbar title={title} onMenu={()=>setMenu(true)} menuOpen={menu} profile={profile} onLogout={onLogout}/><main className="page-content">{children}<footer className="footer"><span>© 2026 Play Nexa</span><span>Play fair. Play smart.</span><Link to="/support">Help center</Link></footer></main><nav aria-label="Player navigation" className="bottom-nav">{playerNav.filter((_,index)=>index!==2).map(([label,path,Icon])=><NavLink key={label} to={path} className={({isActive})=>isActive?'active':''}><Icon size={18}/><small>{label==='Dashboard'?'Home':label}</small></NavLink>)}</nav></div></div>
}

function AdminLayout({children,title,profile,onLogout}) {
  const [menu,setMenu]=useState(false)
  useEffect(()=>{if(!menu)return;const previous=document.activeElement;document.querySelector('.sidebar-wrap.open a')?.focus();const onKey=event=>event.key==='Escape'&&setMenu(false);document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);previous?.focus?.()}},[menu])
  return <div className="app-shell admin-shell"><button aria-label="Close navigation overlay" aria-hidden={!menu} tabIndex={menu?0:-1} className={`mobile-scrim ${menu?'visible':''}`} onClick={()=>setMenu(false)}/><div className={`sidebar-wrap ${menu?'open':''}`}><AdminSidebar close={()=>setMenu(false)}/><button className="mobile-close" aria-label="Close navigation" onClick={()=>setMenu(false)}><X size={18}/></button></div><div className="main-area" inert={menu}><Topbar title={title} onMenu={()=>setMenu(true)} menuOpen={menu} admin profile={profile} onLogout={onLogout}/><main className="page-content">{children}<footer className="footer"><span>Play Nexa Admin · Internal operations</span><Link to="/dashboard">Return to player app</Link></footer></main><nav aria-label="Admin navigation" className="bottom-nav admin-bottom-nav">{adminNav.map(([label,path])=><NavLink key={path} to={path} className={({isActive})=>isActive?'active':''}><AdminIcon label={label}/><small>{label}</small></NavLink>)}</nav></div></div>
}

function PlayerRoute({title,children,profile,onLogout}) { return <PlayerLayout title={title} profile={profile} onLogout={onLogout}>{children}</PlayerLayout> }
function RequireAuth() {
  const {loading,session,profile,authError,refreshProfile,logout}=useAuth()
  const [logoutError,setLogoutError]=useState('')
  const location=useLocation()
  if(loading)return <LoadingBlock label="Restoring your session…"/>
  if(!session)return <Navigate to="/login" state={{from:location}} replace/>
  if(!profile)return <div className="auth-restore-error" role="alert"><p>{authError||'Your account profile could not be loaded.'}</p>{logoutError&&<p>{logoutError}</p>}<Button variant="secondary" onClick={refreshProfile}>Retry</Button><Button variant="ghost" onClick={async()=>{try{await logout()}catch(error){setLogoutError(error instanceof Error?`Could not sign out: ${error.message}`:'Could not sign out. Please try again.')}}}>Sign out</Button></div>
  return <Outlet/>
}
function RequireAdmin() {
  const {profile}=useAuth()
  return profile?.user_type==='admin'?<Outlet/>:<Navigate to="/dashboard" replace/>
}
function AppContent() {
  const [toast,setToast]=useState(''); const location=useLocation(); const {profile,logout}=useAuth(); const notify=message=>{setToast(message);window.clearTimeout(window.__playNexaToast);window.__playNexaToast=window.setTimeout(()=>setToast(''),3200)}
  const handleLogout=async()=>{try{await logout();notify('You have been signed out.')}catch(error){notify(error instanceof Error?`Could not sign out: ${error.message}`:'Could not sign out. Please try again.')}}
  const adminMatch=location.pathname.match(/^\/admin(?:\/(summary|deposits|payouts|settlements|games|payments|users|support))?\/?$/)
  const adminSection=adminMatch?.[1]||'summary'; const adminTitle=titleFor[`/admin/${adminSection}`]||'Summary'
  return <><Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
    <Route path="/login" element={<AuthPage mode="login" onSuccess={notify}/>}/><Route path="/signup" element={<AuthPage mode="signup" onSuccess={notify}/>}/><Route path="/forgot-password" element={<AuthPage mode="forgot-password" onSuccess={notify}/>}/>
    <Route element={<RequireAuth/>}>
      <Route path="/dashboard" element={<PlayerRoute title="Dashboard" profile={profile} onLogout={handleLogout}><Dashboard/></PlayerRoute>}/>
      <Route path="/games" element={<PlayerRoute title="Games" profile={profile} onLogout={handleLogout}><GamesPage/></PlayerRoute>}/><Route path="/games/:gameId" element={<PlayerRoute title="Game lobby" profile={profile} onLogout={handleLogout}><Lobby key={location.pathname} notify={notify}/></PlayerRoute>}/>
      <Route path="/match/" element={<Navigate to="/match/NX-2841" replace/>}/><Route path="/match/:id" element={<PlayerRoute title="Match details" profile={profile} onLogout={handleLogout}><MatchPage notify={notify}/></PlayerRoute>}/>
      <Route path="/wallet" element={<PlayerRoute title="Wallet" profile={profile} onLogout={handleLogout}><WalletPage notify={notify}/></PlayerRoute>}/><Route path="/support" element={<PlayerRoute title="Support" profile={profile} onLogout={handleLogout}><SupportPage notify={notify}/></PlayerRoute>}/>
      <Route element={<RequireAdmin/>}>
        <Route path="/admin" element={<AdminLayout title={adminTitle} profile={profile} onLogout={handleLogout}><AdminPage section="summary" notify={notify}/></AdminLayout>}/>
        <Route path="/admin/:section" element={<AdminRouterLayout title={adminTitle} section={adminSection} notify={notify} profile={profile} onLogout={handleLogout}/>}/>
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
  </Routes><Toast message={toast} onClose={()=>setToast('')}/></>
}
function AdminRouterLayout({title,section,notify,profile,onLogout}) { return <AdminLayout title={title} profile={profile} onLogout={onLogout}><AdminPage section={section} notify={notify}/></AdminLayout> }
export default function App() { return <BrowserRouter><AuthProvider><AppContent/></AuthProvider></BrowserRouter> }
