// App.jsx — root component

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabase';
import StatsBar from './components/StatsBar';
import TaskList from './components/TaskList';
import AddTaskForm from './components/AddTaskForm';
import MemoryLog from './components/MemoryLog';
import AddMemoryForm from './components/AddMemoryForm';
import CalendarView from './components/CalendarView';

const GLOBAL_STYLE = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: var(--bg);
         font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
         -webkit-font-smoothing: antialiased; }
  input, textarea, select, button { font-family: inherit; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }

  /* ── Dark theme ── */
  :root {
    --bg:           #0a0f1e;
    --surface:      #111827;
    --surface2:     #0d1424;
    --surface-hover:#162033;
    --border:       #1f2d45;
    --border2:      #2d4060;
    --accent:       #3b82f6;
    --accent-glow:  rgba(59,130,246,0.2);
    --accent-dim:   #2563eb;
    --text:         #f0f6ff;
    --text-muted:   #8ba3c7;
    --text-faint:   #3d5470;
    --danger:       #f87171;
    --danger-glow:  rgba(248,113,113,0.15);
    --success:      #34d399;
    --warning:      #fbbf24;
    --shadow-sm:    0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3);
    --shadow-md:    0 4px 16px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3);
    --shadow-card:  0 2px 8px rgba(0,0,0,0.4);
    --shadow-hover: 0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px var(--border2);
    --tag-li:       #60a5fa;
    --tag-pl:       #a78bfa;
    --tag-em:       #34d399;
    --tag-wp:       #fb923c;
    --tag-ot:       #8ba3c7;
    --radius:       12px;
    --radius-sm:    8px;
  }

  /* ── Light theme ── */
  [data-theme="light"] {
    --bg:           #f0f4ff;
    --surface:      #ffffff;
    --surface2:     #f5f8ff;
    --surface-hover:#eef2ff;
    --border:       #dce5f5;
    --border2:      #b8cce8;
    --accent:       #2563eb;
    --accent-glow:  rgba(37,99,235,0.12);
    --accent-dim:   #1d4ed8;
    --text:         #0c1e40;
    --text-muted:   #4a6fa8;
    --text-faint:   #b8cce8;
    --danger:       #dc2626;
    --danger-glow:  rgba(220,38,38,0.1);
    --success:      #059669;
    --warning:      #d97706;
    --shadow-sm:    0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05);
    --shadow-md:    0 4px 16px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.06);
    --shadow-card:  0 2px 8px rgba(0,0,0,0.07);
    --shadow-hover: 0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px var(--border2);
    --tag-li:       #2563eb;
    --tag-pl:       #7c3aed;
    --tag-em:       #059669;
    --tag-wp:       #ea580c;
    --tag-ot:       #4a6fa8;
    --radius:       12px;
    --radius-sm:    8px;
  }

  input[type="datetime-local"], input[type="date"] { color-scheme: dark; }
  [data-theme="light"] input[type="datetime-local"],
  [data-theme="light"] input[type="date"] { color-scheme: light; }

  /* Focus glow on all inputs */
  input:focus, textarea:focus, select:focus {
    outline: none !important;
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 3px var(--accent-glow) !important;
  }

  /* Smooth transitions on interactive elements */
  button { transition: all 0.15s ease; }
  button:hover { opacity: 0.9; }
  button:active { transform: scale(0.97); }
`;

const TABS = ['Tasks', 'Memory Log', 'Calendar'];

// ─── Screenshot upload ────────────────────────────────────────────────────────
function ScreenshotUploader({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);

  function handlePick(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStatus('');
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    const path = `screenshots/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('task-attachments').upload(path, file);
    if (error) { setStatus(`Upload failed: ${error.message}`); setUploading(false); return; }
    const { data } = supabase.storage.from('task-attachments').getPublicUrl(path);
    setStatus('Uploaded!');
    setUploading(false); setFile(null); setPreview(null);
    onUploaded?.(data.publicUrl);
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px dashed var(--border2)',
      borderRadius: 'var(--radius)', color: 'var(--text-muted)',
      fontSize: '13px', marginBottom: '16px', padding: '14px', textAlign: 'center',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <label style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}>
        + Attach screenshot
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePick} />
      </label>
      {preview && (
        <div>
          <img src={preview} alt="preview" style={{ maxWidth: '200px', maxHeight: '120px', borderRadius: '8px', marginTop: '8px' }} />
          <br />
          <button
            onClick={handleUpload} disabled={uploading}
            style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginTop: '8px', padding: '7px 18px', boxShadow: '0 2px 8px var(--accent-glow)' }}
          >
            {uploading ? 'Uploading…' : 'Save attachment'}
          </button>
        </div>
      )}
      {status && <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '6px' }}>{status}</div>}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tasks, setTasks] = useState([]);
  const [memories, setMemories] = useState([]);
  const [activeTab, setActiveTab] = useState('Tasks');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('tb-theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tb-theme', theme);
  }, [theme]);

  const loadTasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*').order('added_at', { ascending: false });
    if (data) setTasks(data);
  }, []);

  const loadMemories = useCallback(async () => {
    const { data } = await supabase.from('memories').select('*').order('added_at', { ascending: false });
    if (data) setMemories(data);
  }, []);

  useEffect(() => {
    Promise.all([loadTasks(), loadMemories()]).then(() => setLoading(false));
  }, [loadTasks, loadMemories]);

  useEffect(() => {
    const taskSub = supabase.channel('tasks-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadTasks)
      .subscribe();
    const memorySub = supabase.channel('memories-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memories' }, loadMemories)
      .subscribe();
    return () => { supabase.removeChannel(taskSub); supabase.removeChannel(memorySub); };
  }, [loadTasks, loadMemories]);

  if (loading) {
    return (
      <>
        <style>{GLOBAL_STYLE}</style>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px', letterSpacing: '0.05em' }}>
          Loading…
        </div>
      </>
    );
  }

  return (
    <>
      <style>{GLOBAL_STYLE}</style>
      <div style={{ minHeight: '100vh', padding: '28px 20px', maxWidth: '940px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div style={{ fontSize: '21px', fontWeight: '700', color: 'var(--text)', letterSpacing: '-0.03em' }}>
            Task<span style={{ color: 'var(--accent)' }}>Brain</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-faint)', fontWeight: 500 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              title="Toggle theme"
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer',
                fontSize: '14px', lineHeight: 1, padding: '6px 10px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <StatsBar tasks={tasks} memories={memories} onNavigate={setActiveTab} />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '2px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'transparent', border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--text)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: '14px',
                fontWeight: activeTab === tab ? '600' : '400',
                padding: '10px 18px', marginBottom: '-1px',
                letterSpacing: '-0.01em',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'Tasks' && (
          <>
            <AddTaskForm onAdded={loadTasks} />
            <ScreenshotUploader
              onUploaded={(url) => {
                navigator.clipboard?.writeText(url);
                alert('Screenshot uploaded! URL copied to clipboard.');
              }}
            />
            <TaskList tasks={tasks} />
          </>
        )}
        {activeTab === 'Memory Log' && (
          <>
            <AddMemoryForm onAdded={loadMemories} />
            <MemoryLog memories={memories} />
          </>
        )}
        {activeTab === 'Calendar' && <CalendarView tasks={tasks} />}
      </div>
    </>
  );
}
