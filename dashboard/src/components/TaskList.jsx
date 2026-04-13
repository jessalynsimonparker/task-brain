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

export default function TaskList({ tasks }) {
  const [filter, setFilter] = useState('all');

  const visible = tasks.filter(t => {
    if (filter === 'done') return t.done;
    if (filter === 'all')  return !t.done;
    return !t.done && t.category === filter;
  });

  async function markDone(id)   { await supabase.from('tasks').update({ done: true }).eq('id', id); }
  async function deleteTask(id) { await supabase.from('tasks').delete().eq('id', id); }
  async function snooze(id)     { await supabase.from('tasks').update({ reminder_time: tomorrowAt10am(), slack_scheduled: false }).eq('id', id); }

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

      {visible.map(task => (
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
              <button
                onClick={() => markDone(task.id)}
                title="Mark done"
                style={{
                  background: 'var(--success)18', border: '1px solid var(--success)40',
                  borderRadius: '8px', color: 'var(--success)', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600, padding: '5px 12px',
                }}
              >Done</button>
              <button
                onClick={() => snooze(task.id)}
                title="Snooze to tomorrow 10am"
                style={{
                  background: 'var(--warning)18', border: '1px solid var(--warning)40',
                  borderRadius: '8px', color: 'var(--warning)', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600, padding: '5px 12px',
                }}
              >Snooze</button>
              <button
                onClick={() => deleteTask(task.id)}
                title="Delete"
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: '8px', color: 'var(--text-faint)', cursor: 'pointer',
                  fontSize: '13px', padding: '5px 10px',
                }}
              >✕</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
