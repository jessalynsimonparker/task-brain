// CalendarView.jsx — month/week/day calendar showing tasks by due_date
// Uses react-big-calendar with a dark theme applied via inline styles on the wrapper.

import React, { useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Wire up date-fns as the localizer (react-big-calendar needs one)
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
});

const CATEGORY_COLORS = {
  call:     '#4ade80',
  email:    '#60a5fa',
  linkedin: '#a78bfa',
  other:    '#94a3b8',
};

export default function CalendarView({ tasks }) {
  const [view, setView] = React.useState('month');
  const [date, setDate] = React.useState(new Date());
  const [prevView, setPrevView] = React.useState(null);
  // Convert tasks to react-big-calendar event format.
  // Tasks with a due_date show up on that day.
  // Tasks with only a reminder_time also show up (as a timed event).
  const events = useMemo(() => {
    return tasks
      .filter((t) => !t.done && (t.due_date || t.reminder_time))
      .map((t) => {
        // If due_date exists, treat it as an all-day event
        if (t.due_date) {
          const d = new Date(t.due_date + 'T00:00:00'); // avoid timezone shift
          return {
            id: t.id,
            title: t.title,
            start: d,
            end: d,
            allDay: true,
            resource: t,
          };
        }
        // Otherwise use reminder_time as a timed event
        const start = new Date(t.reminder_time);
        const end = new Date(start.getTime() + 30 * 60_000); // 30min duration
        return {
          id: t.id,
          title: t.title,
          start,
          end,
          allDay: false,
          resource: t,
        };
      });
  }, [tasks]);

  // Color each event by category
  function eventStyleGetter(event) {
    const color = CATEGORY_COLORS[event.resource?.category] || '#94a3b8';
    return {
      style: {
        backgroundColor: color + '33',
        border: `1px solid ${color}`,
        borderRadius: '4px',
        color: color,
        fontSize: '12px',
        padding: '1px 6px',
      },
    };
  }

  return (
    // The wrapper div overrides react-big-calendar's default light styles
    // to match our dark theme. These CSS custom properties target the library's
    // internal class names.
    <div style={{ height: prevView ? 640 : 600 }} className="rbc-theme">
      <style>{`
        .rbc-theme .rbc-calendar { background: var(--bg); color: var(--text); }
        .rbc-theme .rbc-header { background: var(--surface); border-color: var(--border); color: var(--text-muted); font-size: 12px; }
        .rbc-theme .rbc-month-view,
        .rbc-theme .rbc-time-view,
        .rbc-theme .rbc-agenda-view { border-color: var(--border); }
        .rbc-theme .rbc-day-bg { border-color: var(--border); }
        .rbc-theme .rbc-off-range-bg { background: var(--surface2); }
        .rbc-theme .rbc-today { background: var(--surface); border: 1px solid var(--accent); }
        .rbc-theme .rbc-toolbar button {
          background: var(--surface); border-color: var(--border); color: var(--text-muted);
          border-radius: 6px; padding: 5px 12px; cursor: pointer;
        }
        .rbc-theme .rbc-toolbar button.rbc-active,
        .rbc-theme .rbc-toolbar button:hover { background: var(--accent); color: #fff; border-color: var(--accent); }
        .rbc-theme .rbc-toolbar-label { color: var(--text); font-weight: 600; }
        .rbc-theme .rbc-date-cell { color: var(--text-muted); }
        .rbc-theme .rbc-date-cell.rbc-now a,
        .rbc-theme .rbc-date-cell.rbc-now { color: var(--accent); font-weight: 700; }
        .rbc-theme .rbc-time-slot { border-color: var(--surface2); }
        .rbc-theme .rbc-timeslot-group { border-color: var(--border); }
        .rbc-theme .rbc-time-gutter .rbc-timeslot-group { color: var(--text-faint); font-size: 11px; }
        .rbc-theme .rbc-current-time-indicator { background: var(--accent); }
        .rbc-theme .rbc-show-more { color: var(--accent); background: transparent; }
        .rbc-theme .rbc-event:focus { outline: none; }
        .rbc-theme .rbc-time-content { border-color: var(--border); }
        .rbc-theme .rbc-time-header-content { border-color: var(--border); }
      `}</style>
      {prevView && (
        <button
          onClick={() => { setView(prevView); setPrevView(null); }}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px',
            padding: '5px 12px', marginBottom: '8px',
          }}
        >
          ← Back to {prevView.charAt(0).toUpperCase() + prevView.slice(1)}
        </button>
      )}
      <Calendar
        localizer={localizer}
        events={events}
        view={view}
        date={date}
        onView={(v) => { setView(v); setPrevView(null); }}
        onNavigate={setDate}
        onDrillDown={(d) => { setPrevView(view); setDate(d); setView('day'); }}
        drilldownView="day"
        views={['month', 'week', 'day']}
        eventPropGetter={eventStyleGetter}
        style={{ height: '100%' }}
        popup
        tooltipAccessor={(e) => e.resource?.notes || e.title}
      />
    </div>
  );
}
