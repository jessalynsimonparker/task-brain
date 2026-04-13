// MemoryLog.jsx

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

function renderWithLinks(text) {
  const urlRegex = /https?:\/\/[^\s>]+/g;
  const result = [];
  let last = 0, match;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > last) result.push(text.slice(last, match.index));
    const url = match[0].replace(/[>.,)]+$/, '');
    result.push(<a key={match.index} href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>{url}</a>);
    last = match.index + match[0].length;
  }
  if (last < text.length) result.push(text.slice(last));
  return result;
}

const FILTERS = ['all', 'linkedin-signal', 'post-like', 'event-met', 'warm-prospect', 'other'];
const TAGS    = ['linkedin-signal', 'post-like', 'event-met', 'warm-prospect', 'other'];

const TAG_COLOR = {
  'linkedin-signal': 'var(--tag-li)',
  'post-like':       'var(--tag-pl)',
  'event-met':       'var(--tag-em)',
  'warm-prospect':   'var(--tag-wp)',
  'other':           'var(--tag-ot)',
};
const TAG_LABEL = {
  'linkedin-signal': 'LinkedIn Signal',
  'post-like':       'Post Like',
  'event-met':       'Event Met',
  'warm-prospect':   'Warm Prospect',
  'other':           'Other',
};

const inp = {
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '13px',
  padding: '7px 10px', outline: 'none', width: '100%', boxSizing: 'border-box', marginBottom: '8px',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

export default function MemoryLog({ memories }) {
  const [filter, setFilter]     = useState('all');
  const [lightbox, setLightbox] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData]   = useState({});

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
      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, cursor: 'zoom-out', backdropFilter: 'blur(8px)',
        }}>
          <img src={lightbox} alt="preview" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }} />
        </div>
      )}

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'var(--accent)' : 'var(--surface)',
              border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '20px', color: filter === f ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: '12px', fontWeight: 500, padding: '4px 14px',
              boxShadow: filter === f ? '0 2px 8px var(--accent-glow)' : 'var(--shadow-sm)',
            }}
          >
            {f === 'all' ? 'All' : TAG_LABEL[f]}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div style={{ color: 'var(--text-faint)', fontSize: '14px', textAlign: 'center', padding: '48px 0' }}>No memories in this view.</div>
      )}

      {visible.map(m => {
        const tagColor = TAG_COLOR[m.tag] || TAG_COLOR.other;

        if (editingId === m.id) {
          return (
            <div key={m.id} style={{
              background: 'var(--surface)', border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)', padding: '16px', marginBottom: '8px',
              boxShadow: '0 0 0 3px var(--accent-glow)',
            }}>
              <input style={inp} value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="Name" />
              <input style={inp} value={editData.company} onChange={e => setEditData({ ...editData, company: e.target.value })} placeholder="Company" />
              <textarea style={{ ...inp, resize: 'vertical', minHeight: '60px' }} value={editData.context} onChange={e => setEditData({ ...editData, context: e.target.value })} placeholder="Context" />
              <select style={inp} value={editData.tag} onChange={e => setEditData({ ...editData, tag: e.target.value })}>
                {TAGS.map(t => <option key={t} value={t}>{TAG_LABEL[t]}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button onClick={() => saveEdit(m.id)} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: '7px 18px', boxShadow: '0 2px 8px var(--accent-glow)' }}>Save</button>
                <button onClick={() => setEditingId(null)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: '7px 14px' }}>Cancel</button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={m.id}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '8px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px',
              boxShadow: 'var(--shadow-card)',
              transition: 'box-shadow 0.2s ease, transform 0.15s ease',
              position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {/* Left color accent */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: tagColor, borderRadius: 'var(--radius) 0 0 var(--radius)' }} />

            <div style={{ flex: 1, minWidth: 0, paddingLeft: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={{
                  background: tagColor + '18', border: `1px solid ${tagColor}40`,
                  borderRadius: '6px', color: tagColor, fontSize: '10px',
                  fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>{TAG_LABEL[m.tag]}</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', letterSpacing: '-0.01em' }}>{m.name}</span>
                {m.company && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{m.company}</span>}
              </div>
              {m.context && (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '8px', lineHeight: 1.5 }}>
                  "{renderWithLinks(m.context)}"
                </div>
              )}
              {m.attachment_url && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {m.attachment_url.split(',').map((url, i) => (
                    <img key={i} src={url} alt={`screenshot ${i + 1}`} onClick={() => setLightbox(url)}
                      style={{ maxWidth: '150px', maxHeight: '84px', borderRadius: '8px', cursor: 'zoom-in', boxShadow: 'var(--shadow-sm)', transition: 'transform 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    />
                  ))}
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>Added {fmtDate(m.added_at)}</div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button onClick={() => startEdit(m)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', fontWeight: 500, padding: '5px 12px' }}>Edit</button>
              <button onClick={() => deleteMemory(m.id)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '12px', padding: '5px 10px' }}>✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
