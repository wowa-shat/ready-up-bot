const eventService = require('./eventService');
const groupService = require('./groupService');
const { formatEventStarted } = require('../utils/formatEvent');

const CHECK_INTERVAL_MS = 60 * 1000;

function startEventStartNotifier(bot) {
  let isRunning = false;

  async function tick() {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      await notifyStartedEvents(bot);
    } catch (error) {
      console.error('Failed to process event start notifications:', error);
    } finally {
      isRunning = false;
    }
  }

  const interval = setInterval(tick, CHECK_INTERVAL_MS);
  tick();

  return () => clearInterval(interval);
}

async function notifyStartedEvents(bot) {
  const events = await eventService.listEventsDueForStartNotification();

  for (const event of events) {
    const members = await groupService.listGroupMembers(event.group_id);
    const text = formatEventStarted(event);

    for (const member of members.map((row) => row.users).filter(Boolean)) {
      if (!member.telegram_id) {
        continue;
      }

      try {
        await bot.telegram.sendMessage(member.telegram_id, text);
      } catch (error) {
        console.error(`Failed to send start notification for event ${event.id} to ${member.telegram_id}:`, error.message);
      }
    }

    await eventService.markStartNotified(event.id);
  }
}

module.exports = { startEventStartNotifier };
