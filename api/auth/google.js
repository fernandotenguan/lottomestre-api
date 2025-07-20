import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client();

export default async function handler(req, res) {
  // --- Bloco de Segurança e Configuração CORS ---

  // Define a origem permitida a partir das variáveis de ambiente
  // Lembre-se que CHROME_EXTENSION_ID deve estar configurado na Vercel
  const allowedOrigin = `chrome-extension://${process.env.CHROME_EXTENSION_ID}`;

  // Adiciona os cabeçalhos de permissão em TODAS as respostas
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Responde imediatamente a requisições pre-flight (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Permite apenas o método POST para a lógica principal
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // --- Bloco de Autenticação e Lógica de Plano ---
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    // Verifica o token com o Google
    // Lembre-se que GOOGLE_CLIENT_ID deve estar configurado na Vercel
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    // =============================================================
    //               AQUI ESTÁ A SUA LISTA VIP
    // =============================================================
    let userPlan = "free"; // Por padrão, todos são 'free'

    // Edite esta lista com os e-mails que terão acesso premium para teste
    const premiumTestUserEmails = [
      "fernandotenguan@gmail.com",
      "lottomestre@gmail.com",
    ];

    // Verifica se o e-mail do usuário logado ESTÁ DENTRO da lista
    if (premiumTestUserEmails.includes(payload.email)) {
      userPlan = "premium"; // Se estiver na lista, o plano dele é premium!
    }
    // =============================================================

    // Monta o objeto de usuário com o plano dinâmico
    const user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      plan: userPlan, // Usa a variável que definimos acima
    };

    // Envia a resposta de sucesso para a extensão
    return res.status(200).json({ user });
  } catch (error) {
    console.error("Authentication error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error during authentication." });
  }
}
