// AddTaskForm.jsx — inline form to create a new task

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const s = {
  form:     { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '24px' },
  title:    { fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '14px' },
  row:      { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' },
  input:    { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '14px', padding: '8px 12px', outline: 'none', flex: 1, minWidth: '160px' },
  select:   { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '14px', padding: '8px 12px', outline: 'none' },
  textarea: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '14px', padding: '8px 12px', outline: 'none', width: '100%', resize: 'vertical', minHeight: '60px', boxSizing: 'border-box' },
  btn:      { background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: '8px 20px' },
  error:    { color: 'var(--danger)', fontSize: '13px', marginTop: '8px' },
  label:    { color: 'var(--text-muted)', fontSize: '13px', alignSelf: 'center' },
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
    setSaving(true);
    setError('');
    const payload = { title: form.title.trim(), notes: form.notes.trim() || null, category: form.category, reminder_time: form.reminder_time || null, due_date: form.due_date || null };
    const { error: err } = await supabase.from('tasks').insert([payload]);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm(EMPTY);
    onAdded?.();
  }

  return (
    <form style={s.form} onSubmit={handleSubmit}>
      <div style={s.title}>+ Add Task</div>
      <div style={s.row}>
        <input style={s.input} placeholder="Task title *" value={form.title} onChange={e => set('title', e.target.value)} />
        <select style={s.select} value={form.category} onChange={e => set('category', e.target.value)}>
          <option value="call">Call</option>
          <option value="email">Email</option>
          <option value="linkedin">LinkedIn</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div style={{ marginBottom: '10px' }}>
        <textarea
          style={{ ...s.textarea, borderColor: uploading ? 'var(--accent)' : 'var(--border)' }}
          placeholder="Notes (optional) — paste a screenshot with Cmd+V"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          onPaste={handlePaste}
        />
        {uploading && <div style={{ color: 'var(--accent)', fontSize: '12px', marginTop: '4px' }}>Uploading screenshot…</div>}
        {pastedImage && !uploading && (
          <img src={pastedImage} alt="pasted" style={{ maxWidth: '200px', maxHeight: '100px', borderRadius: '6px', marginTop: '6px' }} />
        )}
      </div>
      <div style={s.row}>
        <label style={s.label}>Reminder</label>
        <input style={s.input} type="datetime-local" value={form.reminder_time} onChange={e => set('reminder_time', e.target.value)} />
        <label style={s.label}>Due date</label>
        <input style={s.input} type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        <button style={s.btn} type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Task'}</button>
      </div>
      {error && <div style={s.error}>{error}</div>}
    </form>
  );
}
