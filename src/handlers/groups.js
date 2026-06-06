const groupService = require('../services/groupService');
const userService = require('../services/userService');
const {
  confirmDeleteGroupKeyboard,
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

  bot.command('creategroup', async (ctx) => {
    await startCreateGroup(ctx);
  });

  bot.command('groups', async (ctx) => {
    await sendGroups(ctx);
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
    const shareUrl = await createInviteShareUrl(ctx, group);

    await ctx.editMessageText(
      [
        `👥 ${group.name}`,
        '',
        `✅ Members: ${members.length}`,
        '',
        names.length > 0 ? names.join('\n') : 'No members yet.'
      ].join('\n'),
      groupActionsKeyboard(group.id, shareUrl)
    );
    await ctx.answerCbQuery();
  });

  bot.action(/^group:delete:([0-9a-f-]+)$/i, async (ctx) => {
    const groupId = ctx.match[1];
    const user = await userService.getByTelegramId(ctx.from.id);
    const group = await groupService.getGroupForAdmin(groupId, user.id);

    if (!group) {
      await ctx.answerCbQuery('Only the group creator can delete this group.');
      return;
    }

    await ctx.editMessageText(
      [
        `Delete ${group.name}?`,
        '',
        'This removes the group, its events, and all responses.'
      ].join('\n'),
      confirmDeleteGroupKeyboard(group.id)
    );
    await ctx.answerCbQuery();
  });

  bot.action(/^group:delete_confirm:([0-9a-f-]+)$/i, async (ctx) => {
    const groupId = ctx.match[1];
    const user = await userService.getByTelegramId(ctx.from.id);
    const group = await groupService.deleteGroupForAdmin(groupId, user.id);

    if (!group) {
      await ctx.answerCbQuery('Only the group creator can delete this group.');
      return;
    }

    ctx.session.flow = null;
    await ctx.editMessageText(`✅ Deleted ${group.name}.`);
    await ctx.reply('Choose what to do next:', mainMenuKeyboard());
    await ctx.answerCbQuery();
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

    return next();
  });
}

async function handleCreateGroup(ctx) {
  const name = ctx.message.text.trim();

  if (!name) {
    await ctx.reply('Send a group name to continue.');
    return;
  }

  const user = await userService.getByTelegramId(ctx.from.id);
  const group = await groupService.createGroup(name, user.id);
  const shareUrl = await createInviteShareUrl(ctx, group);
  ctx.session.flow = null;

  await ctx.reply(`✅ Group created: ${group.name}`, groupActionsKeyboard(group.id, shareUrl));
}

async function createInviteShareUrl(ctx, group) {
  const username = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
  const creator = await userService.getById(group.creator_id);
  const inviteLink = `https://t.me/${username}?start=join_${group.invite_token}`;
  const text = [
    `👋 Join my group in ReadyUpBot: ${group.name}`,
    '',
    `${formatUserName(creator)} invited you to coordinate events, ready checks, and player responses in one place.`,
    '',
    'Tap the link and you’ll be added automatically.'
  ].join('\n');

  return `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`;
}

async function startCreateGroup(ctx) {
  ctx.session.flow = { type: 'create_group' };
  await ctx.reply('What should this group be called?');
}

async function sendGroups(ctx) {
  const user = await userService.getByTelegramId(ctx.from.id);
  const groups = await groupService.listGroupsForUser(user.id);

  if (groups.length === 0) {
    await ctx.reply('You are not in any groups yet. Create one to get started.', mainMenuKeyboard());
    return;
  }

  await ctx.reply('Your groups:', groupSelectionKeyboard(groups, 'group:view'));
}

function formatUserName(user) {
  if (!user) {
    return 'Unknown user';
  }

  if (user.username) {
    return `@${user.username}`;
  }

  return [user.first_name, user.last_name].filter(Boolean).join(' ') || String(user.telegram_id);
}

module.exports = { registerGroupHandlers };
