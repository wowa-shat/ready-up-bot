const { Telegraf, session, Markup } = require('telegraf');

const { registerStartHandlers } = require('../handlers/start');
const { registerGroupHandlers } = require('../handlers/groups');
const { registerEventHandlers } = require('../handlers/events');
const { registerResponseHandlers } = require('../handlers/responses');
const { registerFeedbackHandlers } = require('../handlers/feedback');
const userService = require('../services/userService');

const WEBAPP_URL = process.env.WEBAPP_URL;

function createBot() {
  const bot = new Telegraf(process.env.BOT_TOKEN);

  bot.use(session({ defaultSession: () => ({ flow: null }) }));

  bot.telegram.setMyCommands([
    { command: 'start', description: 'Show the main menu' },
    { command: 'menu', description: 'Show action buttons' },
    { command: 'creategroup', description: 'Create a group' },
    { command: 'groups', description: 'List your groups' },
    { command: 'newevent', description: 'Create an event' },
    { command: 'events', description: 'Show upcoming events' },
    { command: 'feedback', description: 'Send feedback' }
  ]).catch((error) => {
    console.error('Failed to set bot commands:', error.message);
  });

  // Set global menu button to open Mini App
  if (WEBAPP_URL) {
    bot.telegram.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: 'Open app',
        web_app: { url: WEBAPP_URL }
      }
    }).catch((error) => {
      console.error('Failed to set menu button:', error.message);
    });
  }

  bot.use(async (ctx, next) => {
    if (ctx.from) {
      await userService.upsertTelegramUser(ctx.from);
    }

    return next();
  });

  registerStartHandlers(bot);
  registerGroupHandlers(bot);
  registerEventHandlers(bot);
  registerResponseHandlers(bot);
  registerFeedbackHandlers(bot);

  bot.catch((error, ctx) => {
    console.error(`Bot error for update ${ctx.update.update_id}:`, error);
  });

  return bot;
}

module.exports = { createBot };
