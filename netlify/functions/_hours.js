// Ordering hours (Sofia time). Orders are accepted from OPEN_HOUR:00 up to,
// but not including, CLOSE_HOUR:00. The server enforces this; the storefront
// only mirrors it so customers see the notice before they fill in a form.
const OPEN_HOUR = 10;
const CLOSE_HOUR = 22;
const TZ = 'Europe/Sofia';

function minutesInSofia(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  const h = parseInt(parts.find(p => p.type === 'hour').value, 10) % 24;
  const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
  return h * 60 + m;
}

function isOpen(date = new Date()) {
  const t = minutesInSofia(date);
  return t >= OPEN_HOUR * 60 && t < CLOSE_HOUR * 60;
}

const CLOSED_MESSAGE = `В момента сме затворени. Приемаме поръчки всеки ден от ${OPEN_HOUR}:00 до ${CLOSE_HOUR}:00 ч.`;

module.exports = { isOpen, OPEN_HOUR, CLOSE_HOUR, CLOSED_MESSAGE };
