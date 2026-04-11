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
    <div style={{ height: 600 }} className="rbc-dark">
      <style>{`
        .rbc-dark .rbc-calendar { background: #111; color: #e0e0e0; }
        .rbc-dark .rbc-header { background: #1a1a1a; border-color: #2a2a2a; color: #888; font-size: 12px; }
        .rbc-dark .rbc-month-view,
        .rbc-dark .rbc-time-view,
        .rbc-dark .rbc-agenda-view { border-color: #2a2a2a; }
        .rbc-dark .rbc-day-bg { border-color: #2a2a2a; }
        .rbc-dark .rbc-off-range-bg { background: #0d0d0d; }
        .rbc-dark .rbc-today { background: #1a1a2e; }
        .rbc-dark .rbc-toolbar button {
          background: #1a1a1a; border-color: #2a2a2a; color: #aaa;
          border-radius: 6px; padding: 5px 12px; cursor: pointer;
        }
        .rbc-dark .rbc-toolbar button.rbc-active,
        .rbc-dark .rbc-toolbar button:hover { background: #4f46e5; color: #fff; border-color: #4f46e5; }
        .rbc-dark .rbc-toolbar-label { color: #e0e0e0; font-weight: 600; }
        .rbc-dark .rbc-date-cell { color: #666; }
        .rbc-dark .rbc-date-cell.rbc-now { color: #4f46e5; font-weight: 700; }
        .rbc-dark .rbc-time-slot { border-color: #1e1e1e; }
        .rbc-dark .rbc-timeslot-group { border-color: #2a2a2a; }
        .rbc-dark .rbc-time-gutter .rbc-timeslot-group { color: #555; font-size: 11px; }
        .rbc-dark .rbc-current-time-indicator { background: #4f46e5; }
        .rbc-dark .rbc-show-more { color: #4f46e5; background: transparent; }
      `}</style>
      <Calendar
        localizer={localizer}
        events={events}
        defaultView="month"
        views={['month', 'week', 'day']}
        eventPropGetter={eventStyleGetter}
        style={{ height: '100%' }}
        popup // show "+X more" popup when events overflow a cell
        tooltipAccessor={(e) => e.resource?.notes || e.title}
      />
    </div>
  );
}
