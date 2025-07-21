import Stripe from "stripe";
import { supabase } from "../../lib/supabaseClient"; // Importamos nosso "ajudante" Supabase

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.log(
      `❌ Erro na verificação da assinatura do webhook: ${err.message}`
    );
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("✅ Evento recebido:", event.type);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;

      const userId = session.client_reference_id; // <-- MUITO MAIS SEGURO!
      const stripeCustomerId = session.customer;

      if (!userId) {
        console.error(
          "❌ Erro: client_reference_id (User ID) não encontrado na sessão do Stripe."
        );
        // Responda 200 para o Stripe, mas registre o erro grave.
        return res
          .status(200)
          .json({ received: true, error: "Missing User ID" });
      }

      console.log(`🎉 Pagamento bem-sucedido para o usuário com ID: ${userId}`);

      // =============================================================
      //          LÓGICA REAL COM SUPABASE
      // =============================================================

      // Atualiza o usuário no banco de dados
      const { data, error } = await supabase
        .from("users")
        .update({
          plan: "premium",
          stripe_customer_id: stripeCustomerId,
        })
        .eq("id", userId) // <-- ENCONTRA PELO ID ÚNICO
        .select(); // Retorna os dados atualizados

      if (error) {
        console.error(
          "❌ Erro ao atualizar usuário no Supabase:",
          error.message
        );
        // Mesmo com erro no DB, respondemos 200 ao Stripe para evitar reenvios.
        // O erro fica registrado no log para análise manual.
      } else {
        console.log(
          `✅ Usuário ${userEmail} atualizado para PREMIUM no banco de dados.`
        );
        console.log("Dados atualizados:", data);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const stripeCustomerId = subscription.customer;

      console.log(
        `😢 Assinatura cancelada para o cliente: ${stripeCustomerId}`
      );

      // =============================================================
      //          LÓGICA REAL DE CANCELAMENTO
      // =============================================================
      const { data, error } = await supabase
        .from("users")
        .update({
          plan: "free",
          // Opcional: você pode querer limpar o stripe_customer_id também
          // stripe_customer_id: null
        })
        .eq("stripe_customer_id", stripeCustomerId) // Encontra o usuário pelo ID do Stripe
        .select();

      if (error) {
        console.error("❌ Erro ao reverter usuário para FREE:", error.message);
      } else {
        console.log(
          `✅ Usuário com Stripe ID ${stripeCustomerId} revertido para FREE.`
        );
        console.log("Dados atualizados:", data);
      }
      break;
    }

    default:
      console.log(`Evento não tratado do tipo ${event.type}`);
  }

  // Responde 200 ao Stripe para confirmar o recebimento
  res.status(200).json({ received: true });
}
