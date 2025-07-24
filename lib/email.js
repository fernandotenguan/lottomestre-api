// /lib/email.js

import { Resend } from "resend";
import fs from "fs";
import path from "path";

// Inicializa a Resend com a chave de API do ambiente
const resend = new Resend(process.env.RESEND_API_KEY);

// Função para enviar o e-mail de boas-vindas
export async function sendWelcomePremiumEmail(userName, userEmail) {
  try {
    // Lê o template HTML do arquivo
    const htmlTemplate = fs.readFileSync(
      path.resolve(process.cwd(), "templates/welcome_premium.html"),
      "utf8"
    );

    // Substitui os placeholders pelos dados reais do usuário
    const personalizedHtml = htmlTemplate.replace(
      "[Nome do Usuário]",
      userName
    );

    await resend.emails.send({
      from: "LottoMestre <contato@seudominio.com.br>", // IMPORTANTE: Use um e-mail do seu domínio verificado
      to: userEmail,
      subject: `✨ Bem-vindo ao LottoMestre Premium, ${userName}!`,
      html: personalizedHtml,
    });

    console.log(`E-mail de boas-vindas enviado para ${userEmail}`);
  } catch (error) {
    console.error("Erro ao enviar e-mail de boas-vindas:", error);
  }
}

// Função para enviar o e-mail de cancelamento
export async function sendCancellationEmail(userName, userEmail, endDate) {
  try {
    const htmlTemplate = fs.readFileSync(
      path.resolve(process.cwd(), "templates/cancellation_premium.html"),
      "utf8"
    );

    // Substitui os placeholders
    let personalizedHtml = htmlTemplate.replace("[Nome do Usuário]", userName);
    personalizedHtml = personalizedHtml.replace(
      "[Data de Fim do Ciclo]",
      new Date(endDate * 1000).toLocaleDateString("pt-BR")
    );

    await resend.emails.send({
      from: "LottoMestre <contato@lottomestre.com.br>",
      to: userEmail,
      subject: "Sua assinatura LottoMestre Premium foi cancelada",
      html: personalizedHtml,
    });

    console.log(`E-mail de cancelamento enviado para ${userEmail}`);
  } catch (error) {
    console.error("Erro ao enviar e-mail de cancelamento:", error);
  }
}
