// AddMemoryForm.jsx — inline form to save a new memory entry

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

const EMPTY = { name: '', company: '', context: '', tag: 'other', reminder_time: '' };

export default function AddMemoryForm({ onAdded }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    const payload = { name: form.name.trim(), company: form.company.trim() || null, context: form.context.trim() || null, tag: form.tag, reminder_time: form.reminder_time || null };
    const { error: err } = await supabase.from('memories').insert([payload]);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm(EMPTY);
    onAdded?.();
  }

  return (
    <form style={s.form} onSubmit={handleSubmit}>
      <div style={s.title}>+ Add Memory</div>
      <div style={s.row}>
        <input style={s.input} placeholder="Name *" value={form.name} onChange={e => set('name', e.target.value)} />
        <input style={s.input} placeholder="Company" value={form.company} onChange={e => set('company', e.target.value)} />
        <select style={s.select} value={form.tag} onChange={e => set('tag', e.target.value)}>
          <option value="linkedin-signal">LinkedIn Signal</option>
          <option value="post-like">Post Like</option>
          <option value="event-met">Event Met</option>
          <option value="warm-prospect">Warm Prospect</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div style={{ marginBottom: '10px' }}>
        <textarea style={s.textarea} placeholder="Context — how do you know them? what was the interaction?" value={form.context} onChange={e => set('context', e.target.value)} />
      </div>
      <div style={s.row}>
        <label style={s.label}>Reminder</label>
        <input style={s.input} type="datetime-local" value={form.reminder_time} onChange={e => set('reminder_time', e.target.value)} />
        <button style={s.btn} type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Memory'}</button>
      </div>
      {error && <div style={s.error}>{error}</div>}
    </form>
  );
}
