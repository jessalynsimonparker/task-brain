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
         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  input, textarea, select, button { font-family: inherit; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--surface2); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  /* ── Dark theme (default) ── */
  :root {
    --bg:           #0f172a;
    --surface:      #1e293b;
    --surface2:     #0f172a;
    --border:       #334155;
    --border2:      #475569;
    --accent:       #3b82f6;
    --accent-dim:   #2563eb;
    --text:         #f1f5f9;
    --text-muted:   #94a3b8;
    --text-faint:   #475569;
    --danger:       #f87171;
    --success:      #4ade80;
    --warning:      #facc15;
    --tag-li:       #60a5fa;
    --tag-pl:       #a78bfa;
    --tag-em:       #4ade80;
    --tag-wp:       #fb923c;
    --tag-ot:       #94a3b8;
  }

  /* ── Light theme ── */
  [data-theme="light"] {
    --bg:           #eef3ff;
    --surface:      #ffffff;
    --surface2:     #f4f7ff;
    --border:       #c8d8f8;
    --border2:      #a8bfef;
    --accent:       #2563eb;
    --accent-dim:   #1d4ed8;
    --text:         #0c1e40;
    --text-muted:   #4a6fa8;
    --text-faint:   #c8d8f8;
    --danger:       #dc2626;
    --success:      #16a34a;
    --warning:      #d97706;
    --tag-li:       #2563eb;
    --tag-pl:       #7c3aed;
    --tag-em:       #16a34a;
    --tag-wp:       #ea580c;
    --tag-ot:       #4a6fa8;
  }

  /* datetime-local input color fix */
  input[type="datetime-local"], input[type="date"] { color-scheme: dark; }
  [data-theme="light"] input[type="datetime-local"],
  [data-theme="light"] input[type="date"] { color-scheme: light; }
`;

const TABS = ['Tasks', 'Memory Log', 'Calendar'];

const s = {
  app:        { minHeight: '100vh', padding: '24px 16px', maxWidth: '900px', margin: '0 auto' },
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' },
  logo:       { fontSize: '20px', fontWeight: '700', color: 'var(--text)', letterSpacing: '-0.02em' },
  logoAccent: { color: 'var(--accent)' },
  headerRight:{ display: 'flex', alignItems: 'center', gap: '12px' },
  dateLbl:    { fontSize: '12px', color: 'var(--text-muted)' },
  themeBtn:   {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px',
    color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px', lineHeight: 1,
    padding: '5px 9px',
  },
  tabRow:     { display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '0' },
  tab: (active) => ({
    background: 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: active ? '600' : '400',
    padding: '8px 16px',
    marginBottom: '-1px',
  }),
};

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
    setStatus('Uploading…');
    const path = `screenshots/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('task-attachments').upload(path, file);
    if (error) { setStatus(`Upload failed: ${error.message}`); setUploading(false); return; }
    const { data } = supabase.storage.from('task-attachments').getPublicUrl(path);
    setStatus('Uploaded!');
    setUploading(false);
    setFile(null);
    setPreview(null);
    onUploaded?.(data.publicUrl);
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px dashed var(--border2)', borderRadius: '10px',
      color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', marginBottom: '16px',
      padding: '14px', textAlign: 'center',
    }}>
      <label style={{ color: 'var(--accent)', cursor: 'pointer' }}>
        + Attach screenshot
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePick} />
      </label>
      {preview && (
        <div>
          <img src={preview} alt="preview" style={{ maxWidth: '200px', maxHeight: '120px', borderRadius: '6px', marginTop: '8px' }} />
          <br />
          <button
            style={{ background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '13px', marginTop: '8px', padding: '6px 16px' }}
            onClick={handleUpload} disabled={uploading}
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
    return <div style={{ ...s.app, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading…</div>;
  }

  return (
    <>
      <style>{GLOBAL_STYLE}</style>
      <div style={s.app}>
        <div style={s.header}>
          <div style={s.logo}>Task<span style={s.logoAccent}>Brain</span></div>
          <div style={s.headerRight}>
            <div style={s.dateLbl}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <button style={s.themeBtn} onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              title="Toggle light/dark">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        <StatsBar tasks={tasks} memories={memories} onNavigate={setActiveTab} />

        <div style={s.tabRow}>
          {TABS.map((tab) => (
            <button key={tab} style={s.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Tasks' && (
          <>
            <AddTaskForm onAdded={loadTasks} />
            <ScreenshotUploader
              onUploaded={(url) => {
                navigator.clipboard?.writeText(url);
                alert(`Screenshot uploaded! URL copied to clipboard.\nPaste it into a task note.`);
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
