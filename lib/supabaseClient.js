import { createClient } from "@supabase/supabase-js";

// Pega as credenciais das variáveis de ambiente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cria e exporta uma única instância do cliente Supabase para ser usada em toda a API
export const supabase = createClient(supabaseUrl, supabaseKey);
