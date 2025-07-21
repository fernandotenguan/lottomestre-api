import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // --- Bloco CORS e verificação de método (já está correto) ---
  const allowedOrigin = `chrome-extension://${process.env.CHROME_EXTENSION_ID}`;
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // --- Lógica Principal ---
  try {
    // Lembre-se de usar o ID do Preço do seu ambiente de PRODUÇÃO
    const priceId = "price_1Rn1KKCok65o5YjzluxHbJk5";

    // Pega o email do usuário enviado pelo frontend
    const { userEmail, userId } = req.body;

    if (!userId) {
      return res
        .status(400)
        .json({ error: { message: "User ID is missing." } });
    }

    const session = await stripe.checkout.sessions.create({
      client_reference_id: userId, // <-- ADICIONADO: Passa o ID do Supabase para o Stripe
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      // Pré-preenche o email do cliente na página de checkout
      customer_email: userEmail,

      // =============================================================
      //          COLE SEU LINK DO PORTAL DO CLIENTE AQUI
      // =============================================================
      // URL de Sucesso: Redireciona para o portal seguro do Stripe
      success_url: "https://billing.stripe.com/p/login/aFacN4gUp7OP4Bw4YWfjG00",

      // URL de Cancelamento: Podemos usar a mesma URL. O cliente
      // simplesmente não estará logado se cancelar.
      cancel_url: "https://billing.stripe.com/p/login/aFacN4gUp7OP4Bw4YWfjG00",
      // =============================================================
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe Error:", err.message);
    res.status(500).json({ error: { message: err.message } });
  }
}
