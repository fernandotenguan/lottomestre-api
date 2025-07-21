import Stripe from "stripe";
import { supabase } from "../../lib/supabaseClient";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const resend = new Resend(process.env.RESEND_API_KEY);

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
      const userId = session.client_reference_id;
      const stripeCustomerId = session.customer;

      if (!userId) {
        console.error(
          "❌ Erro: client_reference_id (User ID) não encontrado na sessão."
        );
        return res
          .status(200)
          .json({ received: true, error: "Missing User ID" });
      }

      console.log(`🎉 Pagamento bem-sucedido para o usuário com ID: ${userId}`);

      const { data, error } = await supabase
        .from("users")
        .update({ plan: "premium", stripe_customer_id: stripeCustomerId })
        .eq("id", userId)
        .select()
        .single(); // Use .single() para obter um único objeto, não um array

      if (error) {
        console.error(
          "❌ Erro ao atualizar usuário no Supabase:",
          error.message
        );
      } else {
        // --- CORREÇÃO DO LOG E LÓGICA DE E-MAIL ADICIONADA ---
        const updatedUser = data;
        console.log(
          `✅ Usuário ${updatedUser.email} atualizado para PREMIUM no banco de dados.`
        );
        console.log("Dados atualizados:", updatedUser);

        try {
          const userName = updatedUser.name || "Usuário";

          await resend.emails.send({
            from: "LottoMestre <contato@seudominio.com>", // MUDE PARA SEU DOMÍNIO VERIFICADO
            to: [updatedUser.email],
            subject: "Bem-vindo ao LottoMestre Premium! 🎉",
            html: `
              <h1>Olá, ${userName}!</h1>
              <p>Sua assinatura do plano <strong>LottoMestre Premium</strong> foi confirmada. Obrigado!</p>
              <p>Para gerenciar sua assinatura, acesse nosso portal seguro:</p>
              <a href="https://billing.stripe.com/p/login/aFacN4gUp7OP4Bw4YWfjG00"><strong>Acessar Portal do Cliente</strong></a>
              <br><br>
              <p>Boas apostas!</p>
            `,
          });
          console.log(
            `✅ E-mail de boas-vindas enviado para ${updatedUser.email}`
          );
        } catch (emailError) {
          console.error("❌ Erro ao enviar e-mail de boas-vindas:", emailError);
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;

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

      const { data: userById } = await supabase
        .from("users")
        .select("id, email, name")
        .eq("stripe_customer_id", stripeCustomerId)
        .single();

      if (userById) {
        user = userById;
      } else {
        console.warn(
          `⚠️ Não encontrou usuário pelo stripe_customer_id. Tentando buscar pelo e-mail...`
        );
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
            error = errorByEmail;
          }
        }
      }

      if (user) {
        const { error: updateError } = await supabase
          .from("users")
          .update({ plan: "free" })
          .eq("id", user.id);

        if (updateError) {
          console.error(
            "❌ Erro ao reverter usuário para FREE:",
            updateError.message
          );
        } else {
          console.log(
            `✅ Usuário ${user.email} (ID: ${user.id}) revertido para FREE com sucesso.`
          );

          try {
            await resend.emails.send({
              from: "LottoMestre <contato@seudominio.com>", // MUDE PARA SEU DOMÍNIO VERIFICADO
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
          `❌ ERRO CRÍTICO: Não foi possível encontrar o usuário no Supabase. Cliente Stripe: '${stripeCustomerId}'. Erro:`,
          error ? error.message : "Nenhum e-mail encontrado no cliente Stripe."
        );
      }

      break;
    }

    default:
      console.log(`Evento não tratado do tipo ${event.type}`);
  }

  res.status(200).json({ received: true });
}
