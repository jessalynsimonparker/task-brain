// reminders.js — polls every 60s, fires reminders + hourly re-reminders + daily morning briefing

const supabase = require('./supabase');
const { reminderBlock } = require('./blocks');

let lastMorningBriefDate = '';

async function fireReminders(slackClient, channelId) {
  const now = new Date();
  const nowIso = now.toISOString();
  const oneHourAgo = new Date(now - 60 * 60_000).toISOString();

  // ── Initial reminders (first fire) ──────────────────────────────────────────
  const { data: dueTasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('done', false)
    .eq('slack_scheduled', false)
    .lte('reminder_time', nowIso);

  if (error) {
    console.error('[reminders] Query error:', error.message);
    return;
  }

  for (const task of dueTasks || []) {
    try {
      await slackClient.chat.postMessage({
        channel: channelId,
        text: `🧠 Reminder: ${task.title}`,
        blocks: reminderBlock(task),
      });
      await supabase.from('tasks').update({
        slack_scheduled: true,
        last_reminded_at: nowIso,
      }).eq('id', task.id);
      console.log(`[reminders] Sent reminder for: "${task.title}"`);
    } catch (err) {
      console.error(`[reminders] Failed: "${task.title}":`, err.message);
    }
  }

  // ── Hourly re-reminders for overdue tasks ────────────────────────────────────
  const { data: overdueTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('done', false)
    .eq('slack_scheduled', true)
    .lte('reminder_time', nowIso)
    .or(`last_reminded_at.is.null,last_reminded_at.lte.${oneHourAgo}`);

  for (const task of overdueTasks || []) {
    try {
      await slackClient.chat.postMessage({
        channel: channelId,
        text: `⏰ Still pending: ${task.title}`,
        blocks: reminderBlock(task),
      });
      await supabase.from('tasks').update({ last_reminded_at: nowIso }).eq('id', task.id);
      console.log(`[reminders] Hourly re-reminder for: "${task.title}"`);
    } catch (err) {
      console.error(`[reminders] Re-reminder failed: "${task.title}":`, err.message);
    }
  }
}

async function fireMorningBriefing(slackClient, channelId) {
  const nowPTStr = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const nowPT = new Date(nowPTStr);
  const hour = nowPT.getHours();
  const minute = nowPT.getMinutes();
  const dateStr = nowPT.toDateString();

  // Fire between 9:00–9:05am PT, once per day
  if (hour !== 9 || minute > 5 || lastMorningBriefDate === dateStr) return;
  lastMorningBriefDate = dateStr;

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); // YYYY-MM-DD
  const nowIso = new Date().toISOString();

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('done', false)
    .order('added_at', { ascending: true });

  if (!tasks?.length) return;

  const overdue = tasks.filter(t => t.reminder_time && new Date(t.reminder_time) < new Date() && t.slack_scheduled);
  const dueToday = tasks.filter(t => t.due_date === todayStr && !overdue.find(o => o.id === t.id));

  if (!overdue.length && !dueToday.length) return;

  let text = `☀️ *Good morning! Here's what needs your attention today:*`;

  if (overdue.length) {
    text += `\n\n*Overdue (${overdue.length}):*\n`;
    text += overdue.map(t => {
      const snooze = t.snooze_count > 0 ? ` _(avoided ${t.snooze_count}×)_` : '';
      return `• *${t.title}*${snooze}`;
    }).join('\n');
  }

  if (dueToday.length) {
    text += `\n\n*Due today (${dueToday.length}):*\n`;
    text += dueToday.map(t => `• *${t.title}*`).join('\n');
  }

  await slackClient.chat.postMessage({ channel: channelId, text });
  console.log('[reminders] Morning briefing sent');
}

function startReminderPoller(slackClient, channelId) {
  console.log('[reminders] Reminder poller started (60s interval)');
  fireReminders(slackClient, channelId);
  fireMorningBriefing(slackClient, channelId);
  setInterval(async () => {
    await fireReminders(slackClient, channelId);
    await fireMorningBriefing(slackClient, channelId);
  }, 60_000);
}

module.exports = { startReminderPoller };
