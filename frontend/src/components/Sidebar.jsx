import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import {
  LayoutDashboard, Map, CloudUpload, FileText,
  Settings, LogOut, Mountain
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', section: 'Overview' },
  { to: '/sites', icon: Map, label: 'Mine Sites', section: null },
  { to: '/upload', icon: CloudUpload, label: 'Upload Data', section: 'Workflow' },
  { to: '/reports', icon: FileText, label: 'Reports', section: null },
  { to: '/settings', icon: Settings, label: 'Settings', section: 'System' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  let lastSection = null

  return (
    <div style={{
      width: 228, background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh'
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, background: 'var(--accent)', borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 15, color: '#000'
        }}>MV</div>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.5px' }}>
          Mine<span style={{ color: 'var(--accent)' }}>Vision</span>AI
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {navItems.map(({ to, icon: Icon, label, section }) => {
          const showSection = section && section !== lastSection
          if (showSection) lastSection = section
          return (
            <div key={to}>
              {showSection && <div className="section-label">{section}</div>}
              <NavLink
                to={to}
                end={to === '/'}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 20px', textDecoration: 'none',
                  fontSize: 14,
                  color: isActive ? 'var(--accent)' : 'var(--muted)',
                  background: isActive ? 'var(--card)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'background 0.15s, color 0.15s',
                })}
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-dim)',
          border: '1px solid var(--accent)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)', flexShrink: 0
        }}>
          {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{user?.role}</div>
        </div>
        <button className="btn-ghost" onClick={handleLogout} title="Logout"><LogOut size={15} /></button>
      </div>
    </div>
  )
}
