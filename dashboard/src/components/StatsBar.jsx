// StatsBar.jsx — shows 4 summary numbers across the top of the dashboard

import React from 'react';

const styles = {
  bar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '24px',
  },
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    padding: '16px',
    textAlign: 'center',
  },
  number: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#e0e0e0',
    lineHeight: 1,
    marginBottom: '4px',
  },
  label: {
    fontSize: '12px',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
};

export default function StatsBar({ tasks, memories }) {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  const openTasks = tasks.filter((t) => !t.done).length;
  const dueToday = tasks.filter((t) => !t.done && t.due_date === today).length;
  const remindersSet = tasks.filter((t) => !t.done && t.reminder_time).length;
  const memoryCount = memories.length;

  const stats = [
    { number: openTasks, label: 'Open Tasks' },
    { number: dueToday, label: 'Due Today' },
    { number: remindersSet, label: 'Reminders Set' },
    { number: memoryCount, label: 'Memory Log' },
  ];

  return (
    <div style={styles.bar}>
      {stats.map((s) => (
        <div key={s.label} style={styles.card}>
          <div style={styles.number}>{s.number}</div>
          <div style={styles.label}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}
