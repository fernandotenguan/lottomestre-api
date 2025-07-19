// api/auth/google.js
export default async function handler(req, res) {
  // --- SUBSTITUA O BLOCO CORS POR ESTE ---
  // Permite requisições de QUALQUER origem.
  // Ótimo para testar, mas deve ser trocado de volta depois.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Lida com a requisição preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  // --- FIM DO NOVO BLOCO ---
  // Só aceita requisições do tipo POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token não fornecido" });
  }

  try {
    // 1. Usa o token recebido da extensão para pegar os dados do usuário do Google
    const googleResponse = await fetch(
      `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${token}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    if (!googleResponse.ok) {
      throw new Error("Token do Google inválido ou expirado.");
    }

    const googleUser = await googleResponse.json();
    const { email, name, picture } = googleUser;

    // 2. LÓGICA DO SEU NEGÓCIO (aqui a mágica acontece)
    //    Por enquanto, vamos simular um banco de dados.
    //    No futuro, você vai conectar um banco de dados real aqui (ex: MongoDB, Supabase).

    // Simulação: Verifique se o usuário já existe no nosso "banco de dados"
    // E qual é o plano dele. Por enquanto, todos são 'free'.
    const userFromDB = {
      email: email,
      name: name,
      picture: picture,
      plan: "free", // Todo novo usuário começa como 'free'
      token: token, // Salva o token para o logout
    };

    // 3. Retorna os dados do usuário para a extensão
    res.status(200).json({ user: userFromDB });
  } catch (error) {
    console.error("Erro na autenticação do backend:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
}
