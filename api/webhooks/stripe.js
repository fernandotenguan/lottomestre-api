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

      // --- MELHORIA 1: Validação de Status ---
      // Garante que só vamos agir se a assinatura estiver de fato cancelada ou terminada.
      if (
        subscription.status !== "canceled" &&
        subscription.status !== "ended" &&
        !subscription.cancel_at_period_end
      ) {
        console.log(
          `Webhook 'subscription.deleted' recebido, mas o status é '${subscription.status}'. Nenhuma ação necessária.`
        );
        return res
          .status(200)
          .json({ received: true, message: "Status did not require action." });
      }

      const stripeCustomerId = subscription.customer;

      console.log(
        `😢 Assinatura cancelada para o cliente: ${stripeCustomerId}. Iniciando processo de downgrade.`
      );

      let user = null;
      let error = null;

      // --- MELHORIA 2: Lógica de Busca em Duas Etapas ---
      // ETAPA 1: Tenta encontrar pelo ID do cliente (método preferencial)
      const { data: userById, error: errorById } = await supabase
        .from("users")
        .select("id, email, name")
        .eq("stripe_customer_id", stripeCustomerId)
        .single(); // .single() espera encontrar 1 ou 0 resultados.

      if (userById) {
        user = userById;
      } else {
        // ETAPA 2: Se não encontrou pelo ID, tenta pelo e-mail (plano B)
        console.warn(
          `⚠️ Não encontrou usuário pelo stripe_customer_id. Tentando buscar pelo e-mail...`
        );

        // Para buscar por e-mail, primeiro precisamos pegar o e-mail do cliente no Stripe
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        const customerEmail = customer.email;

        if (customerEmail) {
          const { data: userByEmail, error: errorByEmail } = await supabase
            .from("users")
            .select("id, email, name")
            .eq("email", customerEmail)
            .single();

          if (userByEmail) {
            user = userByEmail;
          } else {
            error = errorByEmail; // Guarda o erro da última tentativa
          }
        }
      }

      // Se encontramos o usuário por qualquer um dos métodos, atualiza o plano
      if (user) {
        const { error: updateError } = await supabase
          .from("users")
          .update({ plan: "free" })
          .eq("id", user.id); // Atualiza usando o ID único do usuário

        if (updateError) {
          console.error(
            "❌ Erro ao reverter usuário para FREE:",
            updateError.message
          );
        } else {
          console.log(
            `✅ Usuário ${user.email} (ID: ${user.id}) revertido para FREE com sucesso.`
          );

          // --- Lógica de envio de e-mail de cancelamento (Ato 3) ---
          try {
            await resend.emails.send({
              from: "LottoMestre <contato@seudominio.com>", // MUDE PARA SEU DOMÍNIO
              to: [user.email],
              subject: "Sua assinatura LottoMestre foi cancelada",
              html: `
                <h1>Olá, ${user.name || "usuário"}.</h1>
                <p>Confirmamos que sua assinatura do plano <strong>LottoMestre Premium</strong> foi cancelada.</p>
                <p>Seu acesso aos recursos premium permanecerá ativo até o final do seu ciclo de faturamento atual.</p>
                <p>Agradecemos por ter feito parte da nossa comunidade e esperamos te ver novamente em breve!</p>
              `,
            });
            console.log(`✅ E-mail de cancelamento enviado para ${user.email}`);
          } catch (emailError) {
            console.error(
              "❌ Erro ao enviar e-mail de cancelamento:",
              emailError
            );
          }
        }
      } else {
        console.error(
          `❌ ERRO CRÍTICO: Não foi possível encontrar o usuário no Supabase nem pelo ID do cliente '${stripeCustomerId}' nem pelo e-mail associado. Erro:`,
          error ? error.message : "Nenhum e-mail encontrado no cliente Stripe."
        );
      }

      break;
    }

    default:
      console.log(`Evento não tratado do tipo ${event.type}`);
  }

  // Responde 200 ao Stripe para confirmar o recebimento
  res.status(200).json({ received: true });
}
