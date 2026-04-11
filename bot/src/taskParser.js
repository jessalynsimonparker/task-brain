// taskParser.js — uses Claude to parse natural language task commands
// Instead of rigid regex, Claude extracts title, category, and reminder time
// from whatever the user types naturally.

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Send the raw task text to Claude and get back structured data.
 * Returns { title, category, reminder_time (ISO string or null) }
 */
async function parseTaskWithAI(text) {
  const now = new Date();
  const nowStr = now.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  });

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', // Fast + cheap for this simple parsing task
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `Today is ${nowStr}.

Parse this task command and reply ONLY with valid JSON, no extra text:
"${text}"

Return this exact format:
{
  "title": "the task title without the date/time",
  "category": "call" | "email" | "linkedin" | "other",
  "reminder_time": "ISO 8601 datetime string or null"
}

Rules:
- category: infer from keywords (call/phone → call, email → email, linkedin → linkedin, else → other)
- reminder_time: convert any date/time mention to ISO 8601. If no time given but a date is mentioned, default to 9:00 AM. If no date/time at all, return null.
- title: the task description only, no date/time words in it`
      }
    ]
  });

  const raw = message.content[0].text.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

module.exports = { parseTaskWithAI };
