// imageParser.js — sends a screenshot to Claude and extracts prospect info
// Uses Haiku (cheapest model) since this is a simple extraction task.

const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function downloadImage(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  });
  const base64 = Buffer.from(response.data).toString('base64');
  const mimeType = response.headers['content-type'] || 'image/png';
  return { base64, mimeType };
}

/**
 * Parse a prospect from an image + optional text context the user typed.
 * Returns { name, company, context }
 */
async function parseProspectFromImage(imageUrl, userText = '') {
  const { base64, mimeType } = await downloadImage(imageUrl);

  // Include any text the user typed alongside the image as extra context
  const extraContext = userText
    ? `\nThe user also included this note with the image: "${userText}"`
    : '';

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', // Cheapest model, supports vision
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 },
          },
          {
            type: 'text',
            text: `This is a screenshot from LinkedIn or a similar professional network.${extraContext}

Extract the prospect info and reply ONLY in this exact JSON format (no extra text):
{
  "name": "Full Name or Unknown",
  "company": "Company Name or Unknown",
  "context": "One sentence: who this person is and what the interaction was"
}`,
          },
        ],
      },
    ],
  });

  const raw = message.content[0].text.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

module.exports = { parseProspectFromImage };
