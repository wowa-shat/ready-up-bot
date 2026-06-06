const { Markup } = require('telegraf');

const menuLabels = {
  createGroup: 'Create group',
  listGroups: 'My groups',
  createEvent: 'Create event',
  upcomingEvents: 'Upcoming events'
};

function mainMenuKeyboard() {
  return Markup.keyboard([
    [menuLabels.createGroup, menuLabels.listGroups],
    [menuLabels.createEvent],
    [menuLabels.upcomingEvents]
  ]).resize();
}

function groupSelectionKeyboard(groups, action) {
  return Markup.inlineKeyboard(
    groups.map((group) => [
      Markup.button.callback(group.name, `${action}:${group.id}`)
    ])
  );
}

function groupActionsKeyboard(groupId, shareUrl) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📅 Create event', `event:group:${groupId}`)
    ],
    [
      Markup.button.url('📨 Share Invite Link', shareUrl)
    ],
    [
      Markup.button.callback('🗑 Delete group', `group:delete:${groupId}`)
    ]
  ]);
}

function confirmDeleteGroupKeyboard(groupId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🗑 Yes, delete', `group:delete_confirm:${groupId}`),
      Markup.button.callback('Cancel', `group:view:${groupId}`)
    ]
  ]);
}

module.exports = {
  confirmDeleteGroupKeyboard,
  groupActionsKeyboard,
  groupSelectionKeyboard,
  mainMenuKeyboard,
  menuLabels
};
