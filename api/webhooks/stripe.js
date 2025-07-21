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

    // VERSÃO CORRIGIDA E MAIS ROBUSTA
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const stripeCustomerId = subscription.customer;

      console.log(
        `Received 'customer.subscription.deleted' event for customer: ${stripeCustomerId}`
      );

      if (!stripeCustomerId) {
        console.error(
          "❌ Erro: stripeCustomerId não encontrado no evento de cancelamento."
        );
        return res
          .status(200)
          .json({ received: true, error: "Missing Customer ID" });
      }

      console.log(
        `Attempting to revert user with Stripe Customer ID: ${stripeCustomerId} to 'free' plan.`
      );

      const { data, error } = await supabase
        .from("users")
        .update({
          plan: "free",
          // Opcional, mas recomendado: Limpar o ID do cliente para evitar inconsistências
          // Se o usuário assinar de novo, ele receberá um novo ID de qualquer forma.
          // stripe_customer_id: null
        })
        .eq("stripe_customer_id", stripeCustomerId)
        .select();

      if (error) {
        console.error(
          "❌ Supabase error while reverting user to FREE:",
          error.message
        );
        // Mesmo com erro, respondemos 200 ao Stripe para evitar reenvios.
        // O erro fica no log para análise.
      } else {
        if (data && data.length > 0) {
          console.log(
            `✅ User with Stripe ID ${stripeCustomerId} successfully reverted to FREE.`
          );
          console.log("Updated user data:", data);
        } else {
          // ESTE É O LOG MAIS IMPORTANTE PARA DIAGNÓSTICO
          console.warn(
            `⚠️ No user found in Supabase with stripe_customer_id: ${stripeCustomerId}. No update was performed.`
          );
        }
      }
      break;
    }

    default:
      console.log(`Evento não tratado do tipo ${event.type}`);
  }

  // Responde 200 ao Stripe para confirmar o recebimento
  res.status(200).json({ received: true });
}
