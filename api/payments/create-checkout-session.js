// Importa a biblioteca do Stripe que instalamos
import Stripe from "stripe";

// Inicializa o Stripe com a nossa chave secreta, que está segura nas variáveis de ambiente
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// A função principal do nosso endpoint
export default async function handler(req, res) {
  // Permitimos apenas requisições POST para este endpoint
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    // =======================================================================
    // PASSO IMPORTANTE: Obtenha o ID do Preço no seu painel do Stripe
    // Vá em Produtos > LottoMestre Premium > role para baixo até a seção Preços.
    // Clique nos três pontos (...) ao lado do preço e selecione "Copiar ID".
    // O ID se parece com 'price_xxxxxxxxxxxxxx'.
    // =======================================================================
    const priceId = "prod_SiSEgGZlDvd6W4"; // <-- SUBSTITUA ESTE VALOR

    // Cria a Sessão de Checkout no Stripe
    const session = await stripe.checkout.sessions.create({
      // Itens que o usuário está comprando. No nosso caso, é a assinatura.
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Modo "subscription" é a chave para pagamentos recorrentes
      mode: "subscription",
      // URLs para onde o usuário será redirecionado após a ação
      success_url: `https://lottomestre.com.br/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://lottomestre.com.br/cancelou`,
    });

    // Envia a URL da sessão de pagamento de volta para a extensão
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe Error:", err.message);
    res.status(500).json({ error: { message: err.message } });
  }
}
