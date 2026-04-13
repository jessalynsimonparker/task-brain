// AddTaskForm.jsx

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const inp = {
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '14px',
  padding: '9px 13px', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
};

const EMPTY = { title: '', notes: '', category: 'other', reminder_time: '', due_date: '' };

export default function AddTaskForm({ onAdded }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pastedImage, setPastedImage] = useState(null);

  async function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      e.preventDefault();
      const file = item.getAsFile();
      if (!file) return;
      setPastedImage(URL.createObjectURL(file));
      setUploading(true);
      const path = `screenshots/${Date.now()}.png`;
      const { error: uploadErr } = await supabase.storage.from('task-attachments').upload(path, file);
      if (uploadErr) { setError(`Image upload failed: ${uploadErr.message}`); setUploading(false); return; }
      const { data } = supabase.storage.from('task-attachments').getPublicUrl(path);
      setForm(f => ({ ...f, notes: f.notes ? `${f.notes}\n${data.publicUrl}` : data.publicUrl }));
      setUploading(false);
      return;
    }
  }

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    const { error: err } = await supabase.from('tasks').insert([{
      title: form.title.trim(), notes: form.notes.trim() || null,
      category: form.category, reminder_time: form.reminder_time || null, due_date: form.due_date || null,
    }]);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm(EMPTY); onAdded?.();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '20px', marginBottom: '20px',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '14px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        + Add Task
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <input style={{ ...inp, flex: 1, minWidth: '160px' }} placeholder="Task title *" value={form.title} onChange={e => set('title', e.target.value)} />
        <select style={{ ...inp }} value={form.category} onChange={e => set('category', e.target.value)}>
          <option value="call">Call</option>
          <option value="email">Email</option>
          <option value="linkedin">LinkedIn</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <textarea
          style={{ ...inp, width: '100%', resize: 'vertical', minHeight: '64px', boxSizing: 'border-box', borderColor: uploading ? 'var(--accent)' : 'var(--border)' }}
          placeholder="Notes (optional) — paste a screenshot with Cmd+V"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          onPaste={handlePaste}
        />
        {uploading && <div style={{ color: 'var(--accent)', fontSize: '12px', marginTop: '4px' }}>Uploading screenshot…</div>}
        {pastedImage && !uploading && <img src={pastedImage} alt="pasted" style={{ maxWidth: '200px', maxHeight: '100px', borderRadius: '8px', marginTop: '6px' }} />}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ color: 'var(--text-faint)', fontSize: '12px', fontWeight: 500 }}>Reminder</label>
        <input style={{ ...inp, flex: 1, minWidth: '160px' }} type="datetime-local" value={form.reminder_time} onChange={e => set('reminder_time', e.target.value)} />
        <label style={{ color: 'var(--text-faint)', fontSize: '12px', fontWeight: 500 }}>Due</label>
        <input style={{ ...inp, flex: 1, minWidth: '120px' }} type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        <button
          type="submit" disabled={saving}
          style={{
            background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)',
            color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
            padding: '9px 22px', boxShadow: '0 2px 10px var(--accent-glow)',
            whiteSpace: 'nowrap',
          }}
        >
          {saving ? 'Saving…' : 'Add Task'}
        </button>
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '10px' }}>{error}</div>}
    </form>
  );
}
