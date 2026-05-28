import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const { login } = useAuth()
  const navigate  = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password.')
    } finally { setLoading(false) }
  }

  const inp = {
    width: '100%', padding: '11px 14px',
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none',
  }

  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', position:'relative', overflow:'hidden',
      background:'radial-gradient(ellipse at 20% 50%, rgba(245,158,11,0.07), transparent 60%), var(--bg)'
    }}>
      <div style={{ position:'absolute', inset:0, opacity:.18,
        backgroundImage:'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)',
        backgroundSize:'48px 48px' }} />

      <form onSubmit={handleSubmit} style={{
        background:'var(--card)', border:'1px solid var(--border2)',
        borderRadius:16, padding:'44px 40px', width:400,
        position:'relative', zIndex:1
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:36 }}>
          <div style={{ width:40, height:40, background:'var(--accent)', borderRadius:9,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:900, fontSize:16, color:'#000' }}>MV</div>
          <div style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.5px' }}>
            Mine<span style={{color:'var(--accent)'}}>Vision</span>AI</div>
        </div>

        <h2 style={{fontSize:24, fontWeight:700, marginBottom:6}}>Sign in</h2>
        <p style={{color:'var(--muted)', fontSize:13, marginBottom:32}}>
          Mine Survey & Volume Management Platform
        </p>

        {error && (
          <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)',
            borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, color:'var(--red)'}}>
            {error}
          </div>
        )}

        {[['Email', email, setEmail, 'email'], ['Password', password, setPassword, 'password']].map(([lbl, val, set, type]) => (
          <div key={lbl} style={{marginBottom:18}}>
            <label style={{display:'block', fontSize:11, color:'var(--muted2)',
              textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:7}}>{lbl}</label>
            <input type={type} value={val} onChange={e => set(e.target.value)} required
              style={inp}
              onFocus={e=>e.target.style.borderColor='var(--accent)'}
              onBlur={e=>e.target.style.borderColor='var(--border)'} />
          </div>
        ))}

        <button type="submit" disabled={loading} style={{
          width:'100%', padding:12, background:'var(--accent)', border:'none',
          borderRadius:8, color:'#000', fontWeight:800, fontSize:15,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1, marginTop:4
        }}>
          {loading ? 'Signing in…' : 'Sign In →'}
        </button>

        <p style={{textAlign:'center', fontSize:12, color:'var(--muted)', marginTop:14}}>
          No account?{' '}
          <Link to="/register" style={{color:'var(--accent)', textDecoration:'none'}}>
            Create one
          </Link>
        </p>
      </form>
    </div>
  )
}
