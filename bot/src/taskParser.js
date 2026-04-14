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

Time parsing rules:
- "120pm" or "120 pm" means 1:20 PM (not 12:00 PM) — treat digits before "am/pm" as HHMM, so 120=1:20, 230=2:30, 900=9:00
- "12pm" means noon (12:00 PM)
- "1pm" means 1:00 PM

Examples:
"call sarah tomorrow 9am" → {"title":"call sarah","category":"call","reminder_time":"2026-04-12T09:00:00-07:00"}
"email john about proposal" → {"title":"email john about proposal","category":"email","reminder_time":null}
"linkedin message david next monday" → {"title":"linkedin message david","category":"linkedin","reminder_time":"2026-04-13T09:00:00-07:00"}
"message bridget 120pm today" → {"title":"message bridget","category":"other","reminder_time":"2026-04-13T13:20:00-07:00"}`
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

async function parseNoteWithAI(text) {
  // Extract URLs before sending to Claude so we can guarantee they're preserved
  const urlRegex = /https?:\/\/[^\s>]+/g;
  const urls = (text.match(urlRegex) || []).map(u => u.replace(/[>.,)]+$/, ''));

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `Parse this contact note and reply ONLY with valid JSON, no markdown:
"${text}"

{
  "name": "person's full name",
  "company": "company name or null if not mentioned",
  "context": "how they know them / what the interaction was — MUST include any URLs from the input verbatim, or null if nothing to include",
  "tag": "one of: linkedin-signal, post-like, event-met, warm-prospect, other"
}

IMPORTANT: If the input contains any URLs (http:// or https://), you MUST include them in the context field exactly as written.

Tag rules:
- linkedin-signal: saw their LinkedIn activity, they engaged with a post, connection request
- post-like: they liked or commented on a post
- event-met: met in person at an event, conference, meetup
- warm-prospect: interested in buying, referred, inbound lead
- other: anything else

Examples:
"Jane Smith from Acme, met her at SaaStr last week" → {"name":"Jane Smith","company":"Acme","context":"met at SaaStr last week","tag":"event-met"}
"john@corp.com liked our linkedin post" → {"name":"john@corp.com","company":"corp","context":"liked our LinkedIn post","tag":"post-like"}
"Mike https://linkedin.com/in/mike - warm lead" → {"name":"Mike","company":null,"context":"warm lead https://linkedin.com/in/mike","tag":"warm-prospect"}`
      }
    ]
  });

  const raw = message.content[0].text.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);

  // Safety net: re-append any URLs that Claude dropped
  if (urls.length > 0) {
    const contextHasAllUrls = urls.every(u => parsed.context?.includes(u));
    if (!contextHasAllUrls) {
      const missing = urls.filter(u => !parsed.context?.includes(u));
      parsed.context = [parsed.context, ...missing].filter(Boolean).join(' ');
    }
  }

  return parsed;
}

module.exports = { parseTaskWithAI, parseNoteWithAI };
