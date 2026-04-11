// imageParser.js — sends a screenshot/image to Claude and extracts prospect info
// Claude looks at the image and returns: name, company, context

const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Downloads an image from a Slack file URL and converts it to base64.
 * Slack file URLs require a Bearer token to access.
 */
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
 * Sends the image to Claude and asks it to extract prospect info.
 * Returns { name, company, context } or throws on failure.
 */
async function parseProspectFromImage(imageUrl) {
  const { base64, mimeType } = await downloadImage(imageUrl);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
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
            text: `This is a screenshot from LinkedIn or a similar professional network.
Extract the following and reply ONLY in this exact JSON format (no extra text):
{
  "name": "Full Name or Unknown",
  "company": "Company Name or Unknown",
  "context": "One sentence describing who this person is or what was notable about the post/interaction"
}`,
          },
        ],
      },
    ],
  });

  const raw = message.content[0].text.trim();

  // Strip markdown code fences if Claude wraps the JSON
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

module.exports = { parseProspectFromImage };
