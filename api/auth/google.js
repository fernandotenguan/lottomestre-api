// Importa a biblioteca do Google para verificar o token
import { OAuth2Client } from "google-auth-library";

// Cria uma instância do cliente OAuth2
const client = new OAuth2Client();

// A função principal que a Vercel vai executar
export default async function handler(req, res) {
  // --- Bloco de Segurança e Configuração CORS ---

  // 1. Permitir apenas o método POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 2. Definir o ID da extensão a partir das variáveis de ambiente
  const allowedOrigin = `chrome-extension://${process.env.CHROME_EXTENSION_ID}`;

  // 3. Verificar se a requisição veio da nossa extensão
  if (req.headers.origin !== allowedOrigin) {
    return res.status(403).json({ error: "Forbidden: Origin not allowed" });
  }

  // 4. Configurar cabeçalhos CORS para a resposta
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 5. Responder a requisições OPTIONS (pre-flight)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --- Bloco de Autenticação e Lógica de Plano ---
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    // Verifica o token com o Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID, // O client ID do seu projeto Google Cloud
    });
    const payload = ticket.getPayload();

    // --- LÓGICA DA "LISTA VIP" (TEMPORÁRIA PARA TESTES) ---
    let userPlan = "free"; // Por padrão, todos são 'free'

    // Crie sua lista de e-mails premium aqui!
    const premiumTestUserEmails = [
      "fernandotenguan@gmail.com",
      "lottomestre@gmail.com",
    ];

    // Verifica se o email do usuário logado ESTÁ NA LISTA
    if (premiumTestUserEmails.includes(payload.email)) {
      userPlan = "premium"; // Se estiver, o plano dele é premium!
    }

    // Monta o objeto de usuário com o plano dinâmico
    const user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      plan: userPlan,
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
