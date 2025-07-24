import { Resend } from "resend";
import fs from "fs";
import path from "path";

const resend = new Resend(process.env.RESEND_API_KEY);

// Função para enviar o e-mail de boas-vindas (COM MELHOR LOG DE ERRO)
export async function sendWelcomePremiumEmail(userName, userEmail) {
  try {
    const htmlTemplate = fs.readFileSync(
      path.resolve(process.cwd(), "templates/welcome_premium.html"),
      "utf8"
    );
    const personalizedHtml = htmlTemplate.replace(
      /\[Nome do Usuário\]/g,
      userName
    ); // Usamos /g para substituir todas as ocorrências

    // Captura a resposta da Resend
    const { data, error } = await resend.emails.send({
      from: "LottoMestre <contato@lottomestre.com.br>",
      to: userEmail,
      subject: `✨ Bem-vindo ao LottoMestre Premium, ${userName}!`,
      html: personalizedHtml,
    });

    // Se a Resend retornar um erro no corpo da resposta, ele será capturado aqui
    if (error) {
      console.error(
        "❌ Erro retornado pela API da Resend (Boas-vindas):",
        JSON.stringify(error, null, 2)
      );
      return; // Interrompe a execução
    }

    console.log(
      `✅ E-mail de boas-vindas enviado para ${userEmail}. ID da Resend: ${data.id}`
    );
  } catch (error) {
    // Este catch lida com erros de rede ou falhas na requisição
    console.error(
      "❌ Erro GERAL ao tentar enviar e-mail de boas-vindas:",
      error
    );
  }
}

// Função para enviar o e-mail de cancelamento (COM MELHOR LOG DE ERRO)
export async function sendCancellationEmail(userName, userEmail, endDate) {
  try {
    const htmlTemplate = fs.readFileSync(
      path.resolve(process.cwd(), "templates/cancellation_premium.html"),
      "utf8"
    );
    let personalizedHtml = htmlTemplate.replace(
      /\[Nome do Usuário\]/g,
      userName
    );

    // Formata a data de forma segura
    const formattedDate = endDate
      ? new Date(endDate * 1000).toLocaleDateString("pt-BR")
      : "data não disponível";
    personalizedHtml = personalizedHtml.replace(
      "[Data de Fim do Ciclo]",
      formattedDate
    );

    const { data, error } = await resend.emails.send({
      from: "LottoMestre <contato@lottomestre.com.br>",
      to: userEmail,
      subject: "Sua assinatura LottoMestre Premium foi cancelada",
      html: personalizedHtml,
    });

    if (error) {
      console.error(
        "❌ Erro retornado pela API da Resend (Cancelamento):",
        JSON.stringify(error, null, 2)
      );
      return;
    }

    console.log(
      `✅ E-mail de cancelamento enviado para ${userEmail}. ID da Resend: ${data.id}`
    );
  } catch (error) {
    console.error(
      "❌ Erro GERAL ao tentar enviar e-mail de cancelamento:",
      error
    );
  }
}
