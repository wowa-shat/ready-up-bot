const { mainMenuKeyboard, menuLabels } = require('../utils/keyboards');
const groupService = require('../services/groupService');
const userService = require('../services/userService');

function registerStartHandlers(bot) {
  bot.start(async (ctx) => {
    const payload = getStartPayload(ctx);

    if (payload?.startsWith('join_')) {
      await handleJoinPayload(ctx, payload.slice(5));
      return;
    }

    await ctx.reply(
      [
        '👋 Welcome to ReadyUpBot.',
        '',
        'Create groups, schedule events, and see who is ready to join.',
        '',
        'Commands:',
        '/creategroup - create a group',
        '/groups - list your groups',
        '/newevent - create an event for one of your groups',
        '/events - show upcoming events'
      ].join('\n'),
      mainMenuKeyboard()
    );
  });

  bot.command('menu', async (ctx) => {
    await ctx.reply('Choose an action:', mainMenuKeyboard());
  });

}

async function handleJoinPayload(ctx, inviteToken) {
  const group = await groupService.getGroupByInviteToken(inviteToken);

  if (!group) {
    await ctx.reply('This invite link is no longer available.', mainMenuKeyboard());
    return;
  }

  const user = await userService.getByTelegramId(ctx.from.id);
  await groupService.addMember(group.id, user.id);
  await ctx.reply(`✅ You joined ${group.name}.`, mainMenuKeyboard());
}

function getStartPayload(ctx) {
  const text = ctx.message?.text || '';
  const [, payload] = text.trim().split(/\s+/, 2);
  return payload || null;
}

module.exports = { registerStartHandlers };
