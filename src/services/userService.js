const { supabase } = require('../db/supabase');

async function upsertTelegramUser(from) {
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        telegram_id: from.id,
        username: from.username || null,
        first_name: from.first_name || null,
        last_name: from.last_name || null
      },
      { onConflict: 'telegram_id' }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getByTelegramId(telegramId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

module.exports = {
  getByTelegramId,
  upsertTelegramUser
};
