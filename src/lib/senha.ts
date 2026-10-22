// Política de senha do Portal de Pesagem — um só lugar para servidor e telas (copiada do Imobenviomassa).
//
//   · mínimo de 12 caracteres, máximo de 128;
//   · pelo menos três das quatro classes: minúscula, maiúscula, dígito, símbolo;
//   · sem espaço no início/fim e sem sequências óbvias ("123456", "abcdef", "senha", "password");
//   · senhas vazadas (HIBP) são barradas pelo Supabase Auth com *Leaked password protection* ligada
//     no dashboard — não dá para fazer isso aqui sem enviar a senha a um terceiro.
//

export const SENHA_MIN = 12;
export const SENHA_MAX = 128;

export const SENHA_REGRAS_TEXTO = `Pelo menos ${SENHA_MIN} caracteres, com três destes quatro tipos: letra minúscula, letra maiúscula, número e símbolo.`;

const SEQUENCIAS_PROIBIDAS = ["123456", "abcdef", "qwerty", "senha", "password", "wsasistemas", "imobsystem"];

/** Devolve a mensagem de erro, ou null se a senha atende à política. */
export function validarPoliticaSenha(senha: unknown): string | null {
  if (typeof senha !== "string") return "Informe a senha.";
  if (senha.length < SENHA_MIN) return `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
  if (senha.length > SENHA_MAX) return `A senha pode ter no máximo ${SENHA_MAX} caracteres.`;
  if (senha !== senha.trim()) return "A senha não pode começar nem terminar com espaço.";
  const classes =
    Number(/[a-z]/.test(senha)) + Number(/[A-Z]/.test(senha)) + Number(/\d/.test(senha)) + Number(/[^A-Za-z0-9]/.test(senha));
  if (classes < 3) return "Misture pelo menos três tipos: letra minúscula, letra maiúscula, número e símbolo.";
  const baixa = senha.toLowerCase();
  if (SEQUENCIAS_PROIBIDAS.some((s) => baixa.includes(s))) return "A senha é previsível demais. Evite sequências e palavras comuns.";
  if (/^(.)\1+$/.test(senha)) return "A senha não pode repetir um só caractere.";
  return null;
}

/** Lança erro se a senha não atender à política; devolve a senha. */
export function exigirPoliticaSenha(senha: unknown): string {
  const erro = validarPoliticaSenha(senha);
  if (erro) throw new Error(erro);
  return senha as string;
}

// Alfabeto sem caracteres ambíguos (0/O, 1/l/I) para a senha poder ser ditada/copiada sem erro.
const MINUSCULAS = "abcdefghijkmnpqrstuvwxyz";
const MAIUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITOS = "23456789";
const SIMBOLOS = "!@#$%&*+-=?";

function sortear(alfabeto: string, aleatorios: Uint32Array, i: number): string {
  return alfabeto[aleatorios[i] % alfabeto.length];
}

/** Senha inicial aleatória (16 caracteres, 4 classes) gerada com crypto do runtime. */
export function gerarSenhaInicial(tamanho = 16): string {
  const todos = MINUSCULAS + MAIUSCULAS + DIGITOS + SIMBOLOS;
  const aleatorios = new Uint32Array(tamanho + 4);
  globalThis.crypto.getRandomValues(aleatorios);
  const chars = [
    sortear(MINUSCULAS, aleatorios, 0),
    sortear(MAIUSCULAS, aleatorios, 1),
    sortear(DIGITOS, aleatorios, 2),
    sortear(SIMBOLOS, aleatorios, 3),
  ];
  for (let i = 4; i < tamanho; i++) chars.push(sortear(todos, aleatorios, i));
  // embaralha (Fisher–Yates) para as classes obrigatórias não ficarem sempre no início
  for (let i = chars.length - 1; i > 0; i--) {
    const j = aleatorios[(i + 4) % aleatorios.length] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const senha = chars.join("");
  return validarPoliticaSenha(senha) ? gerarSenhaInicial(tamanho) : senha;
}
