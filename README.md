# ReadyUpBot

ReadyUpBot is a Telegram bot for creating group events and collecting Going, Maybe, and No responses from members.

## BotFather Setup

1. Open Telegram and start a chat with `@BotFather`.
2. Run `/newbot`.
3. Follow the prompts to choose a bot name and username.
4. Copy the bot token. This value is used as `BOT_TOKEN`.

## Environment Setup

Copy `.env.example` to `.env` and fill in the values:

```bash
BOT_TOKEN=your_telegram_bot_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_or_anon_key
```

For local development, an anon key can work if your Supabase policies allow the bot operations. For production MVP usage, a service role key is simpler, but it must only be stored as a secure server-side environment variable.

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL Editor.
3. Paste and run `src/db/schema.sql`.
4. Confirm these tables were created:
   `users`, `groups`, `group_members`, `events`, and `event_responses`.

`schema.sql` is a clean MVP reset script: it drops and recreates these five bot tables before creating the schema. Do not run it against production data unless you intend to reset the bot database.

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
- `/addmember` starts a flow to add a member by Telegram numeric ID.
- `/addmember <group_id> <telegram_id>` adds a member directly.
- `/newevent` starts the event creation flow.
- `/newevent <group_id>` starts event creation for a specific group.
- `/myid` shows your Telegram numeric ID for fallback member invites.

The main menu also provides buttons for creating groups, listing groups, adding members, creating events, and showing your Telegram ID. Group lists are shown as inline buttons; selecting a group opens group actions.

Group creators can delete a group from the group actions screen. Deleting a group also deletes its members, events, and responses through database cascade rules.

Members must use `/start` before they can be added. The add-member flow asks the group creator to choose a group, then send a Telegram contact or a numeric Telegram ID. Telegram only includes a usable `user_id` for some shared contacts, so `/myid` remains the reliable fallback.

When an event is created, group members receive inline buttons for `Going`, `Maybe`, and `No`. Each response is upserted in `event_responses`. After each response, the event status is recomputed and marked `full` once the Going count reaches `required_players`. The creator receives a live status message with Going, Maybe, and No lists.

## Deployment

Render and Railway both work for this MVP:

1. Push the project to a Git repository.
2. Create a new Node.js service.
3. Set the start command to `npm start`.
4. Add `BOT_TOKEN`, `SUPABASE_URL`, and `SUPABASE_KEY` as secure environment variables.
5. Deploy the service.

## Production Notes

- Use always-on hosting. Polling bots stop responding if the service sleeps.
- Store environment variables securely. Never commit `.env`.
- Prefer a server-side Supabase key only on trusted backend hosting.
- For higher reliability, consider switching from polling to Telegram webhooks.
- If using webhooks, configure a public HTTPS endpoint and update the Telegraf startup code accordingly.
- Add row-level security policies if you expose Supabase from clients. This bot currently assumes server-side-only database access.
