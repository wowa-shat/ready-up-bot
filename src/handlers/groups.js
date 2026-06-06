const groupService = require('../services/groupService');
const userService = require('../services/userService');
const {
  contactRequestKeyboard,
  groupActionsKeyboard,
  groupSelectionKeyboard,
  mainMenuKeyboard,
  menuLabels
} = require('../utils/keyboards');

function registerGroupHandlers(bot) {
  bot.hears(menuLabels.createGroup, async (ctx) => {
    await startCreateGroup(ctx);
  });

  bot.hears(menuLabels.listGroups, async (ctx) => {
    await sendGroups(ctx);
  });

  bot.hears(menuLabels.addMember, async (ctx) => {
    await startAddMember(ctx);
  });

  bot.command('creategroup', async (ctx) => {
    await startCreateGroup(ctx);
  });

  bot.command('groups', async (ctx) => {
    await sendGroups(ctx);
  });

  bot.command('addmember', async (ctx) => {
    const parts = ctx.message.text.trim().split(/\s+/);

    if (parts.length === 3) {
      await addMemberByCommand(ctx, parts[1], parts[2]);
      return;
    }

    await startAddMember(ctx);
  });

  bot.action(/^group:view:([0-9a-f-]+)$/i, async (ctx) => {
    const groupId = ctx.match[1];
    const user = await userService.getByTelegramId(ctx.from.id);
    const group = await groupService.getGroupForMember(groupId, user.id);

    if (!group) {
      await ctx.answerCbQuery('Group not found.');
      return;
    }

    const members = await groupService.listGroupMembers(group.id);
    const names = members
      .map((member) => member.users)
      .filter(Boolean)
      .map(formatUserName);

    await ctx.editMessageText(
      [
        `Group: ${group.name}`,
        `Members: ${members.length}`,
        '',
        names.length > 0 ? names.join('\n') : 'No members yet.'
      ].join('\n'),
      groupActionsKeyboard(group.id)
    );
    await ctx.answerCbQuery();
  });

  bot.action(/^group:add:([0-9a-f-]+)$/i, async (ctx) => {
    const groupId = ctx.match[1];
    const user = await userService.getByTelegramId(ctx.from.id);
    const group = await groupService.getGroupForAdmin(groupId, user.id);

    if (!group) {
      await ctx.answerCbQuery('Only the group creator can add members.');
      return;
    }

    ctx.session.flow = { type: 'add_member', step: 'contact_or_telegram_id', groupId };
    await ctx.reply(
      [
        `Adding a member to ${group.name}.`,
        'Send a Telegram contact if available, or send their numeric Telegram ID.',
        'The user must have opened this bot with /start before they can be added.'
      ].join('\n'),
      contactRequestKeyboard()
    );
    await ctx.answerCbQuery();
  });

  bot.on('contact', async (ctx, next) => {
    const flow = ctx.session.flow;

    if (!flow || flow.type !== 'add_member') {
      return next();
    }

    await handleAddMemberContact(ctx, flow);
  });

  bot.on('text', async (ctx, next) => {
    const flow = ctx.session.flow;

    if (!flow) {
      return next();
    }

    if (flow.type === 'create_group') {
      await handleCreateGroup(ctx);
      return;
    }

    if (flow.type === 'add_member') {
      await handleAddMemberFlow(ctx, flow);
      return;
    }

    return next();
  });
}

async function handleCreateGroup(ctx) {
  const name = ctx.message.text.trim();

  if (!name) {
    await ctx.reply('Send a non-empty group name.');
    return;
  }

  const user = await userService.getByTelegramId(ctx.from.id);
  const group = await groupService.createGroup(name, user.id);
  ctx.session.flow = null;

  await ctx.reply(`Group created: ${group.name}`, groupActionsKeyboard(group.id));
}

async function handleAddMemberFlow(ctx, flow) {
  const text = ctx.message.text.trim();

  if (flow.step === 'select_group') {
    await ctx.reply('Choose a group using the buttons, or use /addmember <group_id> <telegram_id>.');
    return;
  }

  if (flow.step === 'group_id') {
    ctx.session.flow = { ...flow, step: 'contact_or_telegram_id', groupId: text };
    await ctx.reply(
      'Send a Telegram contact if available, or send their numeric Telegram ID.',
      contactRequestKeyboard()
    );
    return;
  }

  if (flow.step === 'contact_or_telegram_id') {
    await addMemberByCommand(ctx, flow.groupId, text);
    ctx.session.flow = null;
  }
}

async function handleAddMemberContact(ctx, flow) {
  const contact = ctx.message.contact;

  if (!contact.user_id) {
    await ctx.reply(
      [
        'This contact does not include a Telegram user ID.',
        'Ask the user to open this bot with /start, then add them by their numeric Telegram ID.'
      ].join('\n'),
      mainMenuKeyboard()
    );
    return;
  }

  await addMemberByCommand(ctx, flow.groupId, String(contact.user_id));
  ctx.session.flow = null;
}

async function startCreateGroup(ctx) {
  ctx.session.flow = { type: 'create_group' };
  await ctx.reply('Send the group name.');
}

async function startAddMember(ctx) {
  const user = await userService.getByTelegramId(ctx.from.id);
  const groups = await groupService.listGroupsForUser(user.id);
  const ownGroups = groups.filter((group) => group.creator_id === user.id);

  if (ownGroups.length === 0) {
    await ctx.reply('You do not own any groups yet. Use Create group first.', mainMenuKeyboard());
    return;
  }

  ctx.session.flow = { type: 'add_member', step: 'select_group' };
  await ctx.reply('Choose a group:', groupSelectionKeyboard(ownGroups, 'group:add'));
}

async function sendGroups(ctx) {
  const user = await userService.getByTelegramId(ctx.from.id);
  const groups = await groupService.listGroupsForUser(user.id);

  if (groups.length === 0) {
    await ctx.reply('You are not a member of any groups yet. Use Create group first.', mainMenuKeyboard());
    return;
  }

  await ctx.reply('Your groups:', groupSelectionKeyboard(groups, 'group:view'));
}

async function addMemberByCommand(ctx, groupId, telegramIdText) {
  const telegramId = Number(telegramIdText);

  if (!Number.isInteger(telegramId)) {
    await ctx.reply('Telegram ID must be a numeric ID.');
    return;
  }

  const requester = await userService.getByTelegramId(ctx.from.id);
  const group = await groupService.getGroupForAdmin(groupId, requester.id);

  if (!group) {
    await ctx.reply('Group not found, or you are not the group creator.');
    return;
  }

  const member = await userService.getByTelegramId(telegramId);

  if (!member) {
    await ctx.reply('That user is not known yet. Ask them to use /start with the bot first.');
    return;
  }

  await groupService.addMember(groupId, member.id);
  await ctx.reply(`Added ${formatUserName(member)} to ${group.name}.`, mainMenuKeyboard());
}

function formatUserName(user) {
  if (user.username) {
    return `@${user.username}`;
  }

  return [user.first_name, user.last_name].filter(Boolean).join(' ') || String(user.telegram_id);
}

module.exports = { registerGroupHandlers };
