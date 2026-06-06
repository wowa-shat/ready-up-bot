const { supabase } = require('../db/supabase');

async function createEvent({ groupId, creatorId, title, description, startsAt, requiredPlayers }) {
  const { data, error } = await supabase
    .from('events')
    .insert({
      group_id: groupId,
      creator_id: creatorId,
      title,
      description,
      starts_at: startsAt,
      required_players: requiredPlayers,
      status: 'open'
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getEventById(eventId) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function isUserEventMember(eventId, userId) {
  const event = await getEventById(eventId);

  if (!event) {
    return false;
  }

  const { data, error } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', event.group_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function upsertResponse(eventId, userId, status) {
  const { data, error } = await supabase
    .from('event_responses')
    .upsert(
      { event_id: eventId, user_id: userId, status },
      { onConflict: 'event_id,user_id' }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function listEventResponses(eventId) {
  const { data, error } = await supabase
    .from('event_responses')
    .select('status, users(*)')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

async function recomputeEventStatus(eventId) {
  const event = await getEventById(eventId);
  const responses = await listEventResponses(eventId);
  const goingCount = responses.filter((response) => response.status === 'going').length;
  const status = goingCount >= event.required_players ? 'full' : 'open';

  const { data, error } = await supabase
    .from('events')
    .update({ status })
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function setCreatorStatusMessage(eventId, chatId, messageId) {
  const { data, error } = await supabase
    .from('events')
    .update({
      creator_status_chat_id: chatId,
      creator_status_message_id: messageId
    })
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

module.exports = {
  createEvent,
  getEventById,
  isUserEventMember,
  listEventResponses,
  recomputeEventStatus,
  setCreatorStatusMessage,
  upsertResponse
};
