// Public: serves a product photo uploaded from the admin panel.
const { getImage } = require('./_catalog-store.js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const key = event.queryStringParameters && event.queryStringParameters.k;
  try {
    const data = await getImage(key);
    if (!data) return { statusCode: 404, body: 'Not found' };
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
      body: Buffer.from(data).toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    console.error('product-image error:', err.message);
    return { statusCode: 500, body: 'Error' };
  }
};
