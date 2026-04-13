// taskParser.js — uses Claude to parse natural language task commands

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function parseTaskWithAI(text) {
  const now = new Date();
  const nowStr = now.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short'
  });

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `Today is ${nowStr}.

Parse this task and reply ONLY with valid JSON, no markdown, no extra text:
"${text}"

{
  "title": "task description only — remove all date/time words",
  "category": "call or email or linkedin or other",
  "reminder_time": "ISO 8601 with Pacific offset like 2026-04-12T09:00:00-07:00 or null if no time mentioned"
}

The user is in Pacific time (America/Los_Angeles). Always include the -07:00 or -08:00 offset in reminder_time (PDT is -07:00, PST is -08:00).

Examples:
"call sarah tomorrow 9am" → {"title":"call sarah","category":"call","reminder_time":"2026-04-12T09:00:00-07:00"}
"email john about proposal" → {"title":"email john about proposal","category":"email","reminder_time":null}
"linkedin message david next monday" → {"title":"linkedin message david","category":"linkedin","reminder_time":"2026-04-13T09:00:00-07:00"}`
      }
    ]
  });

  const raw = message.content[0].text.trim();
  console.log('[taskParser] raw response:', raw);
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);
  console.log('[taskParser] parsed:', JSON.stringify(parsed));
  return parsed;
}

module.exports = { parseTaskWithAI };
