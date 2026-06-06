require('dotenv').config();

const { createBot } = require('./bot');
const { startEventStartNotifier } = require('./services/notificationService');

const requiredEnv = ['BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_KEY'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const bot = createBot();
let stopEventStartNotifier = null;

bot.launch()
  .then(() => {
    stopEventStartNotifier = startEventStartNotifier(bot);
    console.log('ReadyUpBot is running.');
  })
  .catch((error) => {
    console.error('Failed to launch ReadyUpBot:', error);
    process.exit(1);
  });

process.once('SIGINT', () => stopBot('SIGINT'));
process.once('SIGTERM', () => stopBot('SIGTERM'));

function stopBot(signal) {
  if (stopEventStartNotifier) {
    stopEventStartNotifier();
  }

  bot.stop(signal);
}
