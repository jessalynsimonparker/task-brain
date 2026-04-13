// StatsBar.jsx — 4 clickable summary stat cards

import React from 'react';

const ICONS = {
  'Open Tasks':    '◈',
  'Due Today':     '◷',
  'Reminders Set': '◉',
  'Memory Log':    '◎',
};

const ACCENTS = {
  'Open Tasks':    'var(--accent)',
  'Due Today':     'var(--warning)',
  'Reminders Set': 'var(--success)',
  'Memory Log':    'var(--tag-pl)',
};

export default function StatsBar({ tasks, memories, onNavigate }) {
  const today = new Date().toISOString().slice(0, 10);

  const stats = [
    { number: tasks.filter(t => !t.done).length,                         label: 'Open Tasks',    tab: 'Tasks' },
    { number: tasks.filter(t => !t.done && t.due_date === today).length, label: 'Due Today',     tab: 'Calendar' },
    { number: tasks.filter(t => !t.done && t.reminder_time).length,      label: 'Reminders Set', tab: 'Tasks' },
    { number: memories.length,                                            label: 'Memory Log',    tab: 'Memory Log' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
      {stats.map(stat => {
        const accent = ACCENTS[stat.label];
        return (
          <div
            key={stat.label}
            onClick={() => onNavigate(stat.tab)}
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              padding: '18px 16px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-card)',
              transition: 'box-shadow 0.2s ease, transform 0.15s ease, border-color 0.2s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'var(--border2)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = 'var(--shadow-card)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            {/* Accent top bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: accent, borderRadius: 'var(--radius) var(--radius) 0 0' }} />
            <div style={{ fontSize: '30px', fontWeight: '700', color: accent, lineHeight: 1, marginBottom: '6px', letterSpacing: '-0.02em' }}>
              {stat.number}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
              {stat.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
