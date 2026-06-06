const { formatDateTime } = require('./time');

function formatEventInvite(event, group) {
  return [
    `Ready up for ${group.name}`,
    '',
    event.title,
    event.description || '',
    '',
    `Starts: ${formatDateTime(event.starts_at)}`,
    `Required players: ${event.required_players}`,
    `Status: ${event.status}`
  ].filter(Boolean).join('\n');
}

function formatCreatorStatus(event, responses) {
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

  return [
    `Event status: ${event.title}`,
    `Starts: ${formatDateTime(event.starts_at)}`,
    `Required players: ${event.required_players}`,
    `Status: ${event.status}`,
    '',
    `Going (${grouped.going.length}): ${listNames(grouped.going)}`,
    `Maybe (${grouped.maybe.length}): ${listNames(grouped.maybe)}`,
    `No (${grouped.no.length}): ${listNames(grouped.no)}`
  ].join('\n');
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
  formatCreatorStatus,
  formatEventInvite
};
