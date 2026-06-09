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

function isMainMenuLabel(text) {
  return Object.values(menuLabels).includes(text);
}

function isNavigationText(text) {
  return isMainMenuLabel(text) || text.startsWith('/');
}

function groupSelectionKeyboard(groups, action, backAction = 'nav:menu') {
  return Markup.inlineKeyboard([
    ...groups.map((group) => [
      Markup.button.callback(group.name, `${action}:${group.id}`)
    ]),
    [Markup.button.callback('⬅ Back', backAction)]
  ]);
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
    ],
    [
      Markup.button.callback('⬅ Back to groups', 'nav:groups')
    ]
  ]);
}

function eventResponseKeyboard(eventId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Going', `response:${eventId}:going`),
      Markup.button.callback('Maybe', `response:${eventId}:maybe`),
      Markup.button.callback('No', `response:${eventId}:no`)
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

function skipKeyboard(skipAction) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⏭ Skip', skipAction)]
  ]);
}

module.exports = {
  confirmDeleteGroupKeyboard,
  eventResponseKeyboard,
  groupActionsKeyboard,
  groupSelectionKeyboard,
  isMainMenuLabel,
  isNavigationText,
  mainMenuKeyboard,
  menuLabels,
  skipKeyboard
};
