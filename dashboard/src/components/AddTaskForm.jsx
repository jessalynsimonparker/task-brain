// AddTaskForm.jsx — inline form to create a new task

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const s = {
  form: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '24px',
  },
  title: { fontSize: '14px', fontWeight: '600', color: '#aaa', marginBottom: '14px' },
  row: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' },
  input: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#e0e0e0',
    fontSize: '14px',
    padding: '8px 12px',
    outline: 'none',
    flex: 1,
    minWidth: '160px',
  },
  select: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#e0e0e0',
    fontSize: '14px',
    padding: '8px 12px',
    outline: 'none',
  },
  textarea: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#e0e0e0',
    fontSize: '14px',
    padding: '8px 12px',
    outline: 'none',
    width: '100%',
    resize: 'vertical',
    minHeight: '60px',
    boxSizing: 'border-box',
  },
  btn: {
    background: '#4f46e5',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    padding: '8px 20px',
  },
  error: { color: '#f87171', fontSize: '13px', marginTop: '8px' },
};

const EMPTY = { title: '', notes: '', category: 'other', reminder_time: '', due_date: '' };

export default function AddTaskForm({ onAdded }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');

    const payload = {
      title: form.title.trim(),
      notes: form.notes.trim() || null,
      category: form.category,
      reminder_time: form.reminder_time || null,
      due_date: form.due_date || null,
    };

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
        <input
          style={s.input}
          placeholder="Task title *"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
        />
        <select style={s.select} value={form.category} onChange={(e) => set('category', e.target.value)}>
          <option value="call">Call</option>
          <option value="email">Email</option>
          <option value="linkedin">LinkedIn</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <textarea
          style={s.textarea}
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>

      <div style={s.row}>
        <label style={{ color: '#666', fontSize: '13px', alignSelf: 'center' }}>Reminder</label>
        <input
          style={s.input}
          type="datetime-local"
          value={form.reminder_time}
          onChange={(e) => set('reminder_time', e.target.value)}
        />
        <label style={{ color: '#666', fontSize: '13px', alignSelf: 'center' }}>Due date</label>
        <input
          style={s.input}
          type="date"
          value={form.due_date}
          onChange={(e) => set('due_date', e.target.value)}
        />
        <button style={s.btn} type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Add Task'}
        </button>
      </div>

      {error && <div style={s.error}>{error}</div>}
    </form>
  );
}
