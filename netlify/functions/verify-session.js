// Confirms a Stripe Checkout Session actually completed payment before we
// show a "thank you" screen or treat the order as paid. Never trust the
// success_url redirect alone — it can be reached without a real payment.
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sessionId = event.queryStringParameters && event.queryStringParameters.session_id;
  if (!sessionId || !/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Невалидна сесия.' }) };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return { statusCode: 200, body: JSON.stringify({ paid: false }) };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        paid: true,
        amount_total: session.amount_total,
        currency: session.currency,
        customer_email: session.customer_email
      })
    };
  } catch (err) {
    console.error('Verify session error:', err.message);
    return { statusCode: 502, body: JSON.stringify({ error: 'Не можахме да потвърдим плащането.' }) };
  }
};
