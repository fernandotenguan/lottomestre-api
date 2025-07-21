import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // --- Bloco de Segurança e Configuração CORS (CORRIGIDO) ---
  const allowedOrigin = `chrome-extension://${process.env.CHROME_EXTENSION_ID}`;

  // Adiciona os cabeçalhos de permissão em TODAS as respostas
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Responde imediatamente a requisições pre-flight (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  // --- Fim do Bloco de Correção ---

  // Agora, verificamos se o método é POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // A lógica principal continua a mesma
  try {
    const priceId = "price_1Rn7lFCro1dORyGqPrqUinFx"; // MANTENHA O SEU ID DO PREÇO AQUI

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `https://lottomestre.com.br/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://lottomestre.com.br/cancelou`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe Error:", err.message);
    res.status(500).json({ error: { message: err.message } });
  }
}
