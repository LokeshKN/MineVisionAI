import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, MapPin, Trash2 } from 'lucide-react'
import api from '../api/client'

const fmt = (n, unit='', dec=0) =>
  n != null ? `${n.toLocaleString('en-IN', {maximumFractionDigits:dec})}${unit}` : '—'

export default function Sites() {
  const [sites,   setSites]   = useState([])
  const [loading, setLoading] = useState(true)
  const [query,   setQuery]   = useState('')
  const [deleting, setDeleting] = useState(null)
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    api.get('/sites/').then(r => { setSites(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(load, [])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Delete this site and all its surveys?')) return
    setDeleting(id)
    await api.delete(`/sites/${id}`).catch(() => {})
    setDeleting(null)
    load()
  }

  const filtered = sites.filter(s =>
    [s.name, s.location, s.state, s.mine_type].some(v =>
      v?.toLowerCase().includes(query.toLowerCase())))

  return (
    <div style={{flex:1, overflowY:'auto'}} className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Mine Sites</div>
          <div className="page-sub">{sites.length} site{sites.length !== 1 ? 's' : ''} registered</div>
        </div>
        <div className="header-actions">
          <button className="btn-accent" onClick={() => navigate('/sites/new')}>
            <Plus size={14}/> Add Site
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{padding:'20px 28px 8px'}}>
        <div style={{position:'relative', maxWidth:360}}>
          <Search size={15} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, location, or type…"
            style={{width:'100%', padding:'9px 14px 9px 36px',
              background:'var(--card)', border:'1px solid var(--border)',
              borderRadius:8, color:'var(--text)', fontSize:13, outline:'none'}}
            onFocus={e => e.target.style.borderColor='var(--accent)'}
            onBlur={e  => e.target.style.borderColor='var(--border)'}/>
        </div>
      </div>

      <div style={{padding:'12px 28px 28px'}}>
        {loading ? (
          <div style={{color:'var(--muted)', padding:40, textAlign:'center'}}>Loading…</div>
        ) : sites.length === 0 ? (
          <div style={{background:'var(--card)', border:'2px dashed var(--border)',
            borderRadius:12, padding:'60px 40px', textAlign:'center'}}>
            <div style={{fontSize:36, marginBottom:16}}>🗺️</div>
            <div style={{fontSize:18, fontWeight:700, marginBottom:8}}>No mine sites yet</div>
            <div style={{fontSize:14, color:'var(--muted)', marginBottom:24}}>
              Register your first site to start the survey workflow.
            </div>
            <button className="btn-accent" style={{fontSize:14, padding:'10px 24px'}}
              onClick={() => navigate('/sites/new')}><Plus size={15}/> Add Mine Site</button>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div style={{display:'grid',
              gridTemplateColumns:'2fr 1.2fr 1fr 1fr 1fr 80px 60px',
              gap:12, padding:'10px 16px',
              fontSize:11, color:'var(--muted)', textTransform:'uppercase',
              letterSpacing:'0.5px', borderBottom:'1px solid var(--border)'}}>
              {['Site Name','Location','Type','Stockpile Vol.','Surveys','Status',''].map(h => <span key={h}>{h}</span>)}
            </div>

            {filtered.length === 0 ? (
              <div style={{textAlign:'center', color:'var(--muted)', padding:40}}>
                No sites match "{query}"
              </div>
            ) : filtered.map(site => (
              <div key={site.id}
                onClick={() => navigate(`/sites/${site.id}`)}
                style={{display:'grid',
                  gridTemplateColumns:'2fr 1.2fr 1fr 1fr 1fr 80px 60px',
                  gap:12, padding:'13px 16px',
                  borderBottom:'1px solid var(--border)', cursor:'pointer',
                  borderRadius:8, transition:'background .15s'}}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                {/* Name */}
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <div style={{width:8, height:8, borderRadius:'50%',
                    background:'var(--accent)', flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:14, fontWeight:700}}>{site.name}</div>
                    {site.latitude && (
                      <div style={{fontSize:10, color:'var(--muted)', marginTop:1,
                        display:'flex', alignItems:'center', gap:3, fontFamily:'monospace'}}>
                        <MapPin size={9}/> {site.latitude.toFixed(4)}°N {site.longitude.toFixed(4)}°E
                      </div>
                    )}
                  </div>
                </div>

                <div style={{display:'flex', alignItems:'center', fontSize:13, color:'var(--muted2)'}}>
                  {[site.location, site.state].filter(Boolean).join(', ') || '—'}
                </div>
                <div style={{display:'flex', alignItems:'center', fontSize:13, color:'var(--muted2)'}}>
                  {site.mine_type || '—'}
                </div>
                <div style={{display:'flex', alignItems:'center', fontSize:14,
                  fontWeight:700, fontFamily:'monospace', color:'var(--accent)'}}>
                  {site.stockpile_volume != null
                    ? site.stockpile_volume >= 1e6
                      ? `${(site.stockpile_volume/1e6).toFixed(2)}M m³`
                      : `${site.stockpile_volume.toLocaleString('en-IN')} m³`
                    : '—'}
                </div>
                <div style={{display:'flex', alignItems:'center', fontSize:13, color:'var(--muted2)'}}>
                  {site.survey_count ?? 0}
                </div>
                <div style={{display:'flex', alignItems:'center'}}>
                  <span className="tag tag-green">● Active</span>
                </div>
                <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end'}}>
                  <button className="btn-ghost"
                    onClick={e => handleDelete(e, site.id)}
                    disabled={deleting === site.id}
                    title="Delete site"
                    style={{color:'var(--muted)'}}>
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
