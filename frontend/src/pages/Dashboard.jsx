import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Filter, MapPin, ArrowRight } from 'lucide-react'
import api from '../api/client'

function fmt(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n/1_000_000).toFixed(2)+'M m³'
  if (n >= 1_000)     return (n/1_000).toFixed(1)+'K m³'
  return n.toLocaleString('en-IN')+' m³'
}

function StatCard({ label, value, color, change }) {
  return (
    <div style={{background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:18}}>
      <div style={{fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8}}>{label}</div>
      <div style={{fontSize:28, fontWeight:800, fontFamily:'monospace', color}}>{value}</div>
      {change && <div style={{fontSize:11, color:'var(--green)', marginTop:6}}>{change}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [sites,   setSites]   = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/sites/').then(r => { setSites(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const totalVol   = sites.reduce((a, s) => a + (s.stockpile_volume || 0), 0)
  const totalSurveys = sites.reduce((a, s) => a + (s.survey_count || 0), 0)
  const now = new Date().toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' })

  return (
    <div style={{flex:1, overflowY:'auto'}} className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Last sync: {now} IST</div>
        </div>
        <div className="header-actions">
          <button className="btn-accent" onClick={() => navigate('/sites/new')}>
            <Plus size={14} /> Add Mine Site
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, padding:'24px 28px 16px'}}>
        <StatCard label="Mine Sites"         value={sites.length}          color="var(--accent)" />
        <StatCard label="Total Volume (m³)"  value={totalVol ? fmt(totalVol) : '—'} color="var(--green)"  />
        <StatCard label="Total Surveys"      value={totalSurveys || '—'}   color="var(--blue)"   />
        <StatCard label="Reports"            value="—"                     color="var(--purple)"  />
      </div>

      {/* Sites */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 28px 14px'}}>
        <div style={{fontSize:14, fontWeight:600}}>Mine Sites</div>
        {sites.length > 0 && (
          <Link to="/sites" style={{color:'var(--accent)', fontSize:13, textDecoration:'none', display:'flex', alignItems:'center', gap:4}}>
            View all <ArrowRight size={13} />
          </Link>
        )}
      </div>

      {loading ? (
        <div style={{textAlign:'center', color:'var(--muted)', padding:60, fontSize:14}}>Loading…</div>
      ) : sites.length === 0 ? (
        /* Empty state */
        <div style={{
          margin:'0 28px 28px',
          background:'var(--card)', border:'2px dashed var(--border)',
          borderRadius:12, padding:'60px 40px', textAlign:'center'
        }}>
          <div style={{fontSize:48, marginBottom:16}}>⛏</div>
          <div style={{fontSize:18, fontWeight:700, marginBottom:8}}>No mine sites yet</div>
          <div style={{fontSize:14, color:'var(--muted)', marginBottom:24, maxWidth:400, margin:'0 auto 24px'}}>
            Add your first mine site, then upload drone images to start a survey.
          </div>
          <button className="btn-accent" style={{fontSize:14, padding:'10px 24px'}} onClick={() => navigate('/sites/new')}>
            <Plus size={15} /> Add Mine Site
          </button>
        </div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, padding:'0 28px 28px'}}>
          {sites.map(site => (
            <div key={site.id}
              onClick={() => navigate(`/sites/${site.id}`)}
              style={{background:'var(--card)', border:'1px solid var(--border)',
                borderRadius:10, overflow:'hidden', cursor:'pointer',
                transition:'border-color .2s, transform .15s'}}
              onMouseEnter={e => {e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.transform='translateY(-2px)'}}
              onMouseLeave={e => {e.currentTarget.style.borderColor='var(--border)';  e.currentTarget.style.transform='translateY(0)'}}>
              {/* Header bar */}
              <div style={{height:6, background:'var(--accent)', opacity:.7}} />
              <div style={{padding:16}}>
                <div style={{fontSize:14, fontWeight:700, marginBottom:3}}>{site.name}</div>
                <div style={{fontSize:11, color:'var(--muted)', marginBottom:10, display:'flex', alignItems:'center', gap:4}}>
                  <MapPin size={10}/> {site.location}{site.state ? `, ${site.state}` : ''} · {site.mine_type || 'Mine'}
                </div>
                <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:12}}>
                  <span className="tag tag-green">● Active</span>
                  {site.dem_available && <span className="tag tag-gray">DEM Ready</span>}
                </div>
                <div style={{display:'flex', justifyContent:'space-between', paddingTop:12, borderTop:'1px solid var(--border)'}}>
                  {[
                    ['Stockpile', site.stockpile_volume != null ? fmt(site.stockpile_volume) : '—'],
                    ['Surveys',   (site.survey_count || 0).toString()],
                    ['Area',      site.area_km2 != null ? `${site.area_km2.toFixed(2)} km²` : '—'],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{textAlign:'center'}}>
                      <div style={{fontSize:10, color:'var(--muted)'}}>{lbl}</div>
                      <div style={{fontSize:13, fontWeight:700, fontFamily:'monospace', color:'var(--accent)', marginTop:2}}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
