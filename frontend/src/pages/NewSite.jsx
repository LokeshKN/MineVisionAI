import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import api from '../api/client'

const MINE_TYPES = ['Opencast Coal','Underground Coal','Iron Ore Opencast',
  'Limestone Quarry','Bauxite Mine','Gold Mine','Other']

export default function NewSite() {
  const [form, setForm] = useState({
    name:'', location:'', state:'', mine_type:'Opencast Coal',
    latitude:'', longitude:'', area_km2:'', max_depth_m:''
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const navigate = useNavigate()

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const payload = {...form}
      if (payload.latitude)   payload.latitude   = parseFloat(payload.latitude)
      if (payload.longitude)  payload.longitude  = parseFloat(payload.longitude)
      if (payload.area_km2)   payload.area_km2   = parseFloat(payload.area_km2)
      if (payload.max_depth_m)payload.max_depth_m= parseFloat(payload.max_depth_m)
      const { data } = await api.post('/sites/', payload)
      navigate(`/sites/${data.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create site.')
    } finally { setLoading(false) }
  }

  const inp = (key, type='text', placeholder='') => ({
    value: form[key],
    onChange: set(key),
    type,
    placeholder,
    style: {
      width:'100%', padding:'10px 14px',
      background:'var(--surface)', border:'1px solid var(--border)',
      borderRadius:8, color:'var(--text)', fontSize:14, outline:'none',
    },
    onFocus: e => e.target.style.borderColor='var(--accent)',
    onBlur:  e => e.target.style.borderColor='var(--border)',
  })

  return (
    <div style={{flex:1, overflowY:'auto'}} className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">New Mine Site</div>
          <div className="page-sub">Step 1 of workflow — Flight Planning & Site Registration</div>
        </div>
        <div className="header-actions">
          <button className="btn-outline" onClick={() => navigate(-1)}><ArrowLeft size={14}/> Back</button>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{padding:'28px', maxWidth:680}}>
        {error && (
          <div style={{background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)',
            borderRadius:8, padding:'10px 14px', marginBottom:20, fontSize:13, color:'var(--red)'}}>
            {error}
          </div>
        )}

        {/* Section: Identity */}
        <div style={{background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, marginBottom:20, overflow:'hidden'}}>
          <div style={{padding:'14px 20px', borderBottom:'1px solid var(--border)', background:'var(--surface)'}}>
            <div style={{fontSize:13, fontWeight:700}}>Site Identity</div>
            <div style={{fontSize:12, color:'var(--muted)'}}>Name, location, and mine classification</div>
          </div>
          <div style={{padding:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11, color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'0.6px', display:'block', marginBottom:6}}>Mine Site Name *</label>
              <input {...inp('name','text','e.g. Jharia Block-7')} required />
            </div>
            <div>
              <label style={{fontSize:11, color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'0.6px', display:'block', marginBottom:6}}>Location / District *</label>
              <input {...inp('location','text','e.g. Dhanbad')} required />
            </div>
            <div>
              <label style={{fontSize:11, color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'0.6px', display:'block', marginBottom:6}}>State *</label>
              <input {...inp('state','text','e.g. Jharkhand')} required />
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11, color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'0.6px', display:'block', marginBottom:6}}>Mine Type *</label>
              <select value={form.mine_type} onChange={set('mine_type')} style={{
                width:'100%', padding:'10px 14px', background:'var(--surface)',
                border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:14
              }}>
                {MINE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Section: Coordinates */}
        <div style={{background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, marginBottom:20, overflow:'hidden'}}>
          <div style={{padding:'14px 20px', borderBottom:'1px solid var(--border)', background:'var(--surface)'}}>
            <div style={{fontSize:13, fontWeight:700}}>Flight Planning Data</div>
            <div style={{fontSize:12, color:'var(--muted)'}}>Optional — will be auto-populated from GCPs / image EXIF during processing</div>
          </div>
          <div style={{padding:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            <div>
              <label style={{fontSize:11, color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'0.6px', display:'block', marginBottom:6}}>Centre Latitude</label>
              <input {...inp('latitude','number','e.g. 23.754')} step="any" />
            </div>
            <div>
              <label style={{fontSize:11, color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'0.6px', display:'block', marginBottom:6}}>Centre Longitude</label>
              <input {...inp('longitude','number','e.g. 86.416')} step="any" />
            </div>
            <div>
              <label style={{fontSize:11, color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'0.6px', display:'block', marginBottom:6}}>Area (km²)</label>
              <input {...inp('area_km2','number','e.g. 2.4')} step="any" />
            </div>
            <div>
              <label style={{fontSize:11, color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'0.6px', display:'block', marginBottom:6}}>Max Pit Depth (m)</label>
              <input {...inp('max_depth_m','number','e.g. 47.3')} step="any" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-accent" style={{fontSize:14, padding:'11px 28px'}}>
          {loading ? 'Creating…' : 'Create Site & Start Workflow →'}
        </button>
      </form>
    </div>
  )
}
