import { supabase } from "../../lib/supabaseClient";

export default async function handler(req, res) {
  // Permite requisições da sua extensão
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

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email, plan, stripe_customer_id")
      .eq("id", userId)
      .single();

    if (error) {
      throw error;
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("Erro ao buscar status do usuário:", error.message);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
}
