// commands.js — all !command handlers for the Slack bot
// Each exported function receives (text, say) and does its work.

const supabase = require('./supabase');
const { parseTaskWithAI } = require('./taskParser');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Infer category from task title keywords.
 */
function inferCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('call') || t.includes('phone')) return 'call';
  if (t.includes('email')) return 'email';
  if (t.includes('linkedin')) return 'linkedin';
  return 'other';
}

/**
 * Parse a time string into a Date.
 * Supports: "tomorrow 9am", "today 2pm", "friday 10am", "1hr"
 */
function parseReminderTime(timeStr) {
  if (!timeStr) return null;
  const lower = timeStr.toLowerCase().trim();

  // "1hr" → 1 hour from now
  if (lower === '1hr' || lower === '1 hr' || lower === '1hour') {
    return new Date(Date.now() + 60 * 60_000);
  }

  const timePattern = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/;
  const base = new Date();

  if (lower.startsWith('tomorrow')) {
    base.setDate(base.getDate() + 1);
  }

  const match = lower.match(timePattern);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3];

  if (meridiem === 'pm' && hours !== 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  base.setHours(hours, minutes, 0, 0);
  return base;
}

function tomorrowAt10am() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

function oneHourFromNow() {
  return new Date(Date.now() + 60 * 60_000);
}

/**
 * Find an open task by partial title match (case-insensitive).
 */
async function findTaskByTitle(partial) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('done', false)
    .ilike('title', `%${partial}%`)
    .limit(1);
  if (error || !data?.length) return null;
  return data[0];
}

// ─── Command Handlers ────────────────────────────────────────────────────────

/**
 * !task [anything natural]
 * Creates a new task. Uses Claude to parse title, category, and date/time.
 *
 * Examples:
 *   !task call sarah next friday afternoon
 *   !task email john about proposal april 15
 *   !task linkedin message david tomorrow
 */
async function handleTask(text, say) {
  let title, category, reminder_time;

  try {
    // Use Claude to understand the natural language input
    const parsed = await parseTaskWithAI(text.trim());
    title = parsed.title;
    category = parsed.category;
    reminder_time = parsed.reminder_time || null;
  } catch (err) {
    // If AI parsing fails, fall back to using the raw text as the title
    console.error('[handleTask] AI parse failed, using raw text:', err.message);
    title = text.trim();
    category = inferCategory(title);
    reminder_time = null;
  }

  const { error } = await supabase.from('tasks').insert([{
    title,
    category,
    reminder_time,
  }]);

  if (error) { await say(`❌ Couldn't create task: ${error.message}`); return; }

  const reminderNote = reminder_time
    ? `\nReminder: *${new Date(reminder_time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Los_Angeles' })}*`
    : '';

  await say(`📝 _"${text.trim()}"_\n✅ Task created: *${title}*\nCategory: ${category}${reminderNote}`);
}

/**
 * !note [name] / [company] — [context]
 * Saves a memory log entry.
 *
 * Example:
 *   !note Jane Smith / Acme Corp — met at SaaStr, interested in Q3 deal
 */
async function handleNote(text, say) {
  // Accepts any of:
  //   Jane Smith / Acme — met at SaaStr
  //   Jane Smith / Acme - met at SaaStr
  //   Jane Smith - met at SaaStr     (no company)
  //   Jane Smith / Acme              (no context)
  //   Jane Smith                     (name only)

  let name, company = null, context = null;

  // name / company — context  (em dash or hyphen)
  const full = text.match(/^(.+?)\s*\/\s*(.+?)\s*(?:—|-{1,2})\s*(.+)$/);
  if (full) {
    [, name, company, context] = full;
  } else {
    // name / company  (no context separator)
    const withCompany = text.match(/^(.+?)\s*\/\s*(.+)$/);
    if (withCompany) {
      [, name, company] = withCompany;
    } else {
      // name — context  (no company)
      const withContext = text.match(/^(.+?)\s*(?:—|-{1,2})\s*(.+)$/);
      if (withContext) {
        [, name, context] = withContext;
      } else {
        // just a name
        name = text.trim();
      }
    }
  }

  name = name.trim();
  if (!name) {
    await say('❌ At minimum include a name. Example: `/note Jane Smith / Acme - met at SaaStr`');
    return;
  }

  const { error } = await supabase.from('memories').insert([{
    name,
    company: company?.trim() || null,
    context: context?.trim() || null,
  }]);

  if (error) { await say(`❌ Couldn't save memory: ${error.message}`); return; }

  const companyStr = company ? ` at *${company.trim()}*` : '';
  const contextStr = context ? `\n_"${context.trim()}"_` : '';
  await say(`🧠 Memory saved: *${name}*${companyStr}${contextStr}`);
}

/**
 * !tasks
 * Lists all open tasks.
 */
async function handleTasks(say) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('done', false)
    .order('added_at', { ascending: true });

  if (error) { await say(`❌ Couldn't fetch tasks: ${error.message}`); return; }
  if (!data?.length) { await say('🎉 No open tasks! You\'re all caught up.'); return; }

  const lines = data.map((t, i) => {
    const due = t.due_date ? ` · due ${t.due_date}` : '';
    const reminder = t.reminder_time
      ? ` · ⏰ ${new Date(t.reminder_time).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Los_Angeles' })}`
      : '';
    return `${i + 1}. [${t.category}] *${t.title}*${due}${reminder}`;
  });

  await say(`📋 *Open Tasks (${data.length})*\n${lines.join('\n')}`);
}

/**
 * !done [partial task name]
 * Marks the first matching open task as done.
 */
async function handleDone(text, say) {
  const task = await findTaskByTitle(text.trim());
  if (!task) { await say(`❌ No open task found matching: _"${text.trim()}"_`); return; }

  const { error } = await supabase.from('tasks').update({ done: true }).eq('id', task.id);
  if (error) { await say(`❌ Couldn't mark done: ${error.message}`); return; }

  await say(`✅ Marked done: *${task.title}*`);
}

/**
 * !snooze [partial task name] [optional: 1hr | tomorrow | custom time]
 *
 * Examples:
 *   !snooze Call Sarah          → tomorrow 10am (default)
 *   !snooze Call Sarah 1hr      → 1 hour from now
 *   !snooze Call Sarah friday 2pm → custom time
 */
async function handleSnooze(text, say) {
  // Split on the last word(s) to see if a time modifier was given
  // Try to match a trailing time expression
  const timeMatch = text.match(
    /\s+(1hr|1 hr|tomorrow|(?:today|tomorrow)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*$/i
  );

  let titleQuery = text.trim();
  let newTime;
  let timeLabel;

  if (timeMatch) {
    titleQuery = text.slice(0, timeMatch.index).trim();
    const timeStr = timeMatch[1].trim().toLowerCase();

    if (timeStr === '1hr' || timeStr === '1 hr') {
      newTime = oneHourFromNow();
      timeLabel = '1 hour from now';
    } else if (timeStr === 'tomorrow') {
      newTime = tomorrowAt10am();
      timeLabel = 'tomorrow at 10:00 AM';
    } else {
      newTime = parseReminderTime(timeStr);
      timeLabel = newTime
        ? newTime.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Los_Angeles' })
        : null;
    }
  } else {
    // No time given → default to tomorrow 10am
    newTime = tomorrowAt10am();
    timeLabel = 'tomorrow at 10:00 AM';
  }

  if (!newTime) {
    await say('❌ Couldn\'t parse that time. Try: `!snooze [task] 1hr` or `!snooze [task] tomorrow 9am`');
    return;
  }

  const task = await findTaskByTitle(titleQuery);
  if (!task) { await say(`❌ No open task found matching: _"${titleQuery}"_`); return; }

  const { error } = await supabase
    .from('tasks')
    .update({ reminder_time: newTime.toISOString(), slack_scheduled: false })
    .eq('id', task.id);

  if (error) { await say(`❌ Couldn't snooze: ${error.message}`); return; }

  await say(`⏰ Snoozed: *${task.title}*\nNew reminder: *${timeLabel}*`);
}

/**
 * !who [name]
 * Looks up a person in your memory log and returns what you know about them.
 *
 * Example:
 *   !who Jane
 */
async function handleWho(text, say) {
  const query = text.trim();
  if (!query) { await say('Usage: `!who [name]`'); return; }

  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('added_at', { ascending: false })
    .limit(5);

  if (error) { await say(`❌ Lookup failed: ${error.message}`); return; }
  if (!data?.length) { await say(`🤷 No memory found for _"${query}"_`); return; }

  const lines = data.map((m) => {
    const company = m.company ? ` · ${m.company}` : '';
    const context = m.context ? `\n_"${m.context}"_` : '';
    const tag = m.tag ? ` · ${m.tag}` : '';
    const date = new Date(m.added_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `🧠 *${m.name}*${company}${tag}\nAdded ${date}${context}`;
  });

  await say(lines.join('\n\n'));
}

module.exports = { handleTask, handleNote, handleTasks, handleDone, handleSnooze, handleWho };
