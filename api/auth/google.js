// Importa nosso novo "ajudante" de conexão
import { supabase } from "../../lib/supabaseClient";

export default async function handler(req, res) {
  // --- Bloco CORS e verificação de método (continua o mesmo) ---
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

  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    // --- Validação do Token com Google (continua a mesma) ---
    const googleResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!googleResponse.ok) {
      throw new Error("Failed to fetch user info from Google");
    }

    const googleUser = await googleResponse.json();

    // =============================================================
    //          NOVA LÓGICA COM LISTA VIP + SUPABASE
    // =============================================================

    // Defina sua lista de emails que SEMPRE serão premium
    const vipEmails = [
      "fernando.tenguan@gmail.com",
      "lottomestre@gmail.com",
      "lucastgs92@gmail.com",
      "matheus.cherurtti25@gmail.com",
    ];

    // 1. VERIFICAÇÃO VIP PRIMEIRO!
    if (vipEmails.includes(googleUser.email)) {
      console.log(
        `👑 Usuário VIP detectado: ${googleUser.email}. Concedendo acesso premium.`
      );

      // Retornamos imediatamente o status premium, sem tocar no banco de dados.
      // Podemos retornar um ID falso ou o 'sub' do Google, já que este usuário não
      // passará pelo fluxo normal.
      return res.status(200).json({
        user: {
          id: "vip_user",
          email: googleUser.email,
          name: googleUser.name,
          plan: "premium",
        },
      });
    }

    // 2. Se não for VIP, executa a lógica normal do Supabase
    console.log(
      `👤 Usuário normal detectado: ${googleUser.email}. Verificando no banco de dados.`
    );

    let { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", googleUser.email)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!user) {
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({
          email: googleUser.email,
          name: googleUser.name,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      user = newUser;
      console.log(`✅ Novo usuário criado: ${user.email}`);
    } else {
      console.log(
        `👤 Usuário existente encontrado: ${user.email}, Plano: ${user.plan}`
      );
    }

    // =============================================================

    // Retorna os dados do banco para usuários normais
    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
      },
    });
  } catch (error) {
    console.error("Authentication error:", error.message);
    return res
      .status(500)
      .json({ error: "Internal server error during authentication." });
  }
}
