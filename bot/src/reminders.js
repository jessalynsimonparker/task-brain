// reminders.js — polls Supabase every 60 seconds for tasks whose reminder_time
// has passed and haven't been sent yet, then fires a Slack message.

const supabase = require('./supabase');

/**
 * Format the Slack reminder message exactly as specced.
 */
function formatReminder(task) {
  const notes = task.notes ? `${task.notes}\n` : '';
  return (
    `🧠 *${task.title}*\n` +
    `${notes}` +
    `━━━━━━━━━━━━━━━━\n` +
    `_${task.category} · Task Brain_`
  );
}

/**
 * Finds all tasks where:
 *   - reminder_time is in the past
 *   - slack_scheduled = false  (not yet sent)
 *   - done = false
 * Sends each one to Slack, then marks slack_scheduled = true.
 */
async function fireReminders(slackClient, channelId) {
  const now = new Date().toISOString();

  const { data: dueTasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('done', false)
    .eq('slack_scheduled', false)
    .lte('reminder_time', now);

  if (error) {
    console.error('[reminders] Supabase query error:', error.message);
    return;
  }

  for (const task of dueTasks) {
    try {
      await slackClient.chat.postMessage({
        channel: channelId,
        text: formatReminder(task),
      });

      // Mark as sent so we don't fire it again
      await supabase
        .from('tasks')
        .update({ slack_scheduled: true })
        .eq('id', task.id);

      console.log(`[reminders] Sent reminder for task: "${task.title}"`);
    } catch (err) {
      console.error(`[reminders] Failed to send reminder for "${task.title}":`, err.message);
    }
  }
}

/**
 * Start the polling loop. Call this once at bot startup.
 * slackClient — the Slack WebClient instance from Bolt
 * channelId   — your SLACK_CHANNEL_ID env var
 */
function startReminderPoller(slackClient, channelId) {
  console.log('[reminders] Reminder poller started (60s interval)');
  // Run immediately on startup, then every 60 seconds
  fireReminders(slackClient, channelId);
  setInterval(() => fireReminders(slackClient, channelId), 60_000);
}

module.exports = { startReminderPoller };
