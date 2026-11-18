// lib/safety.js
// Módulo de segurança: detecta urgência e crise pessoal nas mensagens

/**
 * Palavras-chave que indicam situação jurídica URGENTE.
 * Quando detectadas, o front exibe faixa vermelha e o backend
 * inclui instrução especial no prompt para priorizar orientações de urgência.
 */
export const URGENCY_KEYWORDS = [
  'preso', 'presa', 'prisão', 'prender', 'flagrante',
  'mandado de busca', 'mandado de prisão', 'mandado de apreensão',
  'bloqueio', 'bloqueada', 'bloqueado', 'bloqueio de conta', 'conta bloqueada', 'bens bloqueados', 'bloqueio judicial',
  'citado', 'citada', 'citação', 'intimado', 'intimada', 'intimação',
  'prazo', 'vencendo', 'vence amanhã', 'último dia',
  'liminar', 'tutela de urgência', 'medida cautelar',
  'violência', 'ameaça', 'ameaçado', 'ameaçada',
  'medida protetiva', 'boletim de ocorrência',
  'batida policial', 'abordagem policial',
  'despejo', 'reintegração de posse',
  'execução fiscal', 'penhora', 'leilão judicial',
];

/**
 * Palavras-chave que indicam CRISE PESSOAL (saúde mental, violência doméstica em curso).
 * Quando detectadas, exibir contatos de emergência ANTES de qualquer orientação jurídica.
 */
export const CRISIS_KEYWORDS = [
  'suicídio', 'suicida', 'quero me matar', 'não quero mais viver',
  'me matar', 'acabar com tudo', 'autolesão', 'me machucar',
  'estou sendo espancada', 'estou sendo agredida', 'estou em perigo agora',
  'ele está me batendo', 'ela está me batendo',
  'violência doméstica agora', 'socorro', 'me ajuda agora',
];

/**
 * Verifica se o texto contém palavras de urgência jurídica.
 * @param {string} text
 * @returns {boolean}
 */
export function isUrgent(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizedKeywords = URGENCY_KEYWORDS.map(k =>
    k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );
  return normalizedKeywords.some(kw => lower.includes(kw));
}

/**
 * Verifica se o texto indica crise pessoal (risco de vida ou violência em curso).
 * @param {string} text
 * @returns {boolean}
 */
export function isCrisis(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizedKeywords = CRISIS_KEYWORDS.map(k =>
    k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );
  return normalizedKeywords.some(kw => lower.includes(kw));
}

/**
 * Sanitiza entrada do usuário: remove caracteres de controle perigosos.
 * NÃO escapa HTML aqui — isso é feito no front-end.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeInput(text) {
  if (!text || typeof text !== 'string') return '';
  // Remove caracteres de controle exceto newline e tab
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

/**
 * Instrução adicional de urgência a ser injetada no prompt do sistema
 * quando a mensagem do usuário for detectada como urgente.
 */
export const URGENCY_PROMPT_INJECTION =
  '\n\n⚠️ ATENÇÃO — SITUAÇÃO URGENTE DETECTADA: O usuário pode estar enfrentando situação que requer ação imediata. ' +
  'Priorize orientações de urgência logo no início da resposta. ' +
  'Destaque em negrito os prazos e próximas ações. ' +
  'Encaminhe ao advogado com destaque especial. ' +
  'Não minimize a gravidade da situação.';

