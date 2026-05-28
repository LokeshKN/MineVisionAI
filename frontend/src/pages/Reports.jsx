import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Plus, Filter, FileText, FileSpreadsheet, RefreshCw } from 'lucide-react'
import api from '../api/client'

const fmtBytes = b => {
  if (!b) return '—'
  return b > 1024*1024 ? `${(b/1024/1024).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`
}
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'

export default function Reports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [newIds,  setNewIds]  = useState(new Set())
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    api.get('/reports/')
      .then(r => {
        // Mark as "new" anything generated in the last 24h
        const cutoff = Date.now() - 86400_000
        const fresh  = new Set(r.data.filter(x => new Date(x.created_at) > cutoff).map(x => x.id))
        setNewIds(fresh)
        setReports(r.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleDownload = async (rpt) => {
    try {
      const res = await api.get(`/reports/${rpt.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a   = document.createElement('a')
      a.href    = url
      a.download = `${rpt.title}${rpt.report_type === 'pdf' ? '.pdf' : '.xlsx'}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Download failed — file may not exist on disk.')
    }
  }

  return (
    <div style={{flex:1, overflowY:'auto'}} className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-sub">{reports.length} report{reports.length !== 1 ? 's' : ''} generated from processed surveys</div>
        </div>
        <div className="header-actions">
          <button className="btn-outline" onClick={load}><RefreshCw size={14}/> Refresh</button>
          <button className="btn-accent" onClick={() => navigate('/upload')}><Plus size={14}/> New Survey</button>
        </div>
      </div>

      <div style={{padding:28}}>
        {loading ? (
          <div style={{textAlign:'center', color:'var(--muted)', padding:40}}>Loading reports…</div>
        ) : reports.length === 0 ? (
          <div style={{
            background:'var(--card)', border:'2px dashed var(--border)',
            borderRadius:12, padding:'60px 40px', textAlign:'center'
          }}>
            <FileText size={48} style={{color:'var(--muted)', marginBottom:16}}/>
            <div style={{fontSize:18, fontWeight:700, marginBottom:8}}>No reports yet</div>
            <div style={{fontSize:14, color:'var(--muted)', marginBottom:24}}>
              Reports are auto-generated after each completed processing pipeline.
            </div>
            <button className="btn-accent" style={{fontSize:14, padding:'10px 24px'}}
              onClick={() => navigate('/upload')}>
              <Plus size={15}/> Run a Survey
            </button>
          </div>
        ) : (
          reports.map(rpt => (
            <div key={rpt.id}
              style={{
                background:'var(--card)', border:'1px solid var(--border)',
                borderRadius:10, padding:'14px 16px', marginBottom:10,
                display:'flex', alignItems:'center', gap:14, cursor:'pointer',
                transition:'border-color .2s'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{
                width:44, height:44, borderRadius:10, flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
                background: rpt.report_type==='pdf' ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)',
                color:       rpt.report_type==='pdf' ? 'var(--red)'          : 'var(--green)'
              }}>
                {rpt.report_type === 'pdf' ? <FileText size={20}/> : <FileSpreadsheet size={20}/>}
              </div>

              <div style={{flex:1}}>
                <div style={{fontSize:14, fontWeight:600, marginBottom:3}}>{rpt.title}</div>
                <div style={{fontSize:12, color:'var(--muted)'}}>
                  {rpt.report_type === 'pdf' ? 'PDF' : 'Excel'} · {fmtDate(rpt.created_at)} · {fmtBytes(rpt.file_size)}
                </div>
              </div>

              {newIds.has(rpt.id) && (
                <span style={{
                  fontSize:10, padding:'3px 8px', borderRadius:4, whiteSpace:'nowrap',
                  background:'rgba(59,130,246,.12)', color:'var(--blue)'
                }}>New</span>
              )}

              <button className="btn-outline" style={{fontSize:12, padding:'6px 10px', flexShrink:0}}
                onClick={() => handleDownload(rpt)} title="Download">
                <Download size={14}/>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
