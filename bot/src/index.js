// index.js — Task Brain Slack Bot entry point
// Uses Socket Mode — no public URL needed, works on Railway out of the box.

require('dotenv').config();

const { App } = require('@slack/bolt');
const axios = require('axios');
const { handleTask, handleNote, handleTasks, handleDone, handleSnooze, handleWho } = require('./commands');
const { parseProspectFromImages } = require('./imageParser');
const { startReminderPoller } = require('./reminders');
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

/**
 * Upload an image from a Slack file URL to Supabase Storage.
 * Returns the public URL, or null on failure.
 */
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

/**
 * Extract URLs from a string.
 */
function extractUrls(text) {
  return text.match(/https?:\/\/[^\s]+/g) || [];
}

// ─── Message listener ────────────────────────────────────────────────────────
app.message(async ({ message, say }) => {
  if (message.subtype === 'bot_message' || message.bot_id) return;
  if (message.channel !== CHANNEL_ID) return;

  const text = (message.text || '').trim();

  // ── Image uploads ───────────────────────────────────────────────────────────
  const imageFiles = (message.files || []).filter(f => f.mimetype?.startsWith('image/'));

  if (imageFiles.length > 0) {

    // ── !addto [name] + image: append screenshot to existing memory ────────────
    if (text.toLowerCase().startsWith('!addto ')) {
      const nameQuery = text.slice(7).trim();
      await say(`🔍 Looking up _${nameQuery}_ and adding screenshot...`);

      const { data: matches } = await supabase
        .from('memories')
        .select('*')
        .ilike('name', `%${nameQuery}%`)
        .order('added_at', { ascending: false })
        .limit(1);

      if (!matches?.length) {
        await say(`❌ No memory found matching _"${nameQuery}"_ — try uploading without !addto to create a new entry.`);
        return;
      }

      const memory = matches[0];

      // Upload all new screenshots and collect their URLs
      const newUrls = await Promise.all(
        imageFiles.map(f => uploadToStorage(f.url_private_download || f.url_private, f.id, f.mimetype))
      );
      const validUrls = newUrls.filter(Boolean);

      // Append new URLs to existing ones (comma-separated)
      const existingUrls = memory.attachment_url ? memory.attachment_url.split(',') : [];
      const allUrls = [...existingUrls, ...validUrls].join(',');

      await supabase.from('memories').update({ attachment_url: allUrls }).eq('id', memory.id);
      await say(`📎 Added ${validUrls.length} screenshot(s) to *${memory.name}*'s memory.`);
      return;
    }

    // ── New memory from image(s) ───────────────────────────────────────────────
    await say(`🔍 Got ${imageFiles.length > 1 ? imageFiles.length + ' images' : 'your image'} — parsing with Claude...`);

    try {
      const userText = text.replace(/^!note\s*/i, '').trim();

      // Send all images to Claude in one call
      const imageUrls = imageFiles.map(f => f.url_private_download || f.url_private);
      const { name, company, context } = await parseProspectFromImages(imageUrls, userText);

      // Append any typed URLs to context
      const typedUrls = extractUrls(userText);
      const contextWithUrls = typedUrls.length > 0
        ? `${context} | ${typedUrls.join(' ')}`
        : context;

      // Upload all screenshots to storage
      const storedUrls = await Promise.all(
        imageFiles.map(f => uploadToStorage(f.url_private_download || f.url_private, f.id, f.mimetype))
      );
      const attachmentUrl = storedUrls.filter(Boolean).join(',');

      const { error } = await supabase.from('memories').insert([{
        name, company, context: contextWithUrls, tag: 'other',
        attachment_url: attachmentUrl || null,
      }]);
      if (error) throw new Error(error.message);

      await say(`🧠 Memory saved!\n*Name:* ${name}\n*Company:* ${company}\n*Context:* ${context}`);
    } catch (err) {
      console.error('[image] Parse error:', err.message);
      await say(`❌ Couldn't parse image: ${err.message}`);
    }
    return;
  }

  // ── Text commands ──────────────────────────────────────────────────────────
  if (text.startsWith('!task '))        await handleTask(text.slice(6), say);
  else if (text.startsWith('!note '))   await handleNote(text.slice(6), say);
  else if (text === '!tasks')           await handleTasks(say);
  else if (text.startsWith('!done '))   await handleDone(text.slice(6), say);
  else if (text.startsWith('!snooze ')) await handleSnooze(text.slice(8), say);
  else if (text.startsWith('!who '))    await handleWho(text.slice(5), say);
  else if (text === '!help')            await handleHelp(say);
});

// ─── !help ───────────────────────────────────────────────────────────────────
async function handleHelp(say) {
  await say(
`📋 *Task Brain Commands*
━━━━━━━━━━━━━━━━
*Tasks*
\`!task call sarah tomorrow 9am\` — create a task (AI understands natural language)
\`!tasks\` — list all open tasks
\`!done [name]\` — mark task complete
\`!snooze [name]\` — snooze to tomorrow 10am
\`!snooze [name] 1hr\` — snooze 1 hour
\`!snooze [name] friday 2pm\` — snooze to custom time

*Memory Log*
\`!note Jane Smith / Acme — met at SaaStr\` — save a contact
\`!who Jane\` — look up how you know someone
📸 *Upload a screenshot* — Claude auto-saves name, company, context
📸 *Upload screenshot + type a URL* — URL is saved with the memory
\`!addto [name]\` *+ screenshot* — add screenshot to existing contact

*Other*
\`!help\` — show this list`
  );
}

// ─── Start ───────────────────────────────────────────────────────────────────
(async () => {
  await app.start();
  console.log('⚡ Task Brain bot running (Socket Mode)');
  startReminderPoller(app.client, CHANNEL_ID);
})();
