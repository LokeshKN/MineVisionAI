import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, useMap } from 'react-leaflet'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowLeft, Plane, Download, FileText, Layers, BarChart3, Info, Plus } from 'lucide-react'
import api from '../api/client'

const NA = '—'
const fmt  = (n, dec=0)  => n != null ? n.toLocaleString('en-IN', {maximumFractionDigits:dec}) : NA
const fmtM = (n)         => n != null ? `${fmt(n)} m³` : NA
const fmtE = (n)         => n != null ? `${fmt(n,1)} m ASL` : NA

// Fly map to new centre when coordinates load
function FlyTo({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], 15, { animate: true })
  }, [lat, lng])
  return null
}

function TabBtn({ id, active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex:1, padding:'12px 8px', background:'none', border:'none',
      borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
      color: active ? 'var(--accent)' : 'var(--muted)',
      fontSize:13, cursor:'pointer', transition:'color .15s'
    }}>{children}</button>
  )
}

function InfoRow({ k, v, color }) {
  return (
    <div className="info-row">
      <span className="info-key">{k}</span>
      <span className="info-val" style={{ color: color || undefined,
        fontFamily: k==='Coordinates' ? 'monospace' : undefined,
        fontSize: k==='Coordinates' ? 11 : undefined }}>{v ?? NA}</span>
    </div>
  )
}

export default function MineDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [site,    setSite]    = useState(null)
  const [tab,     setTab]     = useState('info')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    api.get(`/sites/${id}`)
      .then(r => { setSite(r.data); setLoading(false) })
      .catch(e => { setError(e.response?.data?.detail || 'Failed to load site'); setLoading(false) })
  }, [id])

  if (loading) return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)'}}>Loading…</div>
  if (error)   return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--red)'}}>{error}</div>
  if (!site)   return null

  const latest   = site.surveys?.[0]
  const volData  = (site.volume_history || []).map(v => ({ month: v.month, vol: +(v.volume/1_000_000).toFixed(3) }))
  const hasCoord = site.latitude && site.longitude
  const mapCenter = hasCoord ? [site.latitude, site.longitude] : [20.5937, 78.9629] // India centre fallback

  // GCP markers extracted from latest survey image files — we get them from the contour GeoJSON bbox if no coords
  const hasContours = !!site.contour_geojson

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}} className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{site.name}</div>
          <div className="page-sub">
            {[site.location, site.state].filter(Boolean).join(', ')}
            {latest ? ` · Last survey: ${new Date(latest.created_at).toLocaleDateString('en-IN',{dateStyle:'medium'})}` : ' · No surveys yet'}
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-outline" onClick={() => navigate(-1)}><ArrowLeft size={14}/> Back</button>
          <button className="btn-accent"  onClick={() => navigate(`/upload?site=${site.id}`)}>
            <Plane size={14}/> New Survey
          </button>
        </div>
      </div>

      <div style={{flex:1,display:'flex',overflow:'hidden'}}>

        {/* ── MAP ── */}
        <div style={{flex:1,position:'relative'}}>
          {!hasCoord && (
            <div style={{
              position:'absolute',top:12,left:'50%',transform:'translateX(-50%)',
              zIndex:1000,background:'rgba(15,20,33,0.92)',border:'1px solid var(--border)',
              borderRadius:8,padding:'8px 14px',fontSize:12,color:'var(--muted2)',
              whiteSpace:'nowrap', pointerEvents:'none'
            }}>
              Map will centre on site after first survey with GPS images or GCPs
            </div>
          )}
          <MapContainer
            center={mapCenter}
            zoom={hasCoord ? 14 : 5}
            style={{width:'100%',height:'100%'}}
            zoomControl>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
              maxZoom={19}/>
            {hasCoord && <FlyTo lat={site.latitude} lng={site.longitude}/>}

            {/* Real contour lines from processed GeoJSON */}
            {hasContours && (
              <GeoJSON
                data={site.contour_geojson}
                style={feat => ({
                  color: '#f59e0b',
                  weight: feat.properties?.elevation % 5 === 0 ? 1.5 : 0.7,
                  opacity: 0.6,
                })}
                onEachFeature={(feat, layer) => {
                  if (feat.properties?.elevation != null)
                    layer.bindPopup(`Elevation: ${feat.properties.elevation} m ASL`)
                }}
              />
            )}

            {/* Site centre marker */}
            {hasCoord && (
              <CircleMarker center={[site.latitude, site.longitude]}
                radius={8} pathOptions={{color:'#f59e0b',fillColor:'#f59e0b',fillOpacity:.85}}>
                <Popup>
                  <b>{site.name}</b><br/>
                  {latest?.stockpile_volume != null
                    ? `Stockpile: ${fmtM(latest.stockpile_volume)}`
                    : 'No volume data yet'}
                </Popup>
              </CircleMarker>
            )}
          </MapContainer>

          {/* Legend */}
          <div style={{
            position:'absolute',bottom:20,left:20,zIndex:1000,
            background:'rgba(9,13,22,0.9)',border:'1px solid var(--border)',
            borderRadius:8,padding:'10px 14px',fontSize:11
          }}>
            {hasContours
              ? <div style={{display:'flex',alignItems:'center',gap:8,color:'var(--muted2)'}}>
                  <div style={{width:14,height:2,borderTop:'2px solid #f59e0b'}}/>
                  Contour lines (real DEM)
                </div>
              : <div style={{color:'var(--muted)',fontStyle:'italic'}}>
                  Contours appear after DEM processing
                </div>
            }
          </div>
        </div>

        {/* ── SIDE PANEL ── */}
        <div style={{width:340,background:'var(--card)',borderLeft:'1px solid var(--border)',
          display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{display:'flex',borderBottom:'1px solid var(--border)',flexShrink:0}}>
            {[['info','Site Info'],['volume','Volume'],['surveys','Surveys'],['gis','GIS']].map(([id,lbl]) => (
              <TabBtn key={id} id={id} active={tab===id} onClick={() => setTab(id)}>{lbl}</TabBtn>
            ))}
          </div>

          <div style={{flex:1,overflowY:'auto',padding:18}}>

            {/* ── INFO TAB ── */}
            {tab === 'info' && <>
              <div style={{fontSize:11,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:10}}>Site Details</div>
              <InfoRow k="Mine Type"       v={site.mine_type}/>
              <InfoRow k="Coordinates"     v={site.latitude ? `${site.latitude.toFixed(4)}°N  ${site.longitude.toFixed(4)}°E` : 'Not set — will auto-fill from GCPs'}/>
              <InfoRow k="Area"            v={site.area_km2    != null ? `${site.area_km2.toFixed(4)} km²`  : 'Computed from DEM'}/>
              <InfoRow k="Max Depth"       v={site.max_depth_m != null ? `${site.max_depth_m} m`            : NA}/>
              <InfoRow k="Elevation Min"   v={fmtE(site.elevation_min)} />
              <InfoRow k="Elevation Max"   v={fmtE(site.elevation_max)} />
              <InfoRow k="Surveys Run"     v={site.surveys?.length ?? 0}/>
              {latest && <>
                <InfoRow k="Last Drone"       v={latest.drone_model || NA}/>
                <InfoRow k="DEM Resolution"   v={latest.dem_resolution != null ? `${latest.dem_resolution} m/px` : NA}/>
                <InfoRow k="CRS"              v={latest.dem_crs || NA}/>
                <InfoRow k="ODM Processing"   v={latest.status === 'complete' ? '✓ Complete' : latest.status} color={latest.status==='complete' ? 'var(--green)' : undefined}/>
              </>}
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:16}}>
                <button className="btn-accent" style={{fontSize:12}} onClick={() => navigate('/reports')}><FileText size={13}/> Reports</button>
                <button className="btn-outline" style={{fontSize:12}} onClick={() => navigate(`/upload?site=${site.id}`)}><Plus size={13}/> New Survey</button>
              </div>
            </>}

            {/* ── VOLUME TAB ── */}
            {tab === 'volume' && <>
              {volData.length > 0 ? <>
                <div style={{fontSize:11,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:10}}>Volume History</div>
                <div style={{height:170,marginBottom:16}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={volData}>
                      <defs>
                        <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.03}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                      <XAxis dataKey="month" tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false}/>
                      <Tooltip
                        contentStyle={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,fontSize:12}}
                        formatter={v => [`${v}M m³`,'Volume']}/>
                      <Area type="monotone" dataKey="vol" stroke="#f59e0b" strokeWidth={2}
                        fill="url(#vg)" dot={{fill:'#f59e0b',r:3}}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </> : (
                <div style={{textAlign:'center',color:'var(--muted)',padding:'30px 0',fontSize:13}}>
                  No volume data yet.<br/>Run a survey with a DEM to compute volumes.
                </div>
              )}
              {latest && <>
                <InfoRow k="Stockpile Volume" v={fmtM(latest.stockpile_volume)} color="var(--accent)"/>
                <InfoRow k="Cut Volume"       v={fmtM(latest.cut_volume)}/>
                <InfoRow k="Net Change"       v={latest.net_change != null ? `${latest.net_change >= 0 ? '+' : ''}${fmtM(latest.net_change)}` : NA} color={latest.net_change > 0 ? 'var(--green)' : 'var(--red)'}/>
                <InfoRow k="Reference Plane"  v={fmtE(latest.reference_elev)}/>
                <InfoRow k="Images Passed QC" v={latest.images_passed != null ? `${latest.images_passed}/${latest.image_count}` : NA}/>
                <InfoRow k="GCPs Used"        v={latest.gcp_count || NA}/>
              </>}
            </>}

            {/* ── SURVEYS TAB ── */}
            {tab === 'surveys' && <>
              <div style={{fontSize:11,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:10}}>
                All Surveys ({site.surveys?.length ?? 0})
              </div>
              {site.surveys?.length === 0
                ? <div style={{color:'var(--muted)',fontSize:13,textAlign:'center',padding:'30px 0'}}>
                    No surveys yet.<br/>
                    <button className="btn-accent" style={{marginTop:12,fontSize:12}} onClick={() => navigate(`/upload?site=${site.id}`)}>
                      <Plus size={13}/> Start First Survey
                    </button>
                  </div>
                : site.surveys.map(sv => (
                  <div key={sv.id} style={{background:'var(--card2)',borderRadius:8,padding:'12px 14px',
                    border:'1px solid var(--border)',marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                      <span style={{fontSize:13,fontWeight:600}}>{sv.name}</span>
                      <span className={`tag ${sv.status==='complete'?'tag-green':sv.status==='failed'?'tag-red':'tag-amber'}`}>
                        {sv.status}
                      </span>
                    </div>
                    {sv.stockpile_volume != null && <div style={{fontSize:12,color:'var(--accent)',fontWeight:700,fontFamily:'monospace',marginBottom:4}}>
                      {fmtM(sv.stockpile_volume)}
                    </div>}
                    <div style={{fontSize:11,color:'var(--muted)'}}>
                      {sv.image_count ? `${sv.image_count} images` : ''}
                      {sv.gcp_count   ? ` · ${sv.gcp_count} GCPs` : ''}
                      {sv.dem_resolution ? ` · ${sv.dem_resolution}m/px DEM` : ''}
                    </div>
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>
                      {new Date(sv.created_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}
                    </div>
                  </div>
                ))
              }
            </>}

            {/* ── GIS TAB ── */}
            {tab === 'gis' && <>
              <div style={{fontSize:11,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:10}}>
                Output Layers
              </div>
              {!latest || latest.status !== 'complete'
                ? <div style={{color:'var(--muted)',fontSize:13,textAlign:'center',padding:'30px 0'}}>
                    GIS outputs appear after a completed survey.
                  </div>
                : <>
                  {[
                    ['DSM / DTM (GeoTIFF)',     latest.dem_resolution ? `${latest.dem_resolution} m/px` : null],
                    ['Orthomosaic (RGB)',        null],
                    ['Contour Lines (GeoJSON)', hasContours ? `${site.contour_geojson?.features?.length ?? 0} lines` : null],
                    ['Point Cloud (.LAZ)',       null],
                  ].map(([name, detail]) => (
                    <div key={name} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',
                      borderBottom:'1px solid var(--border)',fontSize:13}}>
                      <Layers size={15} style={{color:'var(--accent)',flexShrink:0}}/>
                      <span style={{flex:1}}>{name}</span>
                      {detail
                        ? <span style={{fontSize:11,color:'var(--green)'}}>✓ {detail}</span>
                        : <span style={{fontSize:11,color:'var(--muted)'}}>—</span>}
                    </div>
                  ))}
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}>
                    {['GeoTIFF','DXF','KML','GeoJSON'].map(fmt => (
                      <button key={fmt} className="btn-outline" style={{fontSize:12}}>
                        <Download size={13}/> {fmt}
                      </button>
                    ))}
                  </div>
                </>
              }
            </>}
          </div>
        </div>
      </div>
    </div>
  )
}
