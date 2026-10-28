import React from 'react';
import { Database, Server, ShieldCheck, GitBranch, TerminalSquare, AlertTriangle } from 'lucide-react';
import { SupabaseConnectivityMonitor } from './SupabaseConnectivityMonitor';
import { DataBridgeMonitor } from './DataBridgeMonitor';

/**
 * Legacy filename retained so existing imports/routes do not break.
 * This page documents the active Hostinger MySQL architecture & environment policy.
 */
export const SupabaseSqlArchitecture: React.FC = () => {
  const activeEnvVars = [
    'NODE_ENV=production',
    'APP_URL=https://akkoperasional.com',
    'DB_HOST=localhost',
    'DB_PORT=3306',
    'DB_NAME=u649808503_ops_node',
    'DB_USER=u649808503_ops_node',
    'DB_PASSWORD=<secret>',
    'SESSION_SECRET=<minimal 32 karakter acak>',
    'BOOTSTRAP_ADMIN_EMAIL=<hanya saat bootstrap awal>',
    'BOOTSTRAP_ADMIN_PASSWORD=<hapus setelah login pertama>',
    'BOOTSTRAP_ADMIN_NAME=<opsional, hapus setelah bootstrap>',
    'WHATSAPP_API_KEY=<secret>'
  ];

  const removedApkVars = [
    'APK_KEYSTORE_PASSWORD',
    'APK_KEY_PASSWORD',
    'APK_KEY_ALIAS',
    'APK_PORTAL_URL',
    'APK_FALLBACK_PORTAL_URL'
  ];

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400"><Database className="w-6 h-6" /></div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Arsitektur Database Hostinger MySQL</h2>
            <p className="text-sm text-slate-400 mt-1">
              Frontend React tidak terhubung langsung ke database. Semua operasi data melewati Express API agar kredensial database, session secret, dan API key tetap aman di sisi server (tanpa prefix <code>VITE_</code>).
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {[
          { icon: GitBranch, title: 'Frontend', value: 'React + Vite', detail: 'Browser hanya memanggil /api/*' },
          { icon: Server, title: 'Backend', value: 'Express Node.js 24', detail: 'server.ts + HttpOnly Session Cookie' },
          { icon: Database, title: 'Database', value: 'Hostinger MySQL', detail: 'mysql2 connection pool' },
          { icon: ShieldCheck, title: 'Secrets', value: 'Server-Side ENV', detail: 'Dilarang memakai prefix VITE_ untuk secret/password' }
        ].map(({ icon: Icon, title, value, detail }) => (
          <div key={title} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <Icon className="w-5 h-5 text-blue-400" />
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-3">{title}</div>
            <div className="font-extrabold text-white mt-1">{value}</div>
            <div className="text-xs text-slate-400 mt-1">{detail}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold">
          <TerminalSquare className="w-5 h-5 text-emerald-400" />
          Environment Variables Website Hostinger (Pertahankan)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
          {activeEnvVars.map(item => (
            <div key={item} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300">
              {item}
            </div>
          ))}
        </div>
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/50 text-xs text-amber-200 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5 text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Aturan Keamanan Bootstrap &amp; Environment Hostinger:
          </div>
          <ul className="list-disc list-inside space-y-1 text-amber-200/90">
            <li><strong>Jangan pakai <code>VITE_</code></strong> untuk password, secret, atau kredensial apa pun.</li>
            <li><code>BOOTSTRAP_ADMIN_*</code> hanya untuk membuat Super Admin pertama. Setelah Super Admin berhasil dibuat dan sudah bisa login, <strong>hapus <code>BOOTSTRAP_ADMIN_PASSWORD</code></strong> dari Hostinger (<code>BOOTSTRAP_ADMIN_EMAIL</code> &amp; <code>BOOTSTRAP_ADMIN_NAME</code> juga boleh dihapus).</li>
            <li><strong>Hapus dari Web Hostinger ENV:</strong> {removedApkVars.map(v => <code key={v} className="mx-0.5 px-1.5 py-0.5 rounded bg-slate-900 text-rose-300">{v}</code>)} karena kelima variabel <code>APK_*</code> tersebut khusus untuk proses build APK Android, bukan runtime website Node.js.</li>
          </ul>
        </div>
      </div>

      <SupabaseConnectivityMonitor />
      <DataBridgeMonitor />
    </div>
  );
};
