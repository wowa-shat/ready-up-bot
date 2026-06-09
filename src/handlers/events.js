const eventService = require('../services/eventService');
const eventStatusMessageService = require('../services/eventStatusMessageService');
const groupService = require('../services/groupService');
const userService = require('../services/userService');
const { minutesFromNow } = require('../utils/time');
const {
  groupSelectionKeyboard,
  isNavigationText,
  mainMenuKeyboard,
  menuLabels,
  skipKeyboard
} = require('../utils/keyboards');

function registerEventHandlers(bot) {
  bot.hears(menuLabels.createEvent, async (ctx) => {
    ctx.session.flow = null;
    await startCreateEvent(ctx);
  });

  bot.hears(menuLabels.upcomingEvents, async (ctx) => {
    ctx.session.flow = null;
    await sendUpcomingEvents(ctx);
  });

  bot.command('events', async (ctx) => {
    await sendUpcomingEvents(ctx);
  });

  bot.command('newevent', async (ctx) => {
    const parts = ctx.message.text.trim().split(/\s+/);

    if (!parts[1]) {
      await startCreateEvent(ctx);
      return;
    }

    ctx.session.flow = {
      type: 'create_event',
      step: 'title',
      groupId: parts[1]
    };

    await ctx.reply('Send the event title.');
  });

  bot.action(/^event:group:([0-9a-f-]+)$/i, async (ctx) => {
    const groupId = ctx.match[1];
    const user = await userService.getByTelegramId(ctx.from.id);
    const group = await groupService.getGroupForMember(groupId, user.id);

    if (!group) {
      await ctx.answerCbQuery('Group not found.');
      return;
    }

    ctx.session.flow = { type: 'create_event', step: 'title', groupId };
    await ctx.reply(`Creating event for ${group.name}. Send the event title.`);
    await ctx.answerCbQuery();
  });

  bot.action('event:skip:description', async (ctx) => {
    const flow = ctx.session.flow;

    if (!flow || flow.type !== 'create_event' || flow.step !== 'description') {
      await ctx.answerCbQuery('Not available.');
      return;
    }

    ctx.session.flow = { ...flow, step: 'start_minutes', description: null };
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.reply('Starts in how many minutes? Send a number, for example 30.');
    await ctx.answerCbQuery('Skipped description');
  });

  bot.action('event:skip:required_players', async (ctx) => {
    const flow = ctx.session.flow;

    if (!flow || flow.type !== 'create_event' || flow.step !== 'required_players') {
      await ctx.answerCbQuery('Not available.');
      return;
    }

    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.answerCbQuery('Skipped required players');
    await createEvent(ctx, { ...flow, requiredPlayers: null });
  });

  bot.on('text', async (ctx, next) => {
    const flow = ctx.session.flow;

    if (!flow || flow.type !== 'create_event') {
      return next();
    }

    if (isNavigationText(ctx.message.text.trim())) {
      ctx.session.flow = null;
      return next();
    }

    await handleCreateEventFlow(ctx, flow);
  });
}

async function startCreateEvent(ctx) {
  const user = await userService.getByTelegramId(ctx.from.id);
  const groups = await groupService.listGroupsForUser(user.id);

  if (groups.length === 0) {
    await ctx.reply('You are not a member of any groups yet. Create a group first.');
    return;
  }

  ctx.session.flow = { type: 'create_event', step: 'select_group' };
  await ctx.reply('Choose a group for this event:', groupSelectionKeyboard(groups, 'event:group', 'nav:menu'));
}

async function sendUpcomingEvents(ctx) {
  const user = await userService.getByTelegramId(ctx.from.id);
  const groups = await groupService.listGroupsForUser(user.id);

  if (groups.length === 0) {
    await ctx.reply('You are not a member of any groups yet.', mainMenuKeyboard());
    return;
  }

  const events = await eventService.listUpcomingEventsForGroups(groups.map((group) => group.id));

  if (events.length === 0) {
    await ctx.reply('No upcoming events yet.', mainMenuKeyboard());
    return;
  }

  for (const event of events) {
    const responses = await eventService.listEventResponses(event.id);
    await eventStatusMessageService.replaceEventStatusMessage(ctx, event, user, responses);
  }

  await ctx.reply('Upcoming events refreshed.', mainMenuKeyboard());
}

async function handleCreateEventFlow(ctx, flow) {
  const text = ctx.message.text.trim();

  if (flow.step === 'select_group') {
    await ctx.reply('Choose a group using the buttons, or use /newevent <group_id>.');
    return;
  }

  if (flow.step === 'group_id') {
    ctx.session.flow = { ...flow, step: 'title', groupId: text };
    await ctx.reply('Send the event title.');
    return;
  }

  if (flow.step === 'title') {
    ctx.session.flow = { ...flow, step: 'description', title: text };
    await ctx.reply('Send the event description (or skip it).', skipKeyboard('event:skip:description'));
    return;
  }

  if (flow.step === 'description') {
    ctx.session.flow = { ...flow, step: 'start_minutes', description: text };
    await ctx.reply('Starts in how many minutes? Send a number, for example 30.');
    return;
  }

  if (flow.step === 'start_minutes') {
    const minutes = Number(text);

    if (!Number.isInteger(minutes) || minutes < 0) {
      await ctx.reply('Send a whole number of minutes, for example 30.');
      return;
    }

    ctx.session.flow = { ...flow, step: 'required_players', startMinutes: minutes };
    await ctx.reply('How many Going responses are required? (or skip it)', skipKeyboard('event:skip:required_players'));
    return;
  }

  if (flow.step === 'required_players') {
    const requiredPlayers = Number(text);

    if (!Number.isInteger(requiredPlayers) || requiredPlayers <= 0) {
      await ctx.reply('Send a positive whole number for required players.');
      return;
    }

    await createEvent(ctx, { ...flow, requiredPlayers });
  }
}

async function createEvent(ctx, flow) {
  const creator = await userService.getByTelegramId(ctx.from.id);
  const group = await groupService.getGroupForMember(flow.groupId, creator.id);

  if (!group) {
    await ctx.reply('Group not found, or you are not a member.');
    ctx.session.flow = null;
    return;
  }

  const event = await eventService.createEvent({
    groupId: group.id,
    creatorId: creator.id,
    title: flow.title,
    description: flow.description,
    startsAt: minutesFromNow(flow.startMinutes).toISOString(),
    requiredPlayers: flow.requiredPlayers
  });

  const members = await groupService.listGroupMembers(group.id);
  const recipients = members.map((member) => member.users).filter(Boolean);

  for (const member of recipients) {
    if (!member.telegram_id) {
      continue;
    }

    try {
      await eventStatusMessageService.sendEventStatusMessage(ctx, event, member, [], group.name);
    } catch (error) {
      console.error(`Failed to send event ${event.id} to ${member.telegram_id}:`, error.message);
    }
  }

  ctx.session.flow = null;
  await ctx.reply(`Event created for ${group.name}. Invites sent to ${recipients.length} members.`);
}

module.exports = { registerEventHandlers };
