// index.js — Task Brain Slack Bot entry point
// Uses Socket Mode — no public URL needed, works on Railway out of the box.

require('dotenv').config();

const { App } = require('@slack/bolt');
const { handleTask, handleNote, handleTasks, handleDone, handleSnooze, handleWho } = require('./commands');
const { parseProspectFromImage } = require('./imageParser');
const { startReminderPoller } = require('./reminders');
const supabase = require('./supabase');

// ─── Validate required env vars on startup ───────────────────────────────────
const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SLACK_BOT_TOKEN',
  'SLACK_APP_TOKEN',      // Socket Mode requires an app-level token (xapp-...)
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
// Socket Mode: the bot connects OUT to Slack over a WebSocket.
// No public URL or Slack event subscription URL needed.
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

// ─── Message listener ────────────────────────────────────────────────────────
app.message(async ({ message, say }) => {
  // Ignore bot messages to avoid reply loops
  if (message.subtype === 'bot_message' || message.bot_id) return;
  // Only respond in the target channel
  if (message.channel !== CHANNEL_ID) return;

  const text = (message.text || '').trim();

  // ── Image upload → Claude parses → saves to memory log ─────────────────────
  if (message.files && message.files.length > 0) {
    for (const file of message.files) {
      if (!file.mimetype?.startsWith('image/')) continue;

      await say('🔍 Got your image — parsing with Claude...');

      try {
        const imageUrl = file.url_private_download || file.url_private;
        // Pass any text the user typed alongside the image as extra context
        const userText = text.replace(/^!note\s*/i, '').trim();
        const { name, company, context } = await parseProspectFromImage(imageUrl, userText);

        const { error } = await supabase.from('memories').insert([
          { name, company, context, tag: 'other' },
        ]);
        if (error) throw new Error(error.message);

        await say(
          `🧠 Memory saved from image!\n*Name:* ${name}\n*Company:* ${company}\n*Context:* ${context}`
        );
      } catch (err) {
        console.error('[image] Parse error:', err.message);
        await say(`❌ Couldn't parse image: ${err.message}`);
      }
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
  // Anything else is silently ignored
});

// ─── Start ───────────────────────────────────────────────────────────────────
(async () => {
  await app.start();
  console.log('⚡ Task Brain bot running (Socket Mode)');
  startReminderPoller(app.client, CHANNEL_ID);
})();
