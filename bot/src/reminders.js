// reminders.js — polls Supabase every 60 seconds and fires reminder messages with buttons

const supabase = require('./supabase');
const { reminderBlock } = require('./blocks');

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
        text: `🧠 Reminder: ${task.title}`, // fallback text for notifications
        blocks: reminderBlock(task),
      });

      await supabase.from('tasks').update({ slack_scheduled: true }).eq('id', task.id);
      console.log(`[reminders] Sent reminder for task: "${task.title}"`);
    } catch (err) {
      console.error(`[reminders] Failed to send reminder for "${task.title}":`, err.message);
    }
  }
}

function startReminderPoller(slackClient, channelId) {
  console.log('[reminders] Reminder poller started (60s interval)');
  fireReminders(slackClient, channelId);
  setInterval(() => fireReminders(slackClient, channelId), 60_000);
}

module.exports = { startReminderPoller };
