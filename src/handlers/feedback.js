const userService = require('../services/userService');
const feedbackService = require('../services/feedbackService');
const { isNavigationText, mainMenuKeyboard, menuLabels } = require('../utils/keyboards');

function registerFeedbackHandlers(bot) {
  bot.hears(menuLabels.feedback, async (ctx) => {
    ctx.session.flow = null;
    await startFeedbackFlow(ctx);
  });

  bot.command('feedback', async (ctx) => {
    await startFeedbackFlow(ctx);
  });

  bot.on('text', async (ctx, next) => {
    const flow = ctx.session.flow;

    if (!flow || flow.type !== 'feedback') {
      return next();
    }

    if (isNavigationText(ctx.message.text.trim())) {
      ctx.session.flow = null;
      return next();
    }

    await handleFeedbackFlow(ctx, flow);
  });
}

async function startFeedbackFlow(ctx) {
  ctx.session.flow = { type: 'feedback', step: 'message' };
  await ctx.reply('Please write your feedback. What do you like or what can we improve?');
}

async function handleFeedbackFlow(ctx, flow) {
  const text = ctx.message.text.trim();

  if (flow.step === 'message') {
    const user = await userService.getByTelegramId(ctx.from.id);
    await feedbackService.saveFeedback(user.id, text);
    ctx.session.flow = null;
    await ctx.reply('Thank you for your feedback! 🙏', mainMenuKeyboard());
  }
}

module.exports = { registerFeedbackHandlers };
