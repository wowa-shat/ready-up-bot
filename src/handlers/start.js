const { mainMenuKeyboard, menuLabels } = require('../utils/keyboards');

function registerStartHandlers(bot) {
  bot.start(async (ctx) => {
    await ctx.reply(
      [
        'ReadyUpBot helps groups create events and collect Going, Maybe, and No responses.',
        '',
        'Commands:',
        '/creategroup - create a group',
        '/groups - list your groups',
        '/addmember - add a Telegram user ID to a group',
        '/newevent - create an event for one of your groups',
        '/myid - show your Telegram numeric ID'
      ].join('\n'),
      mainMenuKeyboard()
    );
  });

  bot.command('menu', async (ctx) => {
    await ctx.reply('Choose an action:', mainMenuKeyboard());
  });

  bot.command('myid', async (ctx) => {
    await sendTelegramId(ctx);
  });

  bot.hears(menuLabels.myId, async (ctx) => {
    await sendTelegramId(ctx);
  });
}

async function sendTelegramId(ctx) {
  await ctx.reply(`Your Telegram numeric ID: ${ctx.from.id}`, mainMenuKeyboard());
}

module.exports = { registerStartHandlers };
