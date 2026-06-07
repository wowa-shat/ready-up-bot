const eventService = require('../services/eventService');
const eventStatusMessageService = require('../services/eventStatusMessageService');
const userService = require('../services/userService');

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
    await ctx.answerCbQuery(`Saved: ${status}`);
    await eventStatusMessageService.replaceEventStatusMessagesForGroup(ctx, refreshedEvent);
  });
}

module.exports = { registerResponseHandlers };
