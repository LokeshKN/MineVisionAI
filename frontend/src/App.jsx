import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Sidebar   from './components/Sidebar'
import Login     from './pages/Login'
import Register  from './pages/Register'
import Dashboard from './pages/Dashboard'
import Sites     from './pages/Sites'
import NewSite   from './pages/NewSite'
import MineDetail from './pages/MineDetail'
import Upload    from './pages/Upload'
import Reports   from './pages/Reports'
import Settings  from './pages/Settings'
import './styles/globals.css'

function AppLayout() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace/>
  return (
    <div style={{display:'flex', height:'100vh', overflow:'hidden'}}>
      <Sidebar/>
      <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
        <Routes>
          <Route path="/"           element={<Dashboard/>}/>
          <Route path="/sites"      element={<Sites/>}/>
          <Route path="/sites/new"  element={<NewSite/>}/>
          <Route path="/sites/:id"  element={<MineDetail/>}/>
          <Route path="/upload"     element={<Upload/>}/>
          <Route path="/reports"    element={<Reports/>}/>
          <Route path="/settings"   element={<Settings/>}/>
          <Route path="*"           element={<Navigate to="/" replace/>}/>
        </Routes>
      </div>
    </div>
  )
}

function PublicRoute({ element }) {
  const { user } = useAuth()
  return user ? <Navigate to="/" replace/> : element
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<PublicRoute element={<Login/>}/>}/>
          <Route path="/register" element={<PublicRoute element={<Register/>}/>}/>
          <Route path="/*"        element={<AppLayout/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
