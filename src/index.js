require('dotenv').config();

const { createBot } = require('./bot');

const requiredEnv = ['BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_KEY'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const bot = createBot();

bot.launch()
  .then(() => {
    console.log('ReadyUpBot is running.');
  })
  .catch((error) => {
    console.error('Failed to launch ReadyUpBot:', error);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
