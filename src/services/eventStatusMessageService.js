const eventService = require('./eventService');
const groupService = require('./groupService');
const { formatEventStatus } = require('../utils/formatEvent');
const { eventActionsKeyboard } = require('../utils/keyboards');

async function sendEventStatusMessage(ctx, event, user, responses = [], groupName = null) {
  if (!user?.telegram_id) {
    return null;
  }

  const isCreator = user.id === event.creator_id;
  const sentMessage = await ctx.telegram.sendMessage(
    user.telegram_id,
    formatEventStatus(event, responses, groupName),
    eventActionsKeyboard(event.id, isCreator)
  );

  await eventService.upsertEventStatusMessage(
    event.id,
    user.id,
    user.telegram_id,
    sentMessage.message_id
  );

  return sentMessage;
}

async function replaceEventStatusMessage(ctx, event, user, responses = null, statusMessage = null) {
  if (!user?.telegram_id) {
    return null;
  }

  const eventResponses = responses || await eventService.listEventResponses(event.id);
  const currentStatusMessage =
    statusMessage || await getEventStatusMessageForUser(event.id, user.id) || getLegacyCreatorMessage(event, user);
  let deletedOldStatusMessage = false;

  if (currentStatusMessage) {
    deletedOldStatusMessage = await deleteTelegramMessage(
      ctx,
      event.id,
      currentStatusMessage.chat_id,
      currentStatusMessage.message_id
    );

    if (!deletedOldStatusMessage) {
      const editedOldStatusMessage = await editTelegramMessage(
        ctx,
        event,
        eventResponses,
        currentStatusMessage.chat_id,
        currentStatusMessage.message_id,
        user
      );

      if (editedOldStatusMessage) {
        await eventService.upsertEventStatusMessage(
          event.id,
          user.id,
          user.telegram_id,
          currentStatusMessage.message_id
        );
        return editedOldStatusMessage;
      }
    }
  }

  try {
    return await sendEventStatusMessage(ctx, event, user, eventResponses);
  } catch (error) {
    console.error(`Failed to send event status ${event.id} to ${user.telegram_id}:`, error.message);

    if (deletedOldStatusMessage || !currentStatusMessage) {
      await eventService.deleteEventStatusMessage(event.id, user.id);
    }

    return null;
  }
}

async function replaceEventStatusMessagesForGroup(ctx, event) {
  const members = await groupService.listGroupMembers(event.group_id);
  const statusMessages = await eventService.listEventStatusMessages(event.id);
  const responses = await eventService.listEventResponses(event.id);
  const statusMessageByUserId = new Map(
    statusMessages.map((statusMessage) => [statusMessage.user_id, statusMessage])
  );

  for (const memberRow of members) {
    await replaceEventStatusMessage(
      ctx,
      event,
      memberRow.users,
      responses,
      statusMessageByUserId.get(memberRow.users?.id)
    );
  }
}

async function getEventStatusMessageForUser(eventId, userId) {
  const statusMessages = await eventService.listEventStatusMessages(eventId);
  return statusMessages.find((statusMessage) => statusMessage.user_id === userId) || null;
}

function getLegacyCreatorMessage(event, user) {
  if (
    user.id !== event.creator_id ||
    !event.creator_status_chat_id ||
    !event.creator_status_message_id
  ) {
    return null;
  }

  return {
    chat_id: event.creator_status_chat_id,
    message_id: event.creator_status_message_id
  };
}

async function deleteTelegramMessage(ctx, eventId, chatId, messageId) {
  try {
    await ctx.telegram.deleteMessage(chatId, messageId);
    return true;
  } catch (error) {
    console.error(`Failed to delete old event status for event ${eventId}:`, error.message);
    return false;
  }
}

async function editTelegramMessage(ctx, event, responses, chatId, messageId, user) {
  try {
    const isCreator = user?.id === event.creator_id;
    await ctx.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      formatEventStatus(event, responses),
      eventActionsKeyboard(event.id, isCreator)
    );
    return { chat_id: chatId, message_id: messageId };
  } catch (error) {
    console.error(`Failed to edit old event status for event ${event.id}:`, error.message);
    return null;
  }
}

module.exports = {
  replaceEventStatusMessage,
  replaceEventStatusMessagesForGroup,
  sendEventStatusMessage
};
