const { formatDateTime } = require('./time');

function formatEventStatus(event, responses = [], groupName = null) {
  const grouped = groupResponses(responses);

  return [
    `Group Name: ${groupName || event.groups?.name || 'Unknown group'}`,
    '',
    `Event Name: ${event.title}`,
    `Event Description: ${event.description || '-'}`,
    '',
    `Starts: ${formatDateTime(event.starts_at)}`,
    `Required players: ${event.required_players}`,
    '',
    '',
    `Going (${grouped.going.length}): ${listNames(grouped.going)}`,
    `Maybe (${grouped.maybe.length}): ${listNames(grouped.maybe)}`,
    `No (${grouped.no.length}): ${listNames(grouped.no)}`
  ].join('\n');
}

function formatEventStarted(event, groupName = null) {
  return [
    `⏰ Event started`,
    '',
    `Group Name: ${groupName || event.groups?.name || 'Unknown group'}`,
    '',
    `Event Name: ${event.title}`,
    `Event Description: ${event.description || '-'}`,
    '',
    `Starts: ${formatDateTime(event.starts_at)}`,
    `Required players: ${event.required_players}`
  ].join('\n');
}

function groupResponses(responses) {
  const grouped = {
    going: [],
    maybe: [],
    no: []
  };

  for (const response of responses) {
    const user = response.users || {};
    const label = userLabel(user);
    grouped[response.status].push(label);
  }

  return grouped;
}

function userLabel(user) {
  if (user.username) {
    return `@${user.username}`;
  }

  return [user.first_name, user.last_name].filter(Boolean).join(' ') || String(user.telegram_id);
}

function listNames(names) {
  return names.length > 0 ? names.join(', ') : '-';
}

module.exports = {
  formatEventStarted,
  formatEventStatus
};
