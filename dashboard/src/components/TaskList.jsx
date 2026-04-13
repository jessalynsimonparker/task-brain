// TaskList.jsx — filterable list of tasks with done / delete / snooze actions

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const FILTERS = ['all', 'call', 'email', 'linkedin', 'other', 'done'];

const CATEGORY_COLORS = {
  call:     'var(--success)',
  email:    'var(--tag-li)',
  linkedin: 'var(--tag-pl)',
  other:    'var(--text-muted)',
};

const s = {
  filterRow: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  filterBtn: (active) => ({
    background: active ? 'var(--accent)' : 'var(--surface)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: '6px',
    color: active ? '#fff' : 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '5px 14px',
  }),
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },
  title:   { fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' },
  notes:   { fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' },
  meta:    { fontSize: '12px', color: 'var(--text-faint)', display: 'flex', gap: '12px', flexWrap: 'wrap' },
  badge: (cat) => ({
    background: CATEGORY_COLORS[cat] + '22',
    border: `1px solid ${CATEGORY_COLORS[cat]}55`,
    borderRadius: '4px',
    color: CATEGORY_COLORS[cat],
    fontSize: '11px',
    padding: '2px 7px',
    display: 'inline-block',
  }),
  actions: { display: 'flex', gap: '6px', flexShrink: 0 },
  actionBtn: (color) => ({
    background: 'transparent',
    border: `1px solid ${color}`,
    borderRadius: '5px',
    color: color,
    cursor: 'pointer',
    fontSize: '12px',
    padding: '4px 10px',
    whiteSpace: 'nowrap',
  }),
  empty: { color: 'var(--text-faint)', fontSize: '14px', textAlign: 'center', padding: '40px 0' },
};

function tomorrowAt10am() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

export default function TaskList({ tasks }) {
  const [filter, setFilter] = useState('all');

  const visible = tasks.filter(t => {
    if (filter === 'done') return t.done;
    if (filter === 'all') return !t.done;
    return !t.done && t.category === filter;
  });

  async function markDone(id)   { await supabase.from('tasks').update({ done: true }).eq('id', id); }
  async function deleteTask(id) { await supabase.from('tasks').delete().eq('id', id); }
  async function snooze(id)     { await supabase.from('tasks').update({ reminder_time: tomorrowAt10am(), slack_scheduled: false }).eq('id', id); }

  function fmtDate(iso) {
    if (!iso) return null;
    return new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Los_Angeles' });
  }

  return (
    <div>
      <div style={s.filterRow}>
        {FILTERS.map(f => (
          <button key={f} style={s.filterBtn(filter === f)} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {visible.length === 0 && <div style={s.empty}>No tasks in this view.</div>}

      {visible.map(task => (
        <div key={task.id} style={{ ...s.card, opacity: task.done ? 0.45 : 1 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.title}>
              <span style={s.badge(task.category)}>{task.category}</span>{' '}{task.title}
            </div>
            {task.notes && <div style={s.notes}>{task.notes}</div>}
            <div style={s.meta}>
              {task.due_date && <span>Due: {task.due_date}</span>}
              {task.reminder_time && <span style={{ color: 'var(--accent)' }}>⏰ {fmtDate(task.reminder_time)}</span>}
              <span>Added {new Date(task.added_at).toLocaleDateString()}</span>
            </div>
          </div>
          {!task.done && (
            <div style={s.actions}>
              <button style={s.actionBtn('var(--success)')} onClick={() => markDone(task.id)}>Done</button>
              <button style={s.actionBtn('var(--warning)')} onClick={() => snooze(task.id)}>Snooze</button>
              <button style={s.actionBtn('var(--danger)')} onClick={() => deleteTask(task.id)}>Del</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
