import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client();

export default async function handler(req, res) {
  // --- Bloco de Segurança e Configuração CORS ---

  // Define a origem permitida a partir das variáveis de ambiente
  const allowedOrigin = `chrome-extension://${process.env.CHROME_EXTENSION_ID}`;

  // SEMPRE adiciona os cabeçalhos de permissão em TODAS as respostas para este endpoint
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // **PASSO 1: CUIDAR DA LIGAÇÃO DO PORTEIRO (PREFLIGHT)**
  // Se a requisição for do tipo OPTIONS, apenas retornamos sucesso.
  // Os cabeçalhos acima já foram adicionados, então a permissão é concedida.
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // **PASSO 2: PROCESSAR O PEDIDO DE PIZZA (POST)**
  // Se o código chegou até aqui, não era OPTIONS. Agora verificamos se é POST.
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Se o método for POST, a lógica principal continua...
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    let userPlan = "free";
    const premiumTestUserEmails = [
      "lottomestre@gmail.com",
      "fernandotenguan@gmail.com",
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
    console.error("Authentication error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error during authentication." });
  }
}
