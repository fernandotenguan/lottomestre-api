import Stripe from "stripe";
import { buffer } from "micro";
import { supabase } from "../../lib/supabaseClient"; // Certifique-se que o caminho está correto
import {
  sendWelcomePremiumEmail,
  sendCancellationEmail,
} from "../../lib/email"; // Importa as funções de e-mail

// --- Inicialização ---
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Desativa o bodyParser padrão do Next.js para que possamos receber o corpo bruto (raw)
export const config = {
  api: {
    bodyParser: false,
  },
};

// --- Handler Principal do Webhook ---
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error(
      `❌ Erro na verificação da assinatura do webhook: ${err.message}`
    );
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`✅ Evento recebido: ${event.type}`);

  // --- Lógica para cada tipo de evento ---
  switch (event.type) {
    // Evento: Assinatura bem-sucedida
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const stripeCustomerId = session.customer;

      if (!userId) {
        console.error(
          "❌ Erro: client_reference_id (User ID) não encontrado na sessão do Stripe."
        );
        return res
          .status(200)
          .json({ received: true, error: "Missing User ID" });
      }

      console.log(`🎉 Pagamento bem-sucedido para o usuário com ID: ${userId}`);

      const { data: updatedUser, error } = await supabase
        .from("users")
        .update({ plan: "premium", stripe_customer_id: stripeCustomerId })
        .eq("id", userId)
        .select()
        .single();

      if (error) {
        console.error(
          "❌ Erro ao atualizar usuário para PREMIUM no Supabase:",
          error.message
        );
      } else {
        console.log(`✅ Usuário ${updatedUser.email} atualizado para PREMIUM.`);
        // Chamada da função de e-mail modularizada
        await sendWelcomePremiumEmail(updatedUser.name, updatedUser.email);
      }
      break;
    }

    // Evento: Assinatura cancelada (pelo usuário ou por falha de pagamento)
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const stripeCustomerId = subscription.customer;

      console.log(
        `😢 Assinatura cancelada para o cliente Stripe: ${stripeCustomerId}. Iniciando downgrade.`
      );

      const { data: user, error } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("stripe_customer_id", stripeCustomerId)
        .single();

      if (error || !user) {
        console.error(
          `❌ ERRO CRÍTICO: Não foi possível encontrar o usuário no Supabase com stripe_customer_id: ${stripeCustomerId}. Erro: ${error?.message}`
        );
      } else {
        const { error: updateError } = await supabase
          .from("users")
          .update({ plan: "free" })
          .eq("id", user.id);

        if (updateError) {
          console.error(
            `❌ Erro ao reverter usuário ${user.email} para FREE:`,
            updateError.message
          );
        } else {
          console.log(
            `✅ Usuário ${user.email} revertido para FREE com sucesso.`
          );
          // Chamada da função de e-mail modularizada
          await sendCancellationEmail(
            user.name,
            user.email,
            subscription.ended_at || subscription.canceled_at
          );
        }
      }
      break;
    }

    // Você pode adicionar mais 'case' aqui para outros eventos no futuro,
    // como 'invoice.payment_failed' para notificar usuários sobre falhas de pagamento.

    default:
      console.log(
        `Evento não tratado do tipo ${event.type}. Payload:`,
        event.data.object
      );
  }

  // Responde ao Stripe com sucesso para confirmar o recebimento
  res.status(200).json({ received: true });
}
