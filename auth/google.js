// api/auth/google.js - VERSÃO DE TESTE À PROVA DE BALAS

export default function handler(req, res) {
  // A primeira coisa que fazemos é enviar os cabeçalhos.
  // Usamos '*' para eliminar qualquer chance de erro com a variável de ambiente.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Respondemos que está tudo OK e encerramos.
  // Não há nenhuma lógica, try/catch, ou variável que possa quebrar.
  res
    .status(200)
    .json({ message: "A resposta do servidor com CORS está funcionando!" });
}
