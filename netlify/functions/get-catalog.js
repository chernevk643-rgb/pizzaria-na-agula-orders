// Public: the overrides the storefront applies on top of the static menu.
const { getOverridesSafe } = require('./_catalog-store.js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const overrides = await getOverridesSafe();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=15' },
    body: JSON.stringify({ overrides })
  };
};
