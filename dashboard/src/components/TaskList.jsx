// TaskList.jsx — filterable task list

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const FILTERS = ['all', 'call', 'email', 'linkedin', 'other', 'done'];

const CAT_COLOR = {
  call:     'var(--success)',
  email:    'var(--tag-li)',
  linkedin: 'var(--tag-pl)',
  other:    'var(--text-muted)',
};

function tomorrowAt10am() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Los_Angeles' });
}

const inp = {
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '13px',
  padding: '7px 10px', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
};

export default function TaskList({ tasks, memories = [] }) {
  const [filter, setFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData]   = useState({});

  const visible = tasks.filter(t => {
    if (filter === 'done') return t.done;
    if (filter === 'all')  return !t.done;
    return !t.done && t.category === filter;
  });

  async function markDone(id)   { await supabase.from('tasks').update({ done: true }).eq('id', id); }
  async function deleteTask(id) { await supabase.from('tasks').delete().eq('id', id); }
  async function snooze(id)     { await supabase.from('tasks').update({ reminder_time: tomorrowAt10am(), slack_scheduled: false }).eq('id', id); }

  function startEdit(t) {
    setEditingId(t.id);
    setEditData({
      title: t.title, notes: t.notes || '', category: t.category,
      reminder_time: t.reminder_time ? t.reminder_time.slice(0, 16) : '',
      due_date: t.due_date || '', memory_id: t.memory_id || '',
      assigned_to: t.assigned_to || '',
    });
  }

  async function saveEdit(id) {
    await supabase.from('tasks').update({
      title: editData.title.trim(),
      notes: editData.notes.trim() || null,
      category: editData.category,
      reminder_time: editData.reminder_time || null,
      due_date: editData.due_date || null,
      memory_id: editData.memory_id || null,
      assigned_to: editData.assigned_to.trim() || null,
    }).eq('id', id);
    setEditingId(null);
  }

  return (
    <div>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'var(--accent)' : 'var(--surface)',
              border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '20px',
              color: filter === f ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: '12px', fontWeight: 500,
              padding: '4px 14px',
              boxShadow: filter === f ? '0 2px 8px var(--accent-glow)' : 'var(--shadow-sm)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div style={{ color: 'var(--text-faint)', fontSize: '14px', textAlign: 'center', padding: '48px 0' }}>
          No tasks here.
        </div>
      )}

      {visible.map(task => {
        if (editingId === task.id) {
          return (
            <div key={task.id} style={{
              background: 'var(--surface)', border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)', padding: '16px', marginBottom: '8px',
              boxShadow: '0 0 0 3px var(--accent-glow)',
            }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <input style={{ ...inp, flex: 1, minWidth: '160px' }} value={editData.title} onChange={e => setEditData({ ...editData, title: e.target.value })} placeholder="Title" />
                <select style={inp} value={editData.category} onChange={e => setEditData({ ...editData, category: e.target.value })}>
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: '52px', marginBottom: '8px' }} value={editData.notes} onChange={e => setEditData({ ...editData, notes: e.target.value })} placeholder="Notes" />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-faint)' }}>Reminder</label>
                <input style={{ ...inp, flex: 1 }} type="datetime-local" value={editData.reminder_time} onChange={e => setEditData({ ...editData, reminder_time: e.target.value })} />
                <label style={{ fontSize: '12px', color: 'var(--text-faint)' }}>Due</label>
                <input style={{ ...inp, flex: 1 }} type="date" value={editData.due_date} onChange={e => setEditData({ ...editData, due_date: e.target.value })} />
              </div>
              {memories.length > 0 && (
                <select style={{ ...inp, width: '100%', marginBottom: '8px', color: editData.memory_id ? 'var(--text)' : 'var(--text-muted)' }}
                  value={editData.memory_id} onChange={e => setEditData({ ...editData, memory_id: e.target.value })}>
                  <option value="">No linked contact</option>
                  {memories.map(m => <option key={m.id} value={m.id}>{m.name}{m.company ? ` · ${m.company}` : ''}</option>)}
                </select>
              )}
              <input
                style={{ ...inp, width: '100%', marginBottom: '10px' }}
                placeholder="Assign to (email)"
                value={editData.assigned_to}
                onChange={e => setEditData({ ...editData, assigned_to: e.target.value })}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => saveEdit(task.id)} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: '7px 18px', boxShadow: '0 2px 8px var(--accent-glow)' }}>Save</button>
                <button onClick={() => setEditingId(null)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: '7px 14px' }}>Cancel</button>
              </div>
            </div>
          );
        }

        return (
        <div
          key={task.id}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '14px 16px',
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
            opacity: task.done ? 0.45 : 1,
            boxShadow: 'var(--shadow-card)',
            transition: 'box-shadow 0.2s ease, transform 0.15s ease',
          }}
          onMouseEnter={e => { if (!task.done) { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
              <span style={{
                background: CAT_COLOR[task.category] + '18',
                border: `1px solid ${CAT_COLOR[task.category]}40`,
                borderRadius: '6px', color: CAT_COLOR[task.category],
                fontSize: '10px', fontWeight: 600, padding: '2px 8px',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>{task.category}</span>
              <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', letterSpacing: '-0.01em' }}>
                {task.title}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: task.memory_id || task.assigned_to ? '6px' : 0 }}>
              {task.memory_id && (() => {
                const contact = memories.find(m => m.id === task.memory_id);
                return contact ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--accent)18', border: '1px solid var(--accent)40', borderRadius: '6px', color: 'var(--accent)', fontSize: '12px', fontWeight: 500, padding: '2px 9px' }}>
                    → {contact.name}{contact.company ? ` · ${contact.company}` : ''}
                  </div>
                ) : null;
              })()}
              {task.assigned_to && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--tag-pl)18', border: '1px solid var(--tag-pl)40', borderRadius: '6px', color: 'var(--tag-pl)', fontSize: '12px', fontWeight: 500, padding: '2px 9px' }}>
                  ↗ {task.assigned_to}
                </div>
              )}
            </div>
            {task.notes && <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px', lineHeight: 1.5 }}>{task.notes}</div>}
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-faint)' }}>
              {task.due_date && <span>Due {task.due_date}</span>}
              {task.reminder_time && (
                <span style={{ color: 'var(--accent)', fontWeight: 500 }}>⏰ {fmtDate(task.reminder_time)}</span>
              )}
              <span>Added {new Date(task.added_at).toLocaleDateString()}</span>
            </div>
          </div>

          {!task.done && (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
              <button onClick={() => markDone(task.id)} style={{ background: 'var(--success)18', border: '1px solid var(--success)40', borderRadius: '8px', color: 'var(--success)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: '5px 12px' }}>Done</button>
              <button onClick={() => snooze(task.id)} style={{ background: 'var(--warning)18', border: '1px solid var(--warning)40', borderRadius: '8px', color: 'var(--warning)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: '5px 12px' }}>Snooze</button>
              <button onClick={() => startEdit(task)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, padding: '5px 12px' }}>Edit</button>
              <button onClick={() => deleteTask(task.id)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '13px', padding: '5px 10px' }}>✕</button>
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
