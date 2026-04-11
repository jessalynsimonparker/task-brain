// imageParser.js — sends one or more screenshots to Claude and extracts prospect info
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
 * Parse prospect info from one or more images + optional user text.
 * Sending multiple images lets Claude see profile + post together.
 * Returns { name, company, context }
 */
async function parseProspectFromImages(imageUrls, userText = '') {
  // Download all images in parallel
  const images = await Promise.all(imageUrls.map(downloadImage));

  const extraContext = userText
    ? `\nThe user also included this note: "${userText}"`
    : '';

  // Build content array: all images first, then the text prompt
  const content = [
    ...images.map(({ base64, mimeType }) => ({
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: base64 },
    })),
    {
      type: 'text',
      text: `These are screenshots from LinkedIn or a similar professional network.${extraContext}

Extract the prospect info and reply ONLY in this exact JSON format (no extra text):
{
  "name": "Full Name or Unknown",
  "company": "Company Name or Unknown",
  "context": "One sentence: who this person is and what the interaction was"
}`,
    },
  ];

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content }],
  });

  const raw = message.content[0].text.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

module.exports = { parseProspectFromImages };
