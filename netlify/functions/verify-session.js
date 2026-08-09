// Confirms a Stripe Checkout Session actually completed payment before we
// show a "thank you" screen or treat the order as paid. Never trust the
// success_url redirect alone — it can be reached without a real payment.
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { saveOrder, getOrder } = require('./_orders-store.js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sessionId = event.queryStringParameters && event.queryStringParameters.session_id;
  if (!sessionId || !/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Невалидна сесия.' }) };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });
    if (session.payment_status !== 'paid') {
      return { statusCode: 200, body: JSON.stringify({ paid: false }) };
    }

    // Idempotent: only persist once per Stripe session, so refreshing the
    // success page never duplicates the order or resets its status.
    try {
      const existing = await getOrder(session.id);
      if (!existing) {
        const items = (session.line_items && session.line_items.data || []).map(li => ({
          name: li.description,
          price: (li.amount_total || 0) / 100 / (li.quantity || 1),
          qty: li.quantity || 1
        }));
        await saveOrder({
          id: session.id,
          createdAt: new Date().toISOString(),
          paymentMethod: 'card',
          status: 'new',
          customer: {
            name: (session.metadata && session.metadata.customer_name) || '',
            phone: (session.metadata && session.metadata.customer_phone) || '',
            email: session.customer_email || '',
            address: (session.metadata && session.metadata.delivery_address) || '',
            notes: (session.metadata && session.metadata.order_notes) || ''
          },
          items,
          total: (session.amount_total || 0) / 100
        });
      }
    } catch (storeErr) {
      // Don't fail the customer's confirmation screen if the dashboard
      // write hiccups — the payment itself already succeeded with Stripe.
      console.error('Order store error (payment still succeeded):', storeErr.message);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        paid: true,
        id: session.id,
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
