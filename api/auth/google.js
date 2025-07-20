// Não precisamos mais da biblioteca do Google! O código fica mais limpo.

export default async function handler(req, res) {
  // --- Bloco de Segurança e Configuração CORS ---
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

  // --- Bloco de Autenticação e Lógica de Plano ---
  try {
    const { token } = req.body; // Este é o nosso Access Token
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    // =============================================================
    //          MUDANÇA PRINCIPAL: Usando o Access Token
    // =============================================================
    // Em vez de verificar o token, usamos ele para pedir os dados do usuário.
    const googleResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!googleResponse.ok) {
      throw new Error("Failed to fetch user info from Google");
    }

    const payload = await googleResponse.json(); // O payload agora vem da resposta do fetch
    // =============================================================

    let userPlan = "free";
    const premiumTestUserEmails = [
      "fernando.tenguan@gmail.com",
      "lottomestre@exemplo.com",
      "lucastgs92@gmail.com",
      "matheus.cherurtti25@gmail.com",
    ];

    if (premiumTestUserEmails.includes(payload.email)) {
      userPlan = "premium";
    }

    const user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      plan: userPlan,
    };

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Authentication error:", error.message);
    return res
      .status(500)
      .json({ error: "Internal server error during authentication." });
  }
}
