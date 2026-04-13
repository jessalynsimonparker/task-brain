// StatsBar.jsx — 4 summary stat cards across the top

import React from 'react';

const s = {
  bar: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  number: { fontSize: '28px', fontWeight: '700', color: 'var(--text)', lineHeight: 1, marginBottom: '4px' },
  label:  { fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' },
};

export default function StatsBar({ tasks, memories, onNavigate }) {
  const today = new Date().toISOString().slice(0, 10);

  const stats = [
    { number: tasks.filter(t => !t.done).length,                          label: 'Open Tasks',    tab: 'Tasks' },
    { number: tasks.filter(t => !t.done && t.due_date === today).length,  label: 'Due Today',     tab: 'Calendar' },
    { number: tasks.filter(t => !t.done && t.reminder_time).length,       label: 'Reminders Set', tab: 'Tasks' },
    { number: memories.length,                                             label: 'Memory Log',    tab: 'Memory Log' },
  ];

  return (
    <div style={s.bar}>
      {stats.map((stat) => (
        <div
          key={stat.label}
          style={s.card}
          onClick={() => onNavigate(stat.tab)}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--surface2)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}
        >
          <div style={s.number}>{stat.number}</div>
          <div style={s.label}>{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
