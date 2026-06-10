const { supabase } = require('../db/supabase');

async function saveFeedback(userId, message) {
  const { error } = await supabase
    .from('feedback')
    .insert({ user_id: userId, message });

  if (error) {
    throw error;
  }
}

module.exports = { saveFeedback };
