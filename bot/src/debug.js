#!/usr/bin/env node
// debug.js — run with: node src/debug.js
// Checks env vars, Supabase connectivity, and can replay a /note or /task parse.

require('dotenv').config();

const supabase = require('./supabase');
const { parseTaskWithAI, parseNoteWithAI } = require('./taskParser');

const args = process.argv.slice(2);
const command = args[0];

async function checkEnv() {
  console.log('\n── Env Vars ──────────────────────────────────────');
  const required = [
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'SLACK_CHANNEL_ID',
    'ANTHROPIC_API_KEY',
  ];
  let ok = true;
  for (const key of required) {
    const val = process.env[key];
    if (val) {
      console.log(`  ✅ ${key} = ${val.slice(0, 12)}...`);
    } else {
      console.log(`  ❌ ${key} — MISSING`);
      ok = false;
    }
  }
  return ok;
}

async function checkSupabase() {
  console.log('\n── Supabase ──────────────────────────────────────');
  try {
    const { data, error } = await supabase.from('tasks').select('id').limit(1);
    if (error) throw error;
    console.log(`  ✅ tasks table reachable (${data.length} row sampled)`);
  } catch (e) {
    console.log(`  ❌ tasks query failed: ${e.message}`);
  }
  try {
    const { data, error } = await supabase.from('memories').select('id').limit(1);
    if (error) throw error;
    console.log(`  ✅ memories table reachable (${data.length} row sampled)`);
  } catch (e) {
    console.log(`  ❌ memories query failed: ${e.message}`);
  }
}

async function checkRecentData() {
  console.log('\n── Recent Data ───────────────────────────────────');
  const { data: tasks } = await supabase.from('tasks').select('title, done, reminder_time').order('added_at', { ascending: false }).limit(3);
  console.log('  Last 3 tasks:');
  (tasks || []).forEach(t => console.log(`    • [${t.done ? 'done' : 'open'}] ${t.title}${t.reminder_time ? ' ⏰' : ''}`));

  const { data: mems } = await supabase.from('memories').select('name, company').order('added_at', { ascending: false }).limit(3);
  console.log('  Last 3 memories:');
  (mems || []).forEach(m => console.log(`    • ${m.name}${m.company ? ` · ${m.company}` : ''}`));
}

async function parseTask(text) {
  console.log(`\n── Parse Task ────────────────────────────────────`);
  console.log(`  Input: "${text}"`);
  try {
    const result = await parseTaskWithAI(text);
    console.log(`  Output:`);
    console.log(`    title:         ${result.title}`);
    console.log(`    category:      ${result.category}`);
    console.log(`    reminder_time: ${result.reminder_time || 'null'}`);
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}`);
  }
}

async function parseNote(text) {
  console.log(`\n── Parse Note ────────────────────────────────────`);
  console.log(`  Input: "${text}"`);
  try {
    const result = await parseNoteWithAI(text);
    console.log(`  Output:`);
    console.log(`    name:    ${result.name}`);
    console.log(`    company: ${result.company || 'null'}`);
    console.log(`    context: ${result.context || 'null'}`);
    console.log(`    tag:     ${result.tag}`);
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}`);
  }
}

async function main() {
  console.log('🔍 Task Brain Debug Tool');

  if (!command || command === 'check') {
    await checkEnv();
    await checkSupabase();
    await checkRecentData();
  } else if (command === 'task') {
    const text = args.slice(1).join(' ');
    if (!text) { console.log('Usage: node src/debug.js task "call sarah tomorrow 9am"'); process.exit(1); }
    await parseTask(text);
  } else if (command === 'note') {
    const text = args.slice(1).join(' ');
    if (!text) { console.log('Usage: node src/debug.js note "Jane Smith from Acme, met at SaaStr"'); process.exit(1); }
    await parseNote(text);
  } else {
    console.log(`
Usage:
  node src/debug.js              — check env, Supabase, recent data
  node src/debug.js task "..."   — test task parsing
  node src/debug.js note "..."   — test note parsing
    `);
  }

  console.log('');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
