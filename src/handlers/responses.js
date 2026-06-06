const eventService = require('../services/eventService');
const userService = require('../services/userService');
const { formatCreatorStatus } = require('../utils/formatEvent');

function registerResponseHandlers(bot) {
  bot.action(/^response:([0-9a-f-]+):(going|maybe|no)$/i, async (ctx) => {
    const [, eventId, status] = ctx.match;
    const user = await userService.getByTelegramId(ctx.from.id);

    if (!user) {
      await ctx.answerCbQuery('Use /start first.');
      return;
    }

    const event = await eventService.getEventById(eventId);

    if (!event) {
      await ctx.answerCbQuery('Event not found.');
      return;
    }

    const isMember = await eventService.isUserEventMember(eventId, user.id);

    if (!isMember) {
      await ctx.answerCbQuery('You are not a member of this group.');
      return;
    }

    await eventService.upsertResponse(eventId, user.id, status);
    const refreshedEvent = await eventService.recomputeEventStatus(eventId);
    await updateCreator(ctx, refreshedEvent);

    await ctx.answerCbQuery(`Saved: ${status}`);
  });
}

async function updateCreator(ctx, event) {
  if (!event.creator_status_chat_id) {
    return;
  }

  const responses = await eventService.listEventResponses(event.id);
  const text = formatCreatorStatus(event, responses);

  if (event.creator_status_message_id) {
    try {
      await ctx.telegram.editMessageText(
        event.creator_status_chat_id,
        event.creator_status_message_id,
        undefined,
        text
      );
      return;
    } catch (error) {
      console.error(`Failed to edit creator status for event ${event.id}:`, error.message);
    }
  }

  await ctx.telegram.sendMessage(event.creator_status_chat_id, text);
}

module.exports = { registerResponseHandlers };
