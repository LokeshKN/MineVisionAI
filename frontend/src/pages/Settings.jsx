import { useAuth } from '../AuthContext'
import { User, Bell, Shield, Database, Wifi } from 'lucide-react'

const SECTIONS = [
  {
    icon: User,
    title: 'User Profile',
    desc: 'Name, email, role, and password',
    fields: [
      { label: 'Full Name', value: 'Lokesh K N' },
      { label: 'Email', value: 'admin@minevisionai.in' },
      { label: 'Role', value: 'Developer (Admin)' },
      { label: 'Organisation', value: 'MineVisionAI Demo Client' },
    ]
  },
  {
    icon: Database,
    title: 'Data & Storage',
    desc: 'Upload directory, report retention, export formats',
    fields: [
      { label: 'Upload Directory', value: './backend/uploads' },
      { label: 'Report Retention', value: '365 days' },
      { label: 'Default Export Format', value: 'GeoTIFF + PDF + Excel' },
      { label: 'Database', value: 'SQLite (demo) → PostgreSQL + PostGIS (production)' },
    ]
  },
  {
    icon: Shield,
    title: 'Processing Defaults',
    desc: 'ODM pipeline settings, DEM resolution, contour interval',
    fields: [
      { label: 'DEM Resolution', value: '1 m' },
      { label: 'DSM Resolution', value: '0.5 m' },
      { label: 'Contour Interval', value: '1 m' },
      { label: 'Volume Method', value: 'TIN (Triangulated Irregular Network)' },
      { label: 'Coordinate System', value: 'WGS84 / UTM Zone 44N' },
    ]
  },
  {
    icon: Wifi,
    title: 'Integrations',
    desc: 'OpenDroneMap, GDAL, external APIs',
    fields: [
      { label: 'ODM Endpoint', value: 'http://localhost:3000 (not connected in demo)' },
      { label: 'GDAL Version', value: 'Via rasterio (production)' },
      { label: 'Map Tiles', value: 'OpenStreetMap (demo) → Mapbox Satellite (production)' },
    ]
  },
]

export default function Settings() {
  const { user } = useAuth()

  return (
    <div style={{ flex: 1, overflowY: 'auto' }} className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-sub">Platform configuration and preferences</div>
        </div>
      </div>

      <div style={{ padding: '28px', maxWidth: 760 }}>
        {SECTIONS.map(({ icon: Icon, title, desc, fields }) => (
          <div key={title} style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, marginBottom: 20, overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{desc}</div>
              </div>
            </div>
            <div style={{ padding: '4px 20px 12px' }}>
              {fields.map(({ label, value }) => (
                <div className="info-row" key={label}>
                  <span className="info-key" style={{ fontSize: 13 }}>{label}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted2)', fontFamily: label.toLowerCase().includes('dir') || label.toLowerCase().includes('endpoint') ? 'monospace' : undefined }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 10, padding: '14px 18px', fontSize: 13, color: 'var(--muted2)', lineHeight: 1.6
        }}>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Demo Mode</span> — All settings are read-only. In production, connect PostgreSQL + PostGIS, configure ODM endpoint, and set up MinIO for object storage.
        </div>
      </div>
    </div>
  )
}
