// api/hello.js
export default function handler(req, res) {
  res.status(200).json({ message: 'Olá, mundo! A API do LottoMestre está no ar!' });
}