// index.js — Task Brain Slack Bot entry point
// Uses Socket Mode — no public URL needed, works on Railway out of the box.

require('dotenv').config();

// Keep the process alive if Slack sends an unexpected disconnect during reconnect
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] Caught error, staying alive:', err.message);
});

const { App } = require('@slack/bolt');
const axios = require('axios');
const { handleTask, handleNote, handleDone, handleSnooze, handleWho } = require('./commands');
const { parseProspectFromImages } = require('./imageParser');
const { startReminderPoller } = require('./reminders');
const { tasksListBlocks, reminderBlock, linkPromptBlock } = require('./blocks');
const supabase = require('./supabase');

// ─── Validate required env vars on startup ───────────────────────────────────
const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SLACK_BOT_TOKEN',
  'SLACK_APP_TOKEN',
  'SLACK_CHANNEL_ID',
  'ANTHROPIC_API_KEY',
];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
}

// ─── Initialize Slack Bolt app in Socket Mode ─────────────────────────────────
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

// ─── In-memory state ──────────────────────────────────────────────────────────
// Tracks the most recently saved memory per Slack user (resets on bot restart)
const lastMemoryByUser = new Map(); // userId → { id, name, company }

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function uploadToStorage(slackUrl, fileId, mimeType) {
  try {
    const response = await axios.get(slackUrl, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    });
    const path = `screenshots/${Date.now()}-${fileId}.png`;
    const { error } = await supabase.storage
      .from('task-attachments')
      .upload(path, response.data, { contentType: mimeType || 'image/png' });
    if (error) return null;
    const { data } = supabase.storage.from('task-attachments').getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

function extractUrls(text) {
  return (text.match(/https?:\/\/[^\s>]+/g) || []).map(u => u.replace(/[>.,)]+$/, ''));
}

// Append new screenshots/context to an existing memory
async function appendToMemory(memoryId, imageFiles, text, say) {
  const { data: memory, error: fetchErr } = await supabase
    .from('memories').select('*').eq('id', memoryId).single();

  if (fetchErr || !memory) {
    await say(`❌ Couldn't find that memory.`);
    return;
  }

  // Parse new images for additional context
  let additionalContext = '';
  if (imageFiles.length > 0) {
    try {
      const imageUrls = imageFiles.map(f => f.url_private_download || f.url_private);
      const cleanText = text.replace(/save with.+/i, '').trim();
      const parsed = await parseProspectFromImages(imageUrls, cleanText);
      additionalContext = parsed.context || '';
    } catch (e) {
      console.error('[appendToMemory] parse error:', e.message);
    }
  }

  // Upload new images
  const newUrls = await Promise.all(
    imageFiles.map(f => uploadToStorage(f.url_private_download || f.url_private, f.id, f.mimetype))
  );
  const validUrls = newUrls.filter(Boolean);

  const newContext = [memory.context, additionalContext].filter(Boolean).join(' | ');
  const existingUrls = memory.attachment_url ? memory.attachment_url.split(',') : [];
  const allUrls = [...existingUrls, ...validUrls].join(',');

  await supabase.from('memories').update({
    context: newContext || null,
    attachment_url: allUrls || null,
  }).eq('id', memoryId);

  await say(`📎 Added to *${memory.name}*${additionalContext ? `\n_"${additionalContext}"_` : ''}`);
}

// After creating a task, check if there's a recent memory to link it to
async function maybePromptTaskLink(task, userId, text, say) {
  if (!task || !userId) return;
  const mem = lastMemoryByUser.get(userId);
  if (!mem) return;

  // Auto-link if user explicitly said so
  if (/\blink\s*(it\b|to\b)/i.test(text)) {
    await supabase.from('tasks').update({ memory_id: mem.id }).eq('id', task.id);
    await say(`🔗 Linked *${task.title}* to *${mem.name}*.`);
    return;
  }

  // Otherwise prompt
  await say({
    text: `Link this task to ${mem.name}?`,
    blocks: linkPromptBlock(task, mem),
  });
}

// ─── Shared handlers ──────────────────────────────────────────────────────────

async function handleTasksBlocks(say) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('done', false)
    .order('added_at', { ascending: true });

  if (error) { await say(`❌ Couldn't fetch tasks: ${error.message}`); return; }

  await say({
    text: `📋 Open Tasks (${(data || []).length})`,
    blocks: tasksListBlocks(data || []),
  });
}

async function handleDoneTasks(say) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('done', true)
    .order('added_at', { ascending: false })
    .limit(20);

  if (error) { await say(`❌ Couldn't fetch tasks: ${error.message}`); return; }
  if (!data?.length) { await say('No completed tasks yet.'); return; }

  const lines = data.map((t, i) => {
    const date = new Date(t.added_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${i + 1}. ~~${t.title}~~ _${t.category} · ${date}_`;
  });

  await say(`✅ *Completed Tasks (${data.length})*\n${lines.join('\n')}`);
}

async function handleHelp(say) {
  await say(
`📋 *Task Brain Commands*
━━━━━━━━━━━━━━━━
*Tasks*
\`/task call sarah tomorrow 9am\` — create a task (AI understands natural language)
\`/task call sarah, link it\` — create task + auto-link to last saved memory
\`/tasks\` — list open tasks with Done/Snooze buttons
\`/done-tasks\` — list completed tasks
\`/done [name]\` — mark task complete
\`/snooze [name]\` — snooze to tomorrow 10am
\`/snooze [name] 1hr\` — snooze 1 hour
\`/snooze [name] friday 2pm\` — snooze to custom time

*Memory Log*
\`/note Jane Smith from Acme, met at SaaStr\` — save a contact (any format)
\`/whois Jane\` — look up how you know someone
📸 *Drop a screenshot* — Claude auto-saves name, company, context
📸 *Drop screenshot + "save with last"* — adds to most recent memory
📸 *Drop screenshot + "save with Paul"* — adds to Paul's memory
\`!addto [name]\` *+ screenshot* — add screenshot to existing contact

*Other*
\`/help\` — show this list`
  );
}

// ─── Image upload handler ─────────────────────────────────────────────────────

async function handleImageUpload(imageFiles, text, say, userId) {
  // ── "save with last" ───────────────────────────────────────────────────────
  if (/\bsave with last\b/i.test(text)) {
    if (userId && lastMemoryByUser.has(userId)) {
      const mem = lastMemoryByUser.get(userId);
      await say(`📎 Adding to *${mem.name}*...`);
      await appendToMemory(mem.id, imageFiles, text, say);
    } else {
      await say(`❌ No recent memory to append to — save a memory first.`);
    }
    return;
  }

  // ── "save with [name]" ─────────────────────────────────────────────────────
  const saveWithMatch = text.match(/\bsave with\s+(.+)/i);
  if (saveWithMatch) {
    const nameQuery = saveWithMatch[1].trim();
    const { data: matches } = await supabase
      .from('memories').select('*')
      .ilike('name', `%${nameQuery}%`)
      .order('added_at', { ascending: false }).limit(1);

    if (matches?.length) {
      await say(`📎 Adding to *${matches[0].name}*...`);
      await appendToMemory(matches[0].id, imageFiles, text, say);
      if (userId) lastMemoryByUser.set(userId, { id: matches[0].id, name: matches[0].name, company: matches[0].company });
    } else {
      await say(`ℹ️ Couldn't find a memory for _"${nameQuery}"_ — saving as new memory.`);
      await createNewMemory(imageFiles, text, say, userId);
    }
    return;
  }

  // ── !addto / /addto ────────────────────────────────────────────────────────
  const addtoMatch = text.match(/^!?addto\s+(.+)/i);
  if (addtoMatch) {
    const nameQuery = addtoMatch[1].trim();
    await say(`🔍 Looking up _${nameQuery}_ and adding screenshot...`);

    const { data: matches } = await supabase
      .from('memories').select('*')
      .ilike('name', `%${nameQuery}%`)
      .order('added_at', { ascending: false }).limit(1);

    if (!matches?.length) {
      await say(`❌ No memory found matching _"${nameQuery}"_ — upload without /addto to create a new entry.`);
      return;
    }

    const memory = matches[0];
    const newUrls = await Promise.all(
      imageFiles.map(f => uploadToStorage(f.url_private_download || f.url_private, f.id, f.mimetype))
    );
    const validUrls = newUrls.filter(Boolean);
    const existingUrls = memory.attachment_url ? memory.attachment_url.split(',') : [];
    const allUrls = [...existingUrls, ...validUrls].join(',');

    await supabase.from('memories').update({ attachment_url: allUrls }).eq('id', memory.id);
    await say(`📎 Added ${validUrls.length} screenshot(s) to *${memory.name}*'s memory.`);
    return;
  }

  // ── New memory ─────────────────────────────────────────────────────────────
  await createNewMemory(imageFiles, text, say, userId);
}

async function createNewMemory(imageFiles, text, say, userId) {
  await say(`🔍 Got ${imageFiles.length > 1 ? imageFiles.length + ' images' : 'your image'} — parsing with Claude...`);

  try {
    const userText = text.replace(/^!?note\s*/i, '').trim();
    const imageUrls = imageFiles.map(f => f.url_private_download || f.url_private);
    const { name, company, context } = await parseProspectFromImages(imageUrls, userText);

    const typedUrls = extractUrls(userText);
    const contextWithUrls = typedUrls.length > 0 ? `${context} | ${typedUrls.join(' ')}` : context;

    const storedUrls = await Promise.all(
      imageFiles.map(f => uploadToStorage(f.url_private_download || f.url_private, f.id, f.mimetype))
    );
    const attachmentUrl = storedUrls.filter(Boolean).join(',');

    const { data: inserted, error } = await supabase.from('memories').insert({
      name, company, context: contextWithUrls, tag: 'other',
      attachment_url: attachmentUrl || null,
    }).select('id, name, company').single();

    if (error) throw new Error(error.message);

    // Track as most recent memory for this user
    if (userId) lastMemoryByUser.set(userId, { id: inserted.id, name: inserted.name, company: inserted.company });

    await say(`🧠 Memory saved!\n*Name:* ${name}\n*Company:* ${company}\n*Context:* ${context}${attachmentUrl ? '\n📎 Screenshot saved' : ''}`);
  } catch (err) {
    console.error('[image] Parse error:', err.message);
    await say(`❌ Couldn't parse image: ${err.message}`);
  }
}

// ─── Message listener (! commands + image uploads) ───────────────────────────
app.message(async ({ message, say }) => {
  if (message.subtype === 'bot_message' || message.bot_id) return;
  if (message.channel !== CHANNEL_ID) return;

  const text = (message.text || '').trim();
  const userId = message.user;
  const imageFiles = (message.files || []).filter(f => f.mimetype?.startsWith('image/'));

  if (imageFiles.length > 0) {
    await handleImageUpload(imageFiles, text, say, userId);
    return;
  }

  if (text.startsWith('!task ')) {
    const task = await handleTask(text.slice(6), say);
    await maybePromptTaskLink(task, userId, text, say);
  }
  else if (text.startsWith('!note ')) {
    const mem = await handleNote(text.slice(6), say);
    if (mem && userId) lastMemoryByUser.set(userId, mem);
  }
  else if (text === '!tasks')           await handleTasksBlocks(say);
  else if (text === '!done-tasks')      await handleDoneTasks(say);
  else if (text.startsWith('!done '))   await handleDone(text.slice(6), say);
  else if (text.startsWith('!snooze ')) await handleSnooze(text.slice(8), say);
  else if (text.startsWith('!whois '))  await handleWho(text.slice(7), say);
  else if (text === '!help')            await handleHelp(say);
});

// ─── Slash command listeners ──────────────────────────────────────────────────

app.command('/task', async ({ ack, command, say }) => {
  await ack();
  const task = await handleTask(command.text, say);
  await maybePromptTaskLink(task, command.user_id, command.text, say);
});

app.command('/note', async ({ ack, command, say }) => {
  await ack();
  const mem = await handleNote(command.text, say);
  if (mem && command.user_id) lastMemoryByUser.set(command.user_id, mem);
});

app.command('/tasks', async ({ ack, say }) => {
  await ack();
  await handleTasksBlocks(say);
});

app.command('/done-tasks', async ({ ack, say }) => {
  await ack();
  await handleDoneTasks(say);
});

app.command('/done', async ({ ack, command, say }) => {
  await ack();
  await handleDone(command.text, say);
});

app.command('/snooze', async ({ ack, command, say }) => {
  await ack();
  await handleSnooze(command.text, say);
});

app.command('/whois', async ({ ack, command, say }) => {
  await ack();
  await handleWho(command.text, say);
});

app.command('/addto', async ({ ack, command, say }) => {
  await ack();
  await say(`To add a screenshot to _${command.text}_'s memory, type \`!addto ${command.text}\` and attach the image in the same message.`);
});

app.command('/help', async ({ ack, say }) => {
  await ack();
  await handleHelp(say);
});

// ─── Button action handlers ───────────────────────────────────────────────────

app.action('task_done', async ({ ack, body, client }) => {
  await ack();
  const taskId = body.actions[0].value;
  const { data: task } = await supabase.from('tasks').select('title').eq('id', taskId).single();
  await supabase.from('tasks').update({ done: true }).eq('id', taskId);
  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: `✅ Done: ${task?.title || 'task'}`,
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `✅ Done: *${task?.title || 'task'}*` } }],
  });
});

app.action('task_snooze_1hr', async ({ ack, body, client }) => {
  await ack();
  const taskId = body.actions[0].value;
  const newTime = new Date(Date.now() + 60 * 60_000).toISOString();
  const { data: task } = await supabase.from('tasks').select('title, snooze_count').eq('id', taskId).single();
  await supabase.from('tasks').update({
    reminder_time: newTime,
    slack_scheduled: false,
    snooze_count: (task?.snooze_count || 0) + 1,
  }).eq('id', taskId);
  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: `⏰ Snoozed 1hr: ${task?.title || 'task'}`,
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `⏰ Snoozed *${task?.title || 'task'}* — reminding you in 1 hour.` } }],
  });
});

app.action('task_snooze_tomorrow', async ({ ack, body, client }) => {
  await ack();
  const taskId = body.actions[0].value;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const { data: task } = await supabase.from('tasks').select('title, snooze_count').eq('id', taskId).single();
  await supabase.from('tasks').update({
    reminder_time: tomorrow.toISOString(),
    slack_scheduled: false,
    snooze_count: (task?.snooze_count || 0) + 1,
  }).eq('id', taskId);
  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: `🌙 Snoozed til tomorrow: ${task?.title || 'task'}`,
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `🌙 Snoozed *${task?.title || 'task'}* — reminding you tomorrow at 10am.` } }],
  });
});

app.action('link_task_yes', async ({ ack, body, client }) => {
  await ack();
  const { taskId, memoryId } = JSON.parse(body.actions[0].value);
  const { data: mem } = await supabase.from('memories').select('name').eq('id', memoryId).single();
  await supabase.from('tasks').update({ memory_id: memoryId }).eq('id', taskId);
  await client.chat.postMessage({ channel: body.channel.id, text: `🔗 Linked to *${mem?.name || 'contact'}*.` });
});

app.action('link_task_skip', async ({ ack }) => {
  await ack();
});

// ─── Start ───────────────────────────────────────────────────────────────────
(async () => {
  await app.start();
  console.log('⚡ Task Brain bot running (Socket Mode)');
  startReminderPoller(app.client, CHANNEL_ID);
})();
