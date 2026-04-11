# Task Brain — Setup Guide

Follow these steps in order. Each section tells you exactly what to click.

---

## 1. Supabase — create your database

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**. Give it a name (e.g. `task-brain`). Save your database password somewhere.
3. Once the project loads, click **SQL Editor** in the left sidebar.
4. Click **New query**, paste the entire contents of `supabase/schema.sql`, and click **Run**.
5. You should see "Success. No rows returned." — that means the tables were created.

### Enable Realtime (so the dashboard updates live)
1. In Supabase, go to **Database > Replication** in the left sidebar.
2. Under **Source**, find the `tasks` and `memories` tables and toggle them **on**.

### Create the Storage bucket (for screenshot attachments)
1. Go to **Storage** in the left sidebar.
2. Click **New bucket**, name it `task-attachments`, and set it to **Public**.
3. Click **Create bucket**.

### Get your API keys
1. Go to **Project Settings > API** (gear icon, bottom left).
2. Copy:
   - **Project URL** → this is your `SUPABASE_URL`
   - **anon public** key → this is your `SUPABASE_ANON_KEY` (used by the dashboard)
   - **service_role** key → this is your `SUPABASE_SERVICE_ROLE_KEY` (used by the bot — keep this secret)

---

## 2. Slack — create your bot app

### Create the app
1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**.
2. Choose **From scratch**.
3. Name it `Task Brain`, select your workspace, click **Create App**.

### Enable Socket Mode
1. In the left sidebar, click **Socket Mode**.
2. Toggle it **on**.
3. It will ask you to create an App-Level Token. Name it anything (e.g. `task-brain-socket`).
4. Add the scope **`connections:write`** and click **Generate**.
5. Copy the token — it starts with `xapp-`. This is your `SLACK_APP_TOKEN`.

### Add OAuth scopes (what the bot is allowed to do)
1. Click **OAuth & Permissions** in the left sidebar.
2. Scroll to **Bot Token Scopes** and add these:
   - `chat:write` — so the bot can send messages
   - `channels:history` — so the bot can read messages in channels
   - `groups:history` — for private channels
   - `files:read` — so the bot can read image uploads
   - `im:history` — for direct messages (optional but useful)
3. Scroll up and click **Install to Workspace**.
4. Click **Allow**.
5. Copy the **Bot User OAuth Token** — starts with `xoxb-`. This is your `SLACK_BOT_TOKEN`.

### Enable Events (so the bot receives messages)
1. Click **Event Subscriptions** in the left sidebar.
2. Toggle **Enable Events** on.
3. Under **Subscribe to bot events**, add:
   - `message.channels`
   - `message.groups`
4. Click **Save Changes**.

### Invite the bot to your channel
1. Open Slack and go to **#jess-reminders**.
2. Type `/invite @Task Brain` and hit enter.
3. To find your channel ID: right-click the channel name > **View channel details** > scroll to the bottom. Copy the ID (starts with `C`). This is your `SLACK_CHANNEL_ID`.

---

## 3. Anthropic — get your API key

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign in.
2. Click **API Keys** in the left sidebar.
3. Click **Create Key**, name it `task-brain-bot`, and copy it.
4. This is your `ANTHROPIC_API_KEY`.

---

## 4. Deploy the bot to Railway

### First time setup
1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project > Deploy from GitHub repo**.
3. Select your `task-brain` repo.
4. Railway will detect the project. When it asks for the root directory, set it to **`bot`**.
5. Click **Deploy**.

### Add environment variables
1. Once deployed, click your service, then click the **Variables** tab.
2. Add each of these (copy from your notes above):

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
| `SLACK_BOT_TOKEN` | xoxb-... |
| `SLACK_APP_TOKEN` | xapp-... |
| `SLACK_CHANNEL_ID` | C0XXXXXXXXX |
| `ANTHROPIC_API_KEY` | sk-ant-... |

3. Railway will automatically redeploy after you save variables.
4. Click the **Logs** tab and confirm you see: `⚡ Task Brain bot running (Socket Mode)`

---

## 5. Set up the GitHub Pages dashboard

### Add Supabase credentials as GitHub Secrets
1. Go to your `task-brain` repo on GitHub.
2. Click **Settings > Secrets and variables > Actions**.
3. Click **New repository secret** and add:
   - Name: `REACT_APP_SUPABASE_URL` / Value: your Supabase URL
   - Name: `REACT_APP_SUPABASE_ANON_KEY` / Value: your anon key

### Enable GitHub Pages
1. In your repo, go to **Settings > Pages**.
2. Under **Source**, select **Deploy from a branch**.
3. Branch: `gh-pages`, folder: `/ (root)`. Click **Save**.

### Trigger your first deploy
1. Push any change to `main` in the `dashboard/` folder, OR manually trigger the workflow:
   - Go to **Actions** tab in your repo.
   - Click **Deploy Dashboard to GitHub Pages**.
   - Click **Run workflow**.
2. After ~2 minutes, your dashboard will be live at:
   **https://jessalynsimonparker.github.io/task-brain**

---

## 6. Connect Claude.ai chat to your tasks (optional but great)

This lets you add and query tasks by just talking to Claude at claude.ai.

1. Go to [claude.ai](https://claude.ai) and click your profile > **Settings**.
2. Find **Integrations** or **MCP Servers** (Claude.ai's name may vary — look for "Connect apps").
3. Add the **Supabase MCP** integration:
   - Supabase's official MCP guide: [supabase.com/docs/guides/ai/mcp](https://supabase.com/docs/guides/ai/mcp)
   - You'll paste in your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
4. Once connected, you can open a Claude.ai chat and say things like:
   - *"Add a task: call Sarah tomorrow at 9am, category call"*
   - *"What tasks do I have due this week?"*
   - *"Mark the Sarah call as done"*
   - *"Who is Jane Smith?"*

---

## Quick reference — bot commands

| Command | What it does |
|---------|-------------|
| `!task Call Sarah tomorrow 9am` | Creates a task with a reminder |
| `!task Email John about proposal` | Creates a task (no reminder) |
| `!note Jane Smith / Acme — met at SaaStr` | Saves a memory |
| `!tasks` | Lists all open tasks |
| `!done Call Sarah` | Marks matching task done |
| `!snooze Call Sarah` | Snoozes to tomorrow 10am |
| `!snooze Call Sarah 1hr` | Snoozes 1 hour from now |
| `!snooze Call Sarah friday 2pm` | Snoozes to a custom time |
| `!who Jane` | Looks up Jane in your memory log |
| *(upload an image)* | Claude parses it and saves to memory |

---

## Troubleshooting

**Bot isn't responding in Slack**
- Check Railway logs for errors
- Make sure the bot is invited to #jess-reminders (`/invite @Task Brain`)
- Confirm `SLACK_CHANNEL_ID` matches the actual channel ID (not the name)

**Dashboard is blank / not loading**
- Open browser DevTools > Console and check for errors
- Confirm GitHub Secrets are set correctly (no extra spaces)
- Make sure the `gh-pages` branch exists (GitHub Actions creates it on first deploy)

**Reminders aren't firing**
- The bot polls every 60 seconds — there may be up to a 1-minute delay
- Confirm `done = false` and `slack_scheduled = false` on the task in Supabase
- Check Railway logs for `[reminders]` lines
