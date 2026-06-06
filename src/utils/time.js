function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

module.exports = {
  formatDateTime,
  minutesFromNow
};
