const eventService = require('./eventService');
const groupService = require('./groupService');
const { formatEventStatus } = require('../utils/formatEvent');

const CHECK_INTERVAL_MS = 30 * 1000;

function startEventStartNotifier(bot) {
  let isRunning = false;
  console.log(`[event-notifier] started, interval=${CHECK_INTERVAL_MS}ms`);

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

  return () => {
    clearInterval(interval);
    console.log('[event-notifier] stopped');
  };
}

async function notifyStartedEvents(bot) {
  const events = await eventService.listEventsDueForStartNotification();

  if (events.length > 0) {
    console.log(`[event-notifier] due events=${events.length}`);
  }

  for (const event of events) {
    const members = await groupService.listGroupMembers(event.group_id);
    const responses = await eventService.listEventResponses(event.id);
    const text = ['⏰ Event started', '', formatEventStatus(event, responses)].join('\n');
    let sentCount = 0;
    let failedCount = 0;

    for (const member of members.map((row) => row.users).filter(Boolean)) {
      if (!member.telegram_id) {
        continue;
      }

      try {
        await bot.telegram.sendMessage(member.telegram_id, text);
        sentCount += 1;
      } catch (error) {
        failedCount += 1;
        console.error(`Failed to send start notification for event ${event.id} to ${member.telegram_id}:`, error.message);
      }
    }

    console.log(
      `[event-notifier] event=${event.id} starts_at=${event.starts_at} members=${members.length} sent=${sentCount} failed=${failedCount}`
    );

    if (sentCount > 0 || members.length === 0) {
      await eventService.markStartNotified(event.id);
      console.log(`[event-notifier] marked notified event=${event.id}`);
    }
  }
}

module.exports = { startEventStartNotifier };
