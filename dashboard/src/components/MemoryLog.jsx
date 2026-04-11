// MemoryLog.jsx — filterable list of memory entries (prospect/contact log)

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const FILTERS = ['all', 'linkedin-signal', 'post-like', 'event-met', 'warm-prospect', 'other'];

const TAG_COLORS = {
  'linkedin-signal': '#60a5fa',
  'post-like':       '#a78bfa',
  'event-met':       '#4ade80',
  'warm-prospect':   '#fb923c',
  'other':           '#94a3b8',
};

const TAG_LABELS = {
  'linkedin-signal': 'LinkedIn Signal',
  'post-like':       'Post Like',
  'event-met':       'Event Met',
  'warm-prospect':   'Warm Prospect',
  'other':           'Other',
};

const s = {
  filterRow: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  filterBtn: (active) => ({
    background: active ? '#7c3aed' : '#1a1a1a',
    border: `1px solid ${active ? '#7c3aed' : '#2a2a2a'}`,
    borderRadius: '6px',
    color: active ? '#fff' : '#888',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '5px 14px',
  }),
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    padding: '14px 16px',
    marginBottom: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },
  name: { fontSize: '15px', fontWeight: '600', color: '#e0e0e0', marginBottom: '2px' },
  company: { fontSize: '13px', color: '#888', marginBottom: '6px' },
  context: { fontSize: '13px', color: '#aaa', fontStyle: 'italic', marginBottom: '6px' },
  meta: { fontSize: '12px', color: '#555', display: 'flex', gap: '12px', flexWrap: 'wrap' },
  badge: (tag) => ({
    background: TAG_COLORS[tag] + '22',
    border: `1px solid ${TAG_COLORS[tag]}44`,
    borderRadius: '4px',
    color: TAG_COLORS[tag],
    fontSize: '11px',
    padding: '2px 7px',
    display: 'inline-block',
    marginBottom: '6px',
  }),
  deleteBtn: {
    background: 'transparent',
    border: '1px solid #3a3a3a',
    borderRadius: '5px',
    color: '#555',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '4px 10px',
    flexShrink: 0,
  },
  empty: { color: '#444', fontSize: '14px', textAlign: 'center', padding: '40px 0' },
};

export default function MemoryLog({ memories }) {
  const [filter, setFilter] = useState('all');

  const visible = filter === 'all'
    ? memories
    : memories.filter((m) => m.tag === filter);

  async function deleteMemory(id) {
    await supabase.from('memories').delete().eq('id', id);
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div>
      {/* Filter buttons */}
      <div style={s.filterRow}>
        {FILTERS.map((f) => (
          <button key={f} style={s.filterBtn(filter === f)} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : TAG_LABELS[f]}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div style={s.empty}>No memories in this view.</div>
      )}

      {visible.map((m) => (
        <div key={m.id} style={s.card}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.badge(m.tag)}>{TAG_LABELS[m.tag]}</div>
            <div style={s.name}>{m.name}</div>
            {m.company && <div style={s.company}>{m.company}</div>}
            {m.context && <div style={s.context}>"{m.context}"</div>}
            <div style={s.meta}>
              <span>Added {fmtDate(m.added_at)}</span>
            </div>
          </div>
          <button style={s.deleteBtn} onClick={() => deleteMemory(m.id)}>Del</button>
        </div>
      ))}
    </div>
  );
}
