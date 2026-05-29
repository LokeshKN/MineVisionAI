import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api/client'

export default function Register() {
  const [form,    setForm]    = useState({ name:'', email:'', password:'' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const { login } = useAuth()
  const navigate  = useNavigate()

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await api.post('/register', form)
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach server. Wait ~30 s for Render to wake up, then try again.')
      } else {
        setError(err.response?.data?.detail || 'Registration failed.')
      }
    } finally { setLoading(false) }
  }

  const inp = {
    width:'100%', padding:'11px 14px',
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:8, color:'var(--text)', fontSize:14, outline:'none',
  }

  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', background:'var(--bg)', position:'relative', overflow:'hidden'
    }}>
      <div style={{ position:'absolute', inset:0, opacity:.18,
        backgroundImage:'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)',
        backgroundSize:'48px 48px' }} />

      <form onSubmit={handleSubmit} style={{
        background:'var(--card)', border:'1px solid var(--border2)',
        borderRadius:16, padding:'44px 40px', width:420,
        position:'relative', zIndex:1
      }}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:36}}>
          <div style={{
            width:40, height:40, background:'var(--accent)', borderRadius:9,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:900, fontSize:16, color:'#000'
          }}>MV</div>
          <div style={{fontSize:20, fontWeight:800}}>
            Mine<span style={{color:'var(--accent)'}}>Vision</span>AI
          </div>
        </div>

        <h2 style={{fontSize:24, fontWeight:700, marginBottom:6}}>Create account</h2>
        <p style={{color:'var(--muted)', fontSize:13, marginBottom:32}}>
          Set up your mine survey workspace
        </p>

        {error && (
          <div style={{
            background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)',
            borderRadius:8, padding:'10px 14px', marginBottom:16,
            fontSize:13, color:'var(--red)', lineHeight:1.5
          }}>{error}</div>
        )}

        {[
          ['Full Name', 'name',     form.name,     'text'],
          ['Email',     'email',    form.email,    'email'],
          ['Password',  'password', form.password, 'password'],
        ].map(([lbl, key, val, type]) => (
          <div key={key} style={{marginBottom:18}}>
            <label style={{display:'block', fontSize:11, color:'var(--muted2)',
              textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:7}}>{lbl}</label>
            <input
              type={type} value={val}
              onChange={set(key)} required
              style={inp}
              onFocus={e => e.target.style.borderColor='var(--accent)'}
              onBlur={e  => e.target.style.borderColor='var(--border)'}
            />
          </div>
        ))}

        <button type="submit" disabled={loading} style={{
          width:'100%', padding:12, background:'var(--accent)', border:'none',
          borderRadius:8, color:'#000', fontWeight:800, fontSize:15,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1, marginTop:4
        }}>
          {loading ? 'Creating account…' : 'Create Account →'}
        </button>

        <p style={{textAlign:'center', fontSize:12, color:'var(--muted)', marginTop:14}}>
          Already have an account?{' '}
          <Link to="/login" style={{color:'var(--accent)', textDecoration:'none'}}>Sign in</Link>
        </p>
      </form>
    </div>
  )
}
