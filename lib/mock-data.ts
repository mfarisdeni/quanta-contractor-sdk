export const tasks = [
  { title: 'Pengecoran kolom lantai 2', meta: 'Zona A · 08:00–12:00', status: 'Berjalan', tone: 'warning' },
  { title: 'Pemeriksaan bekisting balok', meta: 'Zona B · 13:00–15:00', status: 'Belum mulai', tone: 'muted' },
  { title: 'Update progres harian', meta: 'Semua zona · Sebelum 17:00', status: 'Wajib', tone: 'danger' },
]

export const issues = [
  { title: 'Material besi tulangan terlambat', meta: 'Logistik · memengaruhi pekerjaan struktur', severity: 'Tinggi', status: 'Terbuka' },
  { title: 'Gambar kerja tangga belum disetujui', meta: 'Dokumen · menunggu review PMO', severity: 'Sedang', status: 'Menunggu' },
  { title: 'Akses alat berat terbatas', meta: 'Lapangan · Zona C', severity: 'Rendah', status: 'Dipantau' },
]

export const projects = [
  { name: 'Gedung Perkantoran Sudirman', code: 'GPR-024', progress: 68, health: 'On track', contractor: 'PT. Karya Bangun', delay: 'Tidak ada' },
  { name: 'Renovasi Pabrik Cikarang', code: 'RPC-018', progress: 42, health: 'Perlu perhatian', contractor: 'CV. Mitra Struktur', delay: '3 hari' },
  { name: 'Hunian Cluster BSD', code: 'HCB-011', progress: 84, health: 'On track', contractor: 'PT. Arsitek Nusantara', delay: 'Tidak ada' },
]

export const navItems = [
  ['Ringkasan', 'LayoutDashboard'], ['Perencanaan', 'ClipboardList'], ['Checklist Harian', 'CheckSquare'], ['Tugas Hari Ini', 'ListTodo'], ['Progress', 'TrendingUp'], ['Issues / Blockers', 'AlertTriangle'], ['Weekly Summary', 'FileText'], ['Quanta AI Assistant', 'Sparkles'], ['Notifikasi', 'Bell'], ['Project Memory', 'History'],
] as const
