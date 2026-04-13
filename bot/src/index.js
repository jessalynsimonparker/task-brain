// index.js — Task Brain Slack Bot entry point
// Uses Socket Mode — no public URL needed, works on Railway out of the box.

require('dotenv').config();

const { App } = require('@slack/bolt');
const axios = require('axios');
const { handleTask, handleNote, handleDone, handleSnooze, handleWho } = require('./commands');
const { parseProspectFromImages } = require('./imageParser');
const { startReminderPoller } = require('./reminders');
const { tasksListBlocks } = require('./blocks');
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
  return text.match(/https?:\/\/[^\s]+/g) || [];
}

// ─── Shared handlers (used by both ! commands and / slash commands) ───────────

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
    .limit(20); // show last 20 completed

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
\`/tasks\` — list open tasks with Done/Snooze buttons
\`/done-tasks\` — list completed tasks
\`/done [name]\` — mark task complete
\`/snooze [name]\` — snooze to tomorrow 10am
\`/snooze [name] 1hr\` — snooze 1 hour
\`/snooze [name] friday 2pm\` — snooze to custom time

*Memory Log*
\`/note Jane Smith / Acme — met at SaaStr\` — save a contact
\`/whois Jane\` — look up how you know someone
📸 *Drop a screenshot* — Claude auto-saves name, company, context
📸 *Drop screenshot + type a URL* — URL is saved with the memory
\`/addto [name]\` *+ screenshot* — add screenshot to existing contact

*Other*
\`/help\` — show this list`
  );
}

// ─── Image upload handler (shared logic) ─────────────────────────────────────

async function handleImageUpload(imageFiles, text, say) {
  // !addto / /addto: append screenshot to existing memory
  const addtoMatch = text.match(/^!?addto\s+(.+)/i);
  if (addtoMatch) {
    const nameQuery = addtoMatch[1].trim();
    await say(`🔍 Looking up _${nameQuery}_ and adding screenshot...`);

    const { data: matches } = await supabase
      .from('memories')
      .select('*')
      .ilike('name', `%${nameQuery}%`)
      .order('added_at', { ascending: false })
      .limit(1);

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

  // New memory from image(s)
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

    const { error } = await supabase.from('memories').insert([{
      name, company, context: contextWithUrls, tag: 'other',
      attachment_url: attachmentUrl || null,
    }]);
    if (error) throw new Error(error.message);

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
  const imageFiles = (message.files || []).filter(f => f.mimetype?.startsWith('image/'));

  if (imageFiles.length > 0) {
    await handleImageUpload(imageFiles, text, say);
    return;
  }

  if (text.startsWith('!task '))        await handleTask(text.slice(6), say);
  else if (text.startsWith('!note '))   await handleNote(text.slice(6), say);
  else if (text === '!tasks')           await handleTasksBlocks(say);
  else if (text === '!done-tasks')      await handleDoneTasks(say);
  else if (text.startsWith('!done '))   await handleDone(text.slice(6), say);
  else if (text.startsWith('!snooze ')) await handleSnooze(text.slice(8), say);
  else if (text.startsWith('!whois '))  await handleWho(text.slice(7), say);
  else if (text === '!help')            await handleHelp(say);
});

// ─── Slash command listeners (/commands with autocomplete) ────────────────────

app.command('/task', async ({ ack, command, say }) => {
  await ack();
  await handleTask(command.text, say);
});

app.command('/note', async ({ ack, command, say }) => {
  await ack();
  await handleNote(command.text, say);
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
  // /addto needs an image — instruct user to use it with a file upload message
  await say(`To add a screenshot to _${command.text}_'s memory, type \`!addto ${command.text}\` and attach the image in the same message. Slash commands can't accept file uploads directly.`);
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
  await client.chat.postMessage({ channel: body.channel.id, text: `✅ Marked done: *${task?.title || 'task'}*` });
});

app.action('task_snooze_1hr', async ({ ack, body, client }) => {
  await ack();
  const taskId = body.actions[0].value;
  const newTime = new Date(Date.now() + 60 * 60_000).toISOString();
  const { data: task } = await supabase.from('tasks').select('title').eq('id', taskId).single();
  await supabase.from('tasks').update({ reminder_time: newTime, slack_scheduled: false }).eq('id', taskId);
  await client.chat.postMessage({ channel: body.channel.id, text: `⏰ Snoozed *${task?.title || 'task'}* — reminding you in 1 hour.` });
});

app.action('task_snooze_tomorrow', async ({ ack, body, client }) => {
  await ack();
  const taskId = body.actions[0].value;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const { data: task } = await supabase.from('tasks').select('title').eq('id', taskId).single();
  await supabase.from('tasks').update({ reminder_time: tomorrow.toISOString(), slack_scheduled: false }).eq('id', taskId);
  await client.chat.postMessage({ channel: body.channel.id, text: `🌙 Snoozed *${task?.title || 'task'}* — reminding you tomorrow at 10am.` });
});

// ─── Start ───────────────────────────────────────────────────────────────────
(async () => {
  await app.start();
  console.log('⚡ Task Brain bot running (Socket Mode)');
  startReminderPoller(app.client, CHANNEL_ID);
})();
