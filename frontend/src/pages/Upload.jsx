import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CloudUpload, FileText, MapPin, Loader, Play, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import api from '../api/client'

function StepRow({ step, isLast }) {
  const { status, name, detail } = step
  const icon = status === 'complete' ? <CheckCircle size={14}/>
             : status === 'running'  ? <Loader size={14} className="spin"/>
             : status === 'failed'   ? <AlertCircle size={14}/>
             : status === 'skipped'  ? <span style={{fontSize:12}}>—</span>
             : <Clock size={14}/>
  const color = status === 'complete' ? 'var(--green)'
              : status === 'running'  ? 'var(--accent)'
              : status === 'failed'   ? 'var(--red)'
              : 'var(--muted)'
  return (
    <div style={{display:'flex', alignItems:'flex-start', gap:12, padding:'10px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--border)'}}>
      <div style={{width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center',
        justifyContent:'center', flexShrink:0, background:`${color}20`, color}}>
        {icon}
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:13, fontWeight:600}}>{name}</div>
        {detail && <div style={{fontSize:11, color: status==='running' ? 'var(--accent)' : 'var(--muted2)', marginTop:2, lineHeight:1.5}}>{detail}</div>}
        {status === 'running' && (
          <div style={{height:3, background:'var(--border)', borderRadius:2, marginTop:7, overflow:'hidden'}}>
            <div style={{height:'100%', background:'var(--accent)', borderRadius:2,
              animation:'indeterminate 1.4s ease-in-out infinite', width:'40%'}} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function Upload() {
  const [sites,          setSites]          = useState([])
  const [siteId,         setSiteId]         = useState('')
  const [droneModel,     setDroneModel]     = useState('')
  const [flyingHeight,   setFlyingHeight]   = useState('')
  const [refElev,        setRefElev]        = useState('')
  const [imageFiles,     setImageFiles]     = useState([])
  const [gcpFile,        setGcpFile]        = useState(null)
  const [demFile,        setDemFile]        = useState(null)
  const [dragging,       setDragging]       = useState(false)
  const [surveyId,       setSurveyId]       = useState(null)
  const [status,         setStatus]         = useState('idle')  // idle|uploading|processing|complete|failed
  const [steps,          setSteps]          = useState([])
  const [results,        setResults]        = useState(null)
  const [uploadProgress, setUploadProgress] = useState('')
  const pollRef = useRef()
  const navigate = useNavigate()
  const [searchParams]   = useSearchParams()

  useEffect(() => {
    api.get('/sites/').then(r => {
      setSites(r.data)
      const pre = searchParams.get('site')
      if (pre) setSiteId(pre)
      else if (r.data.length) setSiteId(String(r.data[0].id))
    })
    return () => clearInterval(pollRef.current)
  }, [])

  const handleImages = files => {
    const imgs = [...files].filter(f => /\.(jpe?g|png|tiff?|dng|raw)$/i.test(f.name))
    setImageFiles(prev => [...prev, ...imgs])
  }

  const handleDrop = e => {
    e.preventDefault(); setDragging(false)
    handleImages(e.dataTransfer.files)
  }

  const startPipeline = async () => {
    if (!siteId) { alert('Select a mine site'); return }
    if (!imageFiles.length && !demFile) { alert('Upload drone images or a DEM file'); return }

    setStatus('uploading')
    try {
      // Create survey
      const params = new URLSearchParams({ site_id: siteId })
      if (droneModel)   params.append('drone_model', droneModel)
      if (flyingHeight) params.append('flying_height_m', flyingHeight)
      const { data: sv } = await api.post(`/surveys/?${params}`)
      const sid = sv.survey_id
      setSurveyId(sid)

      // Upload images in batches of 10
      if (imageFiles.length) {
        for (let i = 0; i < imageFiles.length; i += 10) {
          setUploadProgress(`Uploading images ${i+1}–${Math.min(i+10, imageFiles.length)} of ${imageFiles.length}…`)
          const batch = imageFiles.slice(i, i+10)
          const form  = new FormData()
          batch.forEach(f => form.append('files', f))
          form.append('file_type', 'image')
          await api.post(`/surveys/${sid}/upload`, form)
        }
      }

      // Upload GCP
      if (gcpFile) {
        setUploadProgress('Uploading GCP file…')
        const form = new FormData()
        form.append('files', gcpFile)
        form.append('file_type', 'gcp')
        await api.post(`/surveys/${sid}/upload`, form)
      }

      // Upload DEM
      if (demFile) {
        setUploadProgress('Uploading DEM GeoTIFF…')
        const form = new FormData()
        form.append('files', demFile)
        form.append('file_type', 'dem')
        await api.post(`/surveys/${sid}/upload`, form)
      }

      setUploadProgress('')
      setStatus('processing')

      // Start processing
      const processParams = new URLSearchParams()
      if (refElev) processParams.append('reference_elevation', refElev)
      await api.post(`/surveys/${sid}/process?${processParams}`)

      // Poll
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await api.get(`/surveys/${sid}/status`)
          setSteps(data.pipeline_steps || [])
          if (data.status === 'complete' || data.status === 'failed') {
            clearInterval(pollRef.current)
            setStatus(data.status)
            if (data.status === 'complete') setResults(data)
          }
        } catch { clearInterval(pollRef.current) }
      }, 2000)

    } catch (err) {
      console.error(err)
      setStatus('failed')
    }
  }

  const running = status === 'uploading' || status === 'processing'
  const selectedSite = sites.find(s => String(s.id) === siteId)

  return (
    <div style={{flex:1, overflowY:'auto'}} className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Upload & Process</div>
          <div className="page-sub">Steps 2–9: Data collection → photogrammetry → volume → reports</div>
        </div>
        <div className="header-actions">
          <button className="btn-accent" onClick={startPipeline} disabled={running}>
            {running ? <><Loader size={14} className="spin"/> {uploadProgress || 'Processing…'}</>
                     : <><Play size={14}/> Run Pipeline</>}
          </button>
        </div>
      </div>

      <div style={{padding:28, maxWidth:900}}>

        {/* Config row */}
        <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:14, marginBottom:20}}>
          <div>
            <label style={{fontSize:11, color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:6}}>Mine Site *</label>
            <select value={siteId} onChange={e => setSiteId(e.target.value)}
              style={{width:'100%', padding:'9px 12px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:13}}>
              <option value="">— select site —</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {[
            ['Drone Model', droneModel, setDroneModel, 'text', 'DJI Matrice 300'],
            ['Flying Height (m)', flyingHeight, setFlyingHeight, 'number', '120'],
            ['Ref. Elevation (m)', refElev, setRefElev, 'number', 'auto'],
          ].map(([lbl, val, set, type, ph]) => (
            <div key={lbl}>
              <label style={{fontSize:11, color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:6}}>{lbl}</label>
              <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph}
                style={{width:'100%', padding:'9px 12px', background:'var(--card)', border:'1px solid var(--border)',
                  borderRadius:8, color:'var(--text)', fontSize:13, outline:'none'}}
                onFocus={e=>e.target.style.borderColor='var(--accent)'}
                onBlur={e=>e.target.style.borderColor='var(--border)'} />
            </div>
          ))}
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e=>{e.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)}
          onDrop={handleDrop}
          onClick={()=>document.getElementById('img-input').click()}
          style={{
            border:`2px dashed ${dragging?'var(--accent)':'var(--border)'}`,
            borderRadius:12, padding:'48px 40px', textAlign:'center',
            background: dragging ? 'var(--accent-dim)' : 'var(--card)',
            cursor:'pointer', transition:'border-color .2s, background .2s', marginBottom:16
          }}>
          <CloudUpload size={44} style={{color:'var(--muted)', display:'block', margin:'0 auto 12px'}}/>
          <div style={{fontSize:15, fontWeight:700, marginBottom:6}}>
            {imageFiles.length ? `${imageFiles.length} image${imageFiles.length>1?'s':''} ready` : 'Drop drone images here'}
          </div>
          <div style={{fontSize:13, color:'var(--muted)', marginBottom:16}}>
            JPG · TIF · DNG · PNG · RAW — all geotagged images from the flight
          </div>
          <div style={{display:'flex', gap:10, justifyContent:'center'}}>
            <button className="btn-accent" style={{fontSize:13}} onClick={e=>{e.stopPropagation();document.getElementById('img-input').click()}}>
              Browse Images
            </button>
            <button className="btn-outline" style={{fontSize:13}} onClick={e=>{e.stopPropagation();document.getElementById('gcp-input').click()}}>
              <MapPin size={13}/> {gcpFile ? gcpFile.name : 'Import GCP (.csv / .txt)'}
            </button>
            <button className="btn-outline" style={{fontSize:13}} onClick={e=>{e.stopPropagation();document.getElementById('dem-input').click()}}>
              {demFile ? demFile.name : 'Upload DEM GeoTIFF'}
            </button>
          </div>
          <input id="img-input" type="file" multiple accept=".jpg,.jpeg,.png,.tif,.tiff,.dng,.raw" style={{display:'none'}} onChange={e=>handleImages(e.target.files)} />
          <input id="gcp-input" type="file" accept=".csv,.txt" style={{display:'none'}} onChange={e=>setGcpFile(e.target.files[0])} />
          <input id="dem-input" type="file" accept=".tif,.tiff" style={{display:'none'}} onChange={e=>setDemFile(e.target.files[0])} />
        </div>

        {/* File summary */}
        {(imageFiles.length > 0 || gcpFile || demFile) && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16}}>
            {imageFiles.length > 0 && (
              <div style={{background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:14}}>
                <div style={{fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10}}>
                  Images ({imageFiles.length})
                </div>
                {imageFiles.slice(0,3).map((f,i) => (
                  <div key={i} style={{display:'flex', gap:8, padding:'5px 0', borderBottom:'1px solid var(--border)', fontSize:12}}>
                    <FileText size={13} style={{color:'var(--accent)', flexShrink:0, marginTop:1}}/>
                    <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{f.name}</span>
                    <span style={{color:'var(--muted)', fontSize:11}}>{(f.size/1024/1024).toFixed(1)}MB</span>
                  </div>
                ))}
                {imageFiles.length > 3 && <div style={{fontSize:11, color:'var(--muted)', textAlign:'center', paddingTop:6}}>+{imageFiles.length-3} more</div>}
              </div>
            )}
            {gcpFile && (
              <div style={{background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:14}}>
                <div style={{fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10}}>GCP File</div>
                <div style={{display:'flex', gap:8, fontSize:12}}>
                  <MapPin size={13} style={{color:'var(--accent)', flexShrink:0, marginTop:1}}/>
                  <span>{gcpFile.name}</span>
                </div>
                <div style={{fontSize:11, color:'var(--muted)', marginTop:6}}>Will be parsed for GCP count + coordinates</div>
              </div>
            )}
            {demFile && (
              <div style={{background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:14}}>
                <div style={{fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10}}>DEM / GeoTIFF</div>
                <div style={{display:'flex', gap:8, fontSize:12}}>
                  <FileText size={13} style={{color:'var(--blue)', flexShrink:0, marginTop:1}}/>
                  <span>{demFile.name}</span>
                </div>
                <div style={{fontSize:11, color:'var(--muted)', marginTop:6}}>{(demFile.size/1024/1024).toFixed(1)} MB · ODM step will be skipped</div>
              </div>
            )}
          </div>
        )}

        {/* ODM notice */}
        <div style={{background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.2)',
          borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:12, color:'var(--muted2)'}}>
          <span style={{color:'var(--blue)', fontWeight:700}}>NodeODM (Photogrammetry):</span>
          {' '}If not running, upload a pre-processed DEM GeoTIFF directly to skip to Step 6.
          To enable: <code style={{background:'var(--surface)', padding:'2px 6px', borderRadius:4}}>docker run -p 3000:3000 opendronemap/nodeodm</code>
        </div>

        {/* Pipeline */}
        <div style={{background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:18}}>
          <div style={{fontSize:13, fontWeight:700, marginBottom:14}}>Processing Pipeline</div>
          {(steps.length > 0 ? steps : [
            {id:'preprocessing',  name:'Image Preprocessing',         status:'pending', detail:'Blur detection · geotag extraction · camera calibration check'},
            {id:'odm',            name:'Photogrammetry (NodeODM)',     status:'pending', detail:'Image alignment · dense point cloud · DSM/DTM · orthomosaic'},
            {id:'gis',            name:'GIS Data Processing',          status:'pending', detail:'DEM import · CRS validation · coordinate setup'},
            {id:'volume',         name:'Spatial Analysis & Volumes',   status:'pending', detail:'TIN volume · cut/fill · pit analysis · haul road'},
            {id:'map_production', name:'Map Production (Contours)',    status:'pending', detail:'1m contour lines · cross sections · DEM tiles'},
            {id:'reporting',      name:'Output & Report Generation',   status:'pending', detail:'PDF report · Excel export · GIS files ready for download'},
          ]).map((s, i, arr) => <StepRow key={s.id || i} step={s} isLast={i===arr.length-1}/>)}
        </div>

        {/* Results */}
        {status === 'complete' && results && (
          <div style={{background:'rgba(34,197,94,0.07)', border:'1px solid rgba(34,197,94,0.3)',
            borderRadius:10, padding:20, marginTop:16}} className="fade-in">
            <div style={{fontSize:14, fontWeight:700, color:'var(--green)', marginBottom:14}}>✓ Pipeline Complete</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16}}>
              {[
                ['Stockpile Vol.', results.stockpile_volume != null ? `${(results.stockpile_volume).toLocaleString('en-IN')} m³` : '—'],
                ['Cut Volume',     results.cut_volume       != null ? `${(results.cut_volume).toLocaleString('en-IN')} m³`       : '—'],
                ['Net Change',     results.net_change       != null ? `${results.net_change > 0 ? '+' : ''}${results.net_change.toLocaleString('en-IN')} m³` : '—'],
                ['DEM Resolution', results.dem_resolution   != null ? `${results.dem_resolution} m/px` : '—'],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{background:'var(--card)', borderRadius:8, padding:'12px 14px', border:'1px solid var(--border)'}}>
                  <div style={{fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5}}>{lbl}</div>
                  <div style={{fontSize:17, fontWeight:800, fontFamily:'monospace', color:'var(--accent)'}}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex', gap:10}}>
              <button className="btn-accent" onClick={() => navigate('/reports')}>View Reports</button>
              {siteId && <button className="btn-outline" onClick={() => navigate(`/sites/${siteId}`)}>View on Map</button>}
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div style={{background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.3)',
            borderRadius:10, padding:16, marginTop:16, fontSize:13, color:'var(--red)'}}>
            Pipeline encountered an error. Check the step details above for specifics.
          </div>
        )}
      </div>
      <style>{`@keyframes indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  )
}
