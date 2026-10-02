import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Bell, ChevronDown, CircleHelp, Gamepad2, LayoutDashboard, Menu, Swords, Users, Wallet, X, Zap } from 'lucide-react'
import { Toast } from './components'
import { AdminPage } from './AdminPages'
import { AuthPage, Dashboard, GamesPage, Lobby, MatchPage, SupportPage, WalletPage } from './PlayerPages'
import { adminNav, player, titleFor } from './data'
import './App.css'

const playerNav = [
  ['Dashboard','/dashboard',LayoutDashboard],['Games','/games',Gamepad2],['My matches','/match/NX-2841',Swords],['Wallet','/wallet',Wallet],['Support','/support',CircleHelp],
]
function Brand({admin=false}) { return <Link to={admin?'/admin/summary':'/dashboard'} className="brand"><span className="brand-mark"><Zap size={18} fill="currentColor"/></span><span>play<span>nexa</span></span>{admin&&<small>ADMIN</small>}</Link> }

function PlayerSidebar({close}) {
  return <aside className="sidebar"><Brand/><small className="nav-label">PLAYER MENU</small><nav aria-label="Player menu">{playerNav.map(([label,path,Icon])=><NavLink key={label} to={path} onClick={close} className={({isActive})=>`nav-link ${isActive?'active':''}`}><Icon size={17}/><span>{label}</span>{label==='My matches'&&<i>2</i>}</NavLink>)}</nav><div className="sidebar-bottom"><div className="support-mini"><span><CircleHelp size={17}/></span><strong>Need help?</strong><small>Our team is here for you.</small><Link to="/support">Contact support →</Link></div><Link to="/login" className="profile-chip"><span className="profile-avatar">{player.initials}</span><span><strong>{player.name}</strong><small>{player.phone}</small></span><ChevronDown size={15}/></Link></div></aside>
}

function AdminSidebar({close}) {
  return <aside className="sidebar admin-sidebar"><Brand admin/><small className="nav-label">OPERATIONS</small><nav aria-label="Admin menu">{adminNav.map(([label,path])=><NavLink key={path} to={path} onClick={close} end={path==='/admin/summary'} className={({isActive})=>`nav-link ${isActive?'active':''}`}><AdminIcon label={label}/><span>{label}</span></NavLink>)}</nav><div className="sidebar-bottom"><div className="admin-session"><span className="admin-session-dot"/><span><strong>Admin session</strong><small>Administrator access</small></span></div><Link className="back-player" to="/dashboard">← Player view</Link></div></aside>
}
function AdminIcon({label}) { const Icon=({Deposits:Wallet,Payouts:Wallet,Settlements:Swords,Games:Gamepad2,Payments:Wallet,Users,Support:CircleHelp,Summary:LayoutDashboard})[label]||LayoutDashboard; return <Icon size={17}/> }

function Topbar({title,onMenu,menuOpen=false,admin=false}) {
  const [notificationsOpen,setNotificationsOpen]=useState(false)
  useEffect(()=>{if(!notificationsOpen)return;const onKey=event=>event.key==='Escape'&&setNotificationsOpen(false);document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[notificationsOpen])
  return <header className="topbar"><button className="mobile-menu icon-btn" onClick={onMenu} aria-label={menuOpen?'Close navigation':'Open navigation'} aria-expanded={menuOpen}><Menu size={19}/></button><div className="breadcrumb"><span>{admin?'Administration':'Play Nexa'}</span><b>/</b><strong>{title}</strong></div><div className="top-actions"><div className="notification-wrap"><button className="icon-btn notification" aria-label="Notifications" aria-expanded={notificationsOpen} aria-controls="notification-list" onClick={()=>setNotificationsOpen(!notificationsOpen)}><Bell size={17}/><i/></button>{notificationsOpen&&<div id="notification-list" className="notification-popover" role="region" aria-label="Recent notifications"><strong>Notifications</strong><p><span/> Deposit confirmed · ₹500 added to your wallet</p><p><span/> Match NX-2841 is ready for review</p><button onClick={()=>setNotificationsOpen(false)}>Close</button></div>}</div><span className="top-divider"/><span className="top-user">{admin?'AD':player.initials}</span><span className="top-user-name">{admin?'Admin':player.name}</span><ChevronDown size={14}/></div></header>
}

function PlayerLayout({children,title}) {
  const [menu,setMenu]=useState(false)
  useEffect(()=>{if(!menu)return;const previous=document.activeElement;document.querySelector('.sidebar-wrap.open a')?.focus();const onKey=event=>event.key==='Escape'&&setMenu(false);document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);previous?.focus?.()}},[menu])
  return <div className="app-shell"><button aria-label="Close navigation overlay" aria-hidden={!menu} tabIndex={menu?0:-1} className={`mobile-scrim ${menu?'visible':''}`} onClick={()=>setMenu(false)}/><div className={`sidebar-wrap ${menu?'open':''}`}><PlayerSidebar close={()=>setMenu(false)}/><button className="mobile-close" aria-label="Close navigation" onClick={()=>setMenu(false)}><X size={18}/></button></div><div className="main-area" inert={menu}><Topbar title={title} onMenu={()=>setMenu(true)} menuOpen={menu}/><main className="page-content">{children}<footer className="footer"><span>© 2026 Play Nexa</span><span>Play fair. Play smart.</span><Link to="/support">Help center</Link></footer></main><nav aria-label="Player navigation" className="bottom-nav">{playerNav.filter((_,index)=>index!==2).map(([label,path,Icon])=><NavLink key={label} to={path} className={({isActive})=>isActive?'active':''}><Icon size={18}/><small>{label==='Dashboard'?'Home':label}</small></NavLink>)}</nav></div></div>
}

function AdminLayout({children,title}) {
  const [menu,setMenu]=useState(false)
  useEffect(()=>{if(!menu)return;const previous=document.activeElement;document.querySelector('.sidebar-wrap.open a')?.focus();const onKey=event=>event.key==='Escape'&&setMenu(false);document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);previous?.focus?.()}},[menu])
  return <div className="app-shell admin-shell"><button aria-label="Close navigation overlay" aria-hidden={!menu} tabIndex={menu?0:-1} className={`mobile-scrim ${menu?'visible':''}`} onClick={()=>setMenu(false)}/><div className={`sidebar-wrap ${menu?'open':''}`}><AdminSidebar close={()=>setMenu(false)}/><button className="mobile-close" aria-label="Close navigation" onClick={()=>setMenu(false)}><X size={18}/></button></div><div className="main-area" inert={menu}><Topbar title={title} onMenu={()=>setMenu(true)} menuOpen={menu} admin/><main className="page-content">{children}<footer className="footer"><span>Play Nexa Admin · Internal operations</span><Link to="/dashboard">Return to player app</Link></footer></main><nav aria-label="Admin navigation" className="bottom-nav admin-bottom-nav">{adminNav.map(([label,path])=><NavLink key={path} to={path} className={({isActive})=>isActive?'active':''}><AdminIcon label={label}/><small>{label}</small></NavLink>)}</nav></div></div>
}

function PlayerRoute({title,children}) { return <PlayerLayout title={title}>{children}</PlayerLayout> }
function AppContent() {
  const [toast,setToast]=useState(''); const location=useLocation(); const notify=message=>{setToast(message);window.clearTimeout(window.__playNexaToast);window.__playNexaToast=window.setTimeout(()=>setToast(''),3200)}
  const adminMatch=location.pathname.match(/^\/admin(?:\/(summary|deposits|payouts|settlements|games|payments|users|support))?\/?$/)
  const adminSection=adminMatch?.[1]||'summary'; const adminTitle=titleFor[`/admin/${adminSection}`]||'Summary'
  return <><Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
    <Route path="/login" element={<AuthPage mode="login" onSuccess={notify}/>}/><Route path="/signup" element={<AuthPage mode="signup" onSuccess={notify}/>}/><Route path="/forgot-password" element={<AuthPage mode="forgot-password" onSuccess={notify}/>}/>
    <Route path="/dashboard" element={<PlayerRoute title="Dashboard"><Dashboard/></PlayerRoute>}/>
    <Route path="/games" element={<PlayerRoute title="Games"><GamesPage/></PlayerRoute>}/><Route path="/games/:gameId" element={<PlayerRoute title="Game lobby"><Lobby key={location.pathname} notify={notify}/></PlayerRoute>}/>
    <Route path="/match/" element={<Navigate to="/match/NX-2841" replace/>}/><Route path="/match/:id" element={<PlayerRoute title="Match details"><MatchPage notify={notify}/></PlayerRoute>}/>
    <Route path="/wallet" element={<PlayerRoute title="Wallet"><WalletPage notify={notify}/></PlayerRoute>}/><Route path="/support" element={<PlayerRoute title="Support"><SupportPage notify={notify}/></PlayerRoute>}/>
    <Route path="/admin" element={<AdminLayout title={adminTitle}><AdminPage section="summary" notify={notify}/></AdminLayout>}/>
    <Route path="/admin/:section" element={<AdminRouterLayout title={adminTitle} section={adminSection} notify={notify}/>}/>
    <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
  </Routes><Toast message={toast} onClose={()=>setToast('')}/></>
}
function AdminRouterLayout({title,section,notify}) { return <AdminLayout title={title}><AdminPage section={section} notify={notify}/></AdminLayout> }
export default function App() { return <BrowserRouter><AppContent/></BrowserRouter> }
