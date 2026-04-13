// blocks.js — Slack Block Kit message builders
// These functions return Slack "blocks" (rich message layouts with buttons).

/**
 * Build a task card with Done / Snooze 1hr / Tomorrow / Custom buttons.
 * task — the task row from Supabase
 */
function taskBlock(task) {
  const due = task.due_date ? ` · due ${task.due_date}` : '';
  const reminder = task.reminder_time
    ? ` · ⏰ ${new Date(task.reminder_time).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Los_Angeles' })}`
    : '';

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${task.title}*\n_${task.category}${due}${reminder}_${task.notes ? `\n${task.notes}` : ''}`,
      },
    },
    {
      type: 'actions',
      block_id: `task_actions_${task.id}`,
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '✅ Done', emoji: true },
          style: 'primary',
          action_id: 'task_done',
          value: task.id,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '⏰ 1hr', emoji: true },
          action_id: 'task_snooze_1hr',
          value: task.id,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '🌙 Tomorrow', emoji: true },
          action_id: 'task_snooze_tomorrow',
          value: task.id,
        },
      ],
    },
    { type: 'divider' },
  ];
}

/**
 * Build the full !tasks list as blocks.
 * Each task gets its own card with action buttons.
 */
function tasksListBlocks(tasks) {
  if (tasks.length === 0) {
    return [{ type: 'section', text: { type: 'mrkdwn', text: '🎉 No open tasks! You\'re all caught up.' } }];
  }

  const header = {
    type: 'header',
    text: { type: 'plain_text', text: `📋 Open Tasks (${tasks.length})`, emoji: true },
  };

  const taskCards = tasks.flatMap(taskBlock);
  return [header, ...taskCards];
}

/**
 * Build a reminder message block (fires when reminder_time hits).
 */
function reminderBlock(task) {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🧠 *${task.title}*${task.notes ? `\n${task.notes}` : ''}\n━━━━━━━━━━━━━━━━\n_${task.category} · Task Brain_`,
      },
    },
    {
      type: 'actions',
      block_id: `reminder_actions_${task.id}`,
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '✅ Done', emoji: true },
          style: 'primary',
          action_id: 'task_done',
          value: task.id,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '⏰ 1hr', emoji: true },
          action_id: 'task_snooze_1hr',
          value: task.id,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '🌙 Tomorrow 10am', emoji: true },
          action_id: 'task_snooze_tomorrow',
          value: task.id,
        },
      ],
    },
  ];
}

module.exports = { taskBlock, tasksListBlocks, reminderBlock };
