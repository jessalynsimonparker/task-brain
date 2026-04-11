// App.jsx — root component
// Loads tasks + memories from Supabase, subscribes to realtime changes,
// and renders the full dashboard with tab navigation.

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabase';
import StatsBar from './components/StatsBar';
import TaskList from './components/TaskList';
import AddTaskForm from './components/AddTaskForm';
import MemoryLog from './components/MemoryLog';
import AddMemoryForm from './components/AddMemoryForm';
import CalendarView from './components/CalendarView';

// ─── Global styles ────────────────────────────────────────────────────────────
const GLOBAL_STYLE = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #0f0f0f; color: #e0e0e0;
         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  input, textarea, select, button { font-family: inherit; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #111; }
  ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
`;

const TABS = ['Tasks', 'Memory Log', 'Calendar'];

const s = {
  app: { minHeight: '100vh', padding: '24px 16px', maxWidth: '900px', margin: '0 auto' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' },
  logo: { fontSize: '20px', fontWeight: '700', color: '#e0e0e0', letterSpacing: '-0.02em' },
  logoAccent: { color: '#4f46e5' },
  tabRow: { display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #2a2a2a', paddingBottom: '0' },
  tab: (active) => ({
    background: 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid #4f46e5' : '2px solid transparent',
    color: active ? '#e0e0e0' : '#555',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: active ? '600' : '400',
    padding: '8px 16px',
    marginBottom: '-1px',
  }),
  uploadBox: {
    background: '#1a1a1a',
    border: '1px dashed #333',
    borderRadius: '10px',
    color: '#555',
    cursor: 'pointer',
    fontSize: '13px',
    marginBottom: '16px',
    padding: '14px',
    textAlign: 'center',
  },
  uploadLabel: { color: '#4f46e5', cursor: 'pointer' },
  previewImg: { maxWidth: '200px', maxHeight: '120px', borderRadius: '6px', marginTop: '8px' },
  uploadBtn: {
    background: '#4f46e5',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    marginTop: '8px',
    padding: '6px 16px',
  },
  uploadStatus: { color: '#888', fontSize: '12px', marginTop: '6px' },
};

// ─── Screenshot upload (task attachment) ──────────────────────────────────────
// Stores images in Supabase Storage bucket "task-attachments".
// The bucket must be created in Supabase dashboard > Storage (see SETUP.md).
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

    // Upload to Supabase Storage under "task-attachments" bucket
    const path = `screenshots/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('task-attachments').upload(path, file);

    if (error) {
      setStatus(`Upload failed: ${error.message}`);
      setUploading(false);
      return;
    }

    // Get the public URL so we can store it on a task
    const { data } = supabase.storage.from('task-attachments').getPublicUrl(path);
    setStatus('Uploaded!');
    setUploading(false);
    setFile(null);
    setPreview(null);
    onUploaded?.(data.publicUrl);
  }

  return (
    <div style={s.uploadBox}>
      <label style={s.uploadLabel}>
        + Attach screenshot
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePick} />
      </label>
      {preview && (
        <div>
          <img src={preview} alt="preview" style={s.previewImg} />
          <br />
          <button style={s.uploadBtn} onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Save attachment'}
          </button>
        </div>
      )}
      {status && <div style={s.uploadStatus}>{status}</div>}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tasks, setTasks] = useState([]);
  const [memories, setMemories] = useState([]);
  const [activeTab, setActiveTab] = useState('Tasks');
  const [loading, setLoading] = useState(true);

  // ── Initial data load ────────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('added_at', { ascending: false });
    if (data) setTasks(data);
  }, []);

  const loadMemories = useCallback(async () => {
    const { data } = await supabase
      .from('memories')
      .select('*')
      .order('added_at', { ascending: false });
    if (data) setMemories(data);
  }, []);

  useEffect(() => {
    Promise.all([loadTasks(), loadMemories()]).then(() => setLoading(false));
  }, [loadTasks, loadMemories]);

  // ── Realtime subscriptions — no page refresh needed ──────────────────────
  useEffect(() => {
    // Subscribe to all changes on the tasks table
    const taskSub = supabase
      .channel('tasks-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadTasks(); // Re-fetch on any insert / update / delete
      })
      .subscribe();

    // Subscribe to all changes on the memories table
    const memorySub = supabase
      .channel('memories-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memories' }, () => {
        loadMemories();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(taskSub);
      supabase.removeChannel(memorySub);
    };
  }, [loadTasks, loadMemories]);

  if (loading) {
    return (
      <div style={{ ...s.app, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
        Loading…
      </div>
    );
  }

  return (
    <>
      <style>{GLOBAL_STYLE}</style>
      <div style={s.app}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.logo}>
            Task<span style={s.logoAccent}>Brain</span>
          </div>
          <div style={{ fontSize: '12px', color: '#444' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Stats bar */}
        <StatsBar tasks={tasks} memories={memories} />

        {/* Tab navigation */}
        <div style={s.tabRow}>
          {TABS.map((tab) => (
            <button key={tab} style={s.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'Tasks' && (
          <>
            <AddTaskForm onAdded={loadTasks} />
            <ScreenshotUploader
              onUploaded={(url) => {
                // Copy URL to clipboard so the user can paste it into a task note
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

        {activeTab === 'Calendar' && (
          <CalendarView tasks={tasks} />
        )}
      </div>
    </>
  );
}
