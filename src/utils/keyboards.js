const { Markup } = require('telegraf');

const menuLabels = {
  createGroup: 'Create group',
  listGroups: 'My groups',
  addMember: 'Add member',
  createEvent: 'Create event',
  myId: 'My Telegram ID'
};

function mainMenuKeyboard() {
  return Markup.keyboard([
    [menuLabels.createGroup, menuLabels.listGroups],
    [menuLabels.addMember, menuLabels.createEvent],
    [menuLabels.myId]
  ]).resize();
}

function groupSelectionKeyboard(groups, action) {
  return Markup.inlineKeyboard(
    groups.map((group) => [
      Markup.button.callback(group.name, `${action}:${group.id}`)
    ])
  );
}

function groupActionsKeyboard(groupId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Add member', `group:add:${groupId}`),
      Markup.button.callback('Create event', `event:group:${groupId}`)
    ]
  ]);
}

function contactRequestKeyboard() {
  return Markup.keyboard([
    [Markup.button.contactRequest('Share my contact')],
    [menuLabels.myId],
    [menuLabels.listGroups, menuLabels.createEvent]
  ]).resize();
}

module.exports = {
  contactRequestKeyboard,
  groupActionsKeyboard,
  groupSelectionKeyboard,
  mainMenuKeyboard,
  menuLabels
};
