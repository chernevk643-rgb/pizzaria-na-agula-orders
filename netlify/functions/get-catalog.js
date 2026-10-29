// Public: the overrides the storefront applies on top of the static menu.
const { getOverridesSafe } = require('./_catalog-store.js');
const { isOpen, OPEN_HOUR, CLOSE_HOUR } = require('./_hours.js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const overrides = await getOverridesSafe();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=15' },
    body: JSON.stringify({ overrides, open: isOpen(), hours: { open: OPEN_HOUR, close: CLOSE_HOUR } })
  };
};
