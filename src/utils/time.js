function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function formatRelativeTime(value, now = new Date()) {
  const target = new Date(value);
  const diffMs = target.getTime() - now.getTime();
  const absSeconds = Math.abs(Math.round(diffMs / 1000));
  const tense = diffMs >= 0 ? 'in' : 'started';

  if (absSeconds < 60) {
    return diffMs >= 0 ? 'in less than a minute' : 'started less than a minute ago';
  }

  const absMinutes = Math.round(absSeconds / 60);

  if (absMinutes < 60) {
    return diffMs >= 0
      ? `${tense} ${absMinutes} ${pluralize(absMinutes, 'minute')}`
      : `${tense} ${absMinutes} ${pluralize(absMinutes, 'minute')} ago`;
  }

  const absHours = Math.round(absMinutes / 60);

  if (absHours < 24) {
    return diffMs >= 0
      ? `${tense} ${absHours} ${pluralize(absHours, 'hour')}`
      : `${tense} ${absHours} ${pluralize(absHours, 'hour')} ago`;
  }

  const absDays = Math.round(absHours / 24);
  return diffMs >= 0
    ? `${tense} ${absDays} ${pluralize(absDays, 'day')}`
    : `${tense} ${absDays} ${pluralize(absDays, 'day')} ago`;
}

function pluralize(value, unit) {
  return value === 1 ? unit : `${unit}s`;
}

module.exports = {
  formatRelativeTime,
  minutesFromNow
};
