// MemoryLog.jsx — filterable list of memory entries (prospect/contact log)

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

function renderWithLinks(text) {
  const urlRegex = /https?:\/\/[^\s>]+/g;
  const result = [];
  let last = 0;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > last) result.push(text.slice(last, match.index));
    const url = match[0].replace(/[>.,)]+$/, '');
    result.push(
      <a key={match.index} href={url} target="_blank" rel="noreferrer"
        style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>{url}</a>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) result.push(text.slice(last));
  return result;
}

const FILTERS = ['all', 'linkedin-signal', 'post-like', 'event-met', 'warm-prospect', 'other'];
const TAGS    = ['linkedin-signal', 'post-like', 'event-met', 'warm-prospect', 'other'];

const TAG_VARS = {
  'linkedin-signal': 'var(--tag-li)',
  'post-like':       'var(--tag-pl)',
  'event-met':       'var(--tag-em)',
  'warm-prospect':   'var(--tag-wp)',
  'other':           'var(--tag-ot)',
};

const TAG_LABELS = {
  'linkedin-signal': 'LinkedIn Signal',
  'post-like':       'Post Like',
  'event-met':       'Event Met',
  'warm-prospect':   'Warm Prospect',
  'other':           'Other',
};

const s = {
  filterRow:  { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  filterBtn: (active) => ({
    background: active ? 'var(--accent)' : 'var(--surface)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: '6px',
    color: active ? '#fff' : 'var(--text-muted)',
    cursor: 'pointer', fontSize: '13px', padding: '5px 14px',
  }),
  card: {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
    padding: '14px 16px', marginBottom: '10px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px',
  },
  editCard: {
    background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '12px',
    padding: '14px 16px', marginBottom: '10px',
  },
  name:    { fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '2px' },
  company: { fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' },
  context: { fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '6px' },
  meta:    { fontSize: '12px', color: 'var(--text-faint)', display: 'flex', gap: '12px', flexWrap: 'wrap' },
  badge: (tag) => ({
    background: TAG_VARS[tag] + '22',
    border: `1px solid ${TAG_VARS[tag]}55`,
    borderRadius: '4px', color: TAG_VARS[tag],
    fontSize: '11px', padding: '2px 7px', display: 'inline-block', marginBottom: '6px',
  }),
  input: {
    background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px',
    color: 'var(--text)', fontSize: '13px', padding: '6px 10px',
    width: '100%', boxSizing: 'border-box', marginBottom: '8px',
  },
  select: {
    background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px',
    color: 'var(--text)', fontSize: '13px', padding: '6px 10px',
    width: '100%', boxSizing: 'border-box', marginBottom: '8px',
  },
  btnRow:    { display: 'flex', gap: '6px', marginTop: '4px' },
  saveBtn:   { background: 'var(--accent)', border: 'none', borderRadius: '5px', color: '#fff', cursor: 'pointer', fontSize: '12px', padding: '5px 14px' },
  cancelBtn: { background: 'transparent', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: '5px 14px' },
  editBtn:   { background: 'transparent', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: '4px 10px', flexShrink: 0 },
  deleteBtn: { background: 'transparent', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '12px', padding: '4px 10px', flexShrink: 0 },
  empty:     { color: 'var(--text-faint)', fontSize: '14px', textAlign: 'center', padding: '40px 0' },
};

export default function MemoryLog({ memories }) {
  const [filter, setFilter] = useState('all');
  const [lightbox, setLightbox] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const visible = filter === 'all' ? memories : memories.filter(m => m.tag === filter);

  function startEdit(m) {
    setEditingId(m.id);
    setEditData({ name: m.name, company: m.company || '', context: m.context || '', tag: m.tag || 'other' });
  }

  async function saveEdit(id) {
    await supabase.from('memories').update({
      name: editData.name.trim(), company: editData.company.trim(),
      context: editData.context.trim(), tag: editData.tag,
    }).eq('id', id);
    setEditingId(null);
  }

  async function deleteMemory(id) { await supabase.from('memories').delete().eq('id', id); }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, cursor: 'zoom-out',
        }}>
          <img src={lightbox} alt="preview" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '10px' }} />
        </div>
      )}

      <div style={s.filterRow}>
        {FILTERS.map(f => (
          <button key={f} style={s.filterBtn(filter === f)} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : TAG_LABELS[f]}
          </button>
        ))}
      </div>

      {visible.length === 0 && <div style={s.empty}>No memories in this view.</div>}

      {visible.map(m => {
        if (editingId === m.id) {
          return (
            <div key={m.id} style={s.editCard}>
              <input style={s.input} value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="Name" />
              <input style={s.input} value={editData.company} onChange={e => setEditData({ ...editData, company: e.target.value })} placeholder="Company" />
              <textarea style={{ ...s.input, resize: 'vertical', minHeight: '60px' }} value={editData.context} onChange={e => setEditData({ ...editData, context: e.target.value })} placeholder="Context" />
              <select style={s.select} value={editData.tag} onChange={e => setEditData({ ...editData, tag: e.target.value })}>
                {TAGS.map(t => <option key={t} value={t}>{TAG_LABELS[t]}</option>)}
              </select>
              <div style={s.btnRow}>
                <button style={s.saveBtn} onClick={() => saveEdit(m.id)}>Save</button>
                <button style={s.cancelBtn} onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            </div>
          );
        }

        return (
          <div key={m.id} style={s.card}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.badge(m.tag)}>{TAG_LABELS[m.tag]}</div>
              <div style={s.name}>{m.name}</div>
              {m.company && <div style={s.company}>{m.company}</div>}
              {m.context && <div style={s.context}>"{renderWithLinks(m.context)}"</div>}
              {m.attachment_url && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {m.attachment_url.split(',').map((url, i) => (
                    <img key={i} src={url} alt={`screenshot ${i + 1}`} onClick={() => setLightbox(url)}
                      style={{ maxWidth: '160px', maxHeight: '90px', borderRadius: '6px', display: 'block', cursor: 'zoom-in' }} />
                  ))}
                </div>
              )}
              <div style={s.meta}><span>Added {fmtDate(m.added_at)}</span></div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button style={s.editBtn} onClick={() => startEdit(m)}>Edit</button>
              <button style={s.deleteBtn} onClick={() => deleteMemory(m.id)}>Del</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
