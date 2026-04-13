// AddMemoryForm.jsx

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const inp = {
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '14px',
  padding: '9px 13px', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
};

const EMPTY = { name: '', company: '', context: '', tag: 'other', reminder_time: '' };

export default function AddMemoryForm({ onAdded, userId }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    const { error: err } = await supabase.from('memories').insert([{
      name: form.name.trim(), company: form.company.trim() || null,
      context: form.context.trim() || null, tag: form.tag,
      reminder_time: form.reminder_time || null,
      user_id: userId || null,
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
        + Add Memory
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <input style={{ ...inp, flex: 1, minWidth: '140px' }} placeholder="Name *" value={form.name} onChange={e => set('name', e.target.value)} />
        <input style={{ ...inp, flex: 1, minWidth: '140px' }} placeholder="Company" value={form.company} onChange={e => set('company', e.target.value)} />
        <select style={{ ...inp }} value={form.tag} onChange={e => set('tag', e.target.value)}>
          <option value="linkedin-signal">LinkedIn Signal</option>
          <option value="post-like">Post Like</option>
          <option value="event-met">Event Met</option>
          <option value="warm-prospect">Warm Prospect</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <textarea
          style={{ ...inp, width: '100%', resize: 'vertical', minHeight: '64px', boxSizing: 'border-box' }}
          placeholder="Context — how do you know them? what was the interaction?"
          value={form.context}
          onChange={e => set('context', e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ color: 'var(--text-faint)', fontSize: '12px', fontWeight: 500 }}>Reminder</label>
        <input style={{ ...inp, flex: 1, minWidth: '160px' }} type="datetime-local" value={form.reminder_time} onChange={e => set('reminder_time', e.target.value)} />
        <button
          type="submit" disabled={saving}
          style={{
            background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)',
            color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
            padding: '9px 22px', boxShadow: '0 2px 10px var(--accent-glow)',
          }}
        >
          {saving ? 'Saving…' : 'Add Memory'}
        </button>
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '10px' }}>{error}</div>}
    </form>
  );
}
