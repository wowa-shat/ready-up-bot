# ReadyUpBot

ReadyUpBot is a Telegram bot for creating group events and collecting Going, Maybe, and No responses from members. It now also includes a **Telegram Mini App** for a full in-app interface.

## BotFather Setup

1. Open Telegram and start a chat with `@BotFather`.
2. Run `/newbot`.
3. Follow the prompts to choose a bot name and username.
4. Copy the bot token. This value is used as `BOT_TOKEN`.
5. **Mini App**: In BotFather, go to your bot settings and set a **Menu Button** URL or use the bot's built-in `setChatMenuButton` call. The URL should point to your deployed Mini App (e.g., `https://your-domain.com/webapp`).

## Environment Setup

Copy `.env.example` to `.env` and fill in the values:

```bash
BOT_TOKEN=your_telegram_bot_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_or_anon_key
WEBAPP_URL=https://your-domain.com/webapp
```

- `SUPABASE_KEY` for the **bot backend** should be a service role key (server-side only).
- The **Mini App** uses the **anon key** (public, safe for browsers). You will paste it into `webapp/app.js` or serve it via config.
- `WEBAPP_URL` is the public URL where your `webapp/` folder is hosted. The bot uses it for the Menu Button and inline buttons.

For local development, an anon key can work if your Supabase policies allow the bot operations. For production MVP usage, a service role key is simpler, but it must only be stored as a secure server-side environment variable.

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL Editor.
3. Paste and run `src/db/schema.sql`.
4. Confirm these tables were created:
   `users`, `groups`, `group_members`, `events`, `event_responses`, `event_status_messages`, and `feedback`.

`schema.sql` is a clean MVP reset script: it drops and recreates these bot tables before creating the schema. Do not run it against production data unless you intend to reset the bot database.

## Running Locally

Install dependencies:

```bash
npm install
```

Start the bot:

```bash
npm start
```

The bot uses long polling by default through Telegraf.

## Telegram UX

Available commands:

- `/start` registers the user and shows commands.
- `/menu` shows the persistent action buttons.
- `/creategroup` starts the group creation flow.
- `/groups` lists groups you belong to.
- `/newevent` starts the event creation flow.
- `/newevent <group_id>` starts event creation for a specific group.
- `/events` shows upcoming events that have not started yet.
- `/feedback` sends feedback to the team.

The main menu also provides buttons for creating groups, listing groups, creating events, showing upcoming events, and sending feedback. Group lists are shown as inline buttons; selecting a group opens group actions.

Group creators can delete a group from the group actions screen. Deleting a group also deletes its members, events, and responses through database cascade rules.

The group actions screen has a vertical action column: `Create event`, `Share Invite Link`, and `Delete group`.

`Share Invite Link` opens Telegram's share dialog. The shared message is formatted as a group invitation with the group name, creator, and invite link. The link looks like `https://t.me/ReadyUpBot?start=join_XYZ123`. When a friend opens it, the bot registers them and adds them to the group.

New projects can run `src/db/schema.sql` directly.

When an event is created, group members receive one event status message with inline buttons for `Going`, `Maybe`, and `No`. Each response is upserted in `event_responses`. After each response, the event status is recomputed and marked `full` once the Going count reaches `required_players`. The bot deletes each member's previous event status message and sends a fresh one with updated Going, Maybe, and No lists plus the response buttons.

The bot checks for started events every 30 seconds. When an event start time has passed, it sends a start notification to group members and deletes the past event from the database. Related responses are deleted by cascade rules. Railway logs include `[event-notifier]` lines for startup, due event count, send results, and deleted past events.

### Event Cancellation

Event creators see a **❌ Cancel event** button on their event status message. When pressed, the event is marked `cancelled`, all members' status messages are deleted, and each member receives a cancellation notice.

Cancelled events are excluded from the upcoming events list.

### Feedback

Use the **Feedback** button or `/feedback` command to send feedback. Feedback is saved to the `feedback` table. Run `src/db/get_all_feedback.sql` in the Supabase SQL Editor to export all feedback with user info.

## Mini App

The `webapp/` folder contains a Telegram Mini App with the same functionality:

- View your groups and members
- View upcoming events
- Respond to events (Going / Maybe / No)
- Create new groups
- Create new events
- Cancel events (if you are the creator)

### Mini App Setup

1. **Configure Supabase credentials** in `webapp/app.js`:
   ```js
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_KEY = 'your-supabase-anon-key';
   ```
   Or serve them via `window.READYUP_CONFIG` from your host page.

2. **Deploy the `webapp/` folder** to any static host:
   - Vercel, Netlify, GitHub Pages, Cloudflare Pages, or your own server.
   - The folder only contains static HTML/CSS/JS — no build step required.

3. **Set `WEBAPP_URL`** in your bot's `.env`:
   ```
   WEBAPP_URL=https://your-domain.com/webapp
   ```

4. **Restart the bot**. It will:
   - Set the global Menu Button to "Open app" pointing to your Mini App
   - Show an inline "📱 Open app" button in the `/start` message

### Mini App Security Notes

- The Mini App uses your Supabase **anon key** (public). RLS policies are enabled in `schema.sql` to restrict access.
- For production hardening, consider adding an Edge Function that validates Telegram `initData` before allowing database operations.
- The current RLS setup is a pragmatic MVP balance: tables are protected, but policies are permissive enough for the Mini App to work without a backend proxy.

## Deployment

Render and Railway both work for this MVP:

1. Push the project to a Git repository.
2. Create a new Node.js service.
3. Set the start command to `npm start`.
4. Add `BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY`, and `WEBAPP_URL` as secure environment variables.
5. Deploy the service.
6. Deploy the `webapp/` folder separately to a static host (or serve it from the same Node.js app).

## Production Notes

- Use always-on hosting. Polling bots stop responding if the service sleeps.
- Store environment variables securely. Never commit `.env`.
- Prefer a server-side Supabase key only on trusted backend hosting.
- For higher reliability, consider switching from polling to Telegram webhooks.
- If using webhooks, configure a public HTTPS endpoint and update the Telegraf startup code accordingly.
- Add row-level security policies if you expose Supabase from clients. This bot currently assumes server-side-only database access for the backend, but the Mini App uses the anon key with RLS.
