import Stripe from "stripe";

// Inicializa o Stripe com nossa chave secreta
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Chave secreta ESPECIAL para o webhook, que vamos pegar no painel do Stripe
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// O Vercel precisa ler o "corpo" da requisição de uma forma bruta (raw),
// então precisamos desabilitar o parser padrão do Next.js/Vercel.
export const config = {
  api: {
    bodyParser: false,
  },
};

// Função para ler o corpo da requ-isição como um Buffer
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// A função principal do nosso endpoint de webhook
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    // 1. VERIFICAÇÃO DE SEGURANÇA
    // O Stripe usa a assinatura e nossa chave secreta para garantir que
    // a notificação é real e não uma fraude.
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.log(
      `❌ Erro na verificação da assinatura do webhook: ${err.message}`
    );
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 2. PROCESSAMENTO DO EVENTO
  // Se a assinatura for válida, verificamos qual evento o Stripe nos enviou.
  console.log("✅ Evento recebido:", event.type);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      console.log("🎉 Pagamento bem-sucedido para a sessão:", session.id);

      // =============================================================
      // AQUI É ONDE A MÁGICA FINAL ACONTECE
      // =============================================================
      //
      // 1. Obter o ID do cliente do Stripe (session.customer) e o email (session.customer_details.email)
      // 2. Conectar ao nosso banco de dados (MongoDB, Firebase, Supabase, etc.)
      // 3. Encontrar o nosso usuário no banco de dados usando o email.
      // 4. Salvar o ID do cliente do Stripe no registro do nosso usuário. Isso é
      //    CRUCIAL para gerenciar o cancelamento no futuro.
      // 5. Atualizar o campo `plan` do nosso usuário para "premium".
      //
      // Por enquanto, vamos apenas simular com um console.log
      console.log(
        `SIMULAÇÃO: Usuário com email ${session.customer_details.email} agora é PREMIUM.`
      );
      console.log(
        `SIMULAÇÃO: Salvar o Stripe Customer ID ${session.customer} para este usuário.`
      );
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      console.log("😢 Assinatura cancelada:", subscription.id);

      // =============================================================
      // LÓGICA DE CANCELAMENTO
      // =============================================================
      //
      // 1. Obter o ID do cliente do Stripe (subscription.customer)
      // 2. Conectar ao nosso banco de dados.
      // 3. Encontrar o nosso usuário que tem este Stripe Customer ID.
      // 4. Atualizar o campo `plan` desse usuário de volta para "free".
      //
      console.log(
        `SIMULAÇÃO: Usuário com Stripe Customer ID ${subscription.customer} agora é FREE.`
      );
      break;
    }

    // ... podemos adicionar outros eventos, como 'customer.subscription.updated'

    default:
      console.log(`Evento não tratado do tipo ${event.type}`);
  }

  // 3. RESPOSTA DE SUCESSO
  // Enviamos uma resposta 200 para o Stripe para dizer "Ok, recebi e processei".
  // Se não fizermos isso, o Stripe continuará tentando nos enviar a notificação.
  res.status(200).json({ received: true });
}
