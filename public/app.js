// app.js — Frontend do chat jurídico
// Sem frameworks pesados. ES modules puros.
// Segurança: sem dangerouslySetInnerHTML, HTML escapado manualmente.

// ===== CONSTANTES =====
const URGENCY_KEYWORDS = [
  'preso', 'presa', 'prisão', 'flagrante', 'mandado de busca', 'mandado de prisão',
  'bloqueio', 'bloqueada', 'bloqueado', 'bloqueio de conta', 'conta bloqueada', 'bens bloqueados', 'bloqueio judicial',
  'citado', 'citada', 'citação', 'intimado', 'intimada', 'intimação',
  'prazo', 'vencendo', 'último dia', 'liminar', 'tutela de urgência', 'medida cautelar',
  'violência', 'ameaça', 'ameaçado', 'ameaçada', 'medida protetiva',
  'batida policial', 'despejo', 'reintegração de posse', 'penhora', 'leilão judicial',
];

const CRISIS_KEYWORDS = [
  'suicídio', 'suicida', 'quero me matar', 'não quero mais viver', 'me matar',
  'acabar com tudo', 'autolesão', 'me machucar', 'estou sendo espancada',
  'estou sendo agredida', 'estou em perigo agora', 'ele está me batendo',
  'ela está me batendo', 'violência doméstica agora', 'socorro',
];

const MAX_HISTORY = 20;
const MAX_CHARS = 2000;

// ===== ESTADO =====
let messages = []; // Histórico em memória (sessionStorage como backup)
let conversationId = sessionStorage.getItem('juridica_conv_id') || null;
let currentArea = null;
let isStreaming = false;
let config = { officeName: 'Duarte Advocacia', whatsapp: '', oab: '', officeEmail: '' };

// ===== UTILITÁRIOS =====

/** Normaliza texto para comparação de palavras-chave */
function normalizeText(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Detecta palavras de urgência */
function isUrgent(text) {
  const n = normalizeText(text);
  return URGENCY_KEYWORDS.some(kw => n.includes(normalizeText(kw)));
}

/** Detecta palavras de crise pessoal */
function isCrisis(text) {
  const n = normalizeText(text);
  return CRISIS_KEYWORDS.some(kw => n.includes(normalizeText(kw)));
}

/**
 * Escapa HTML para evitar XSS.
 * NUNCA usar innerHTML com texto do usuário/modelo sem passar aqui antes.
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converte Markdown simples para HTML seguro.
 * Suporta: **negrito**, *itálico*, listas ul/ol, tabelas simples, `código`.
 * NÃO usa eval nem innerHTML direto com input não sanitizado.
 */
function markdownToHtml(text) {
  // Primeiro escapa o HTML bruto
  let html = escapeHtml(text);

  // Remove tentativas de javascript: injection
  html = html.replace(/javascript\s*:/gi, '');

  // Tabelas: | col | col |
  html = html.replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm, (match, header, body) => {
    const headers = header.split('|').filter(h => h.trim()).map(h => `<th>${h.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Listas não ordenadas
  html = html.replace(/^[*-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);

  // Listas ordenadas
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Código inline
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Negrito e itálico
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Quebras de parágrafo
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<ul>') || p.startsWith('<ol>') || p.startsWith('<table>')) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).filter(Boolean).join('\n');

  return html;
}

/** Formata data legível */
function formatDate(date) {
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Calcula dias úteis a partir de uma data, considerando feriados nacionais e suspensão CPC */
function calcBusinessDays(startDate, days, isCPC = true) {
  // Feriados nacionais fixos (mês/dia)
  const fixedHolidays = [
    [1, 1], [4, 21], [5, 1], [9, 7], [10, 12], [11, 2], [11, 15], [11, 20], [12, 25],
  ];

  function isHoliday(d) {
    return fixedHolidays.some(([m, day]) => d.getMonth() + 1 === m && d.getDate() === day);
  }

  function isSuspension(d) {
    if (!isCPC) return false;
    const m = d.getMonth() + 1;
    const day = d.getDate();
    // Suspensão CPC: 20/12 a 20/01
    if (m === 12 && day >= 20) return true;
    if (m === 1 && day <= 20) return true;
    return false;
  }

  function isWorkDay(d) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return false; // Fim de semana
    if (isHoliday(d)) return false;
    if (isSuspension(d)) return false;
    return true;
  }

  // O prazo começa a contar no dia útil seguinte à intimação
  let current = new Date(startDate);
  current.setDate(current.getDate() + 1);
  while (!isWorkDay(current)) current.setDate(current.getDate() + 1);

  let counted = 0;
  while (counted < days) {
    if (isWorkDay(current)) counted++;
    if (counted < days) current.setDate(current.getDate() + 1);
  }

  return current;
}

function calcCalendarDays(startDate, days) {
  const result = new Date(startDate);
  result.setDate(result.getDate() + days);
  return result;
}

// ===== CARREGA CONFIG DO SERVIDOR =====
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) config = await res.json();
    applyConfig();
  } catch {
    /* Continua com defaults */
  }
}

function applyConfig() {
  // Atualiza WhatsApp links
  const waNumber = (config.whatsapp || '').replace(/\D/g, '');
  const waUrl = waNumber ? `https://wa.me/${waNumber}` : '#';

  document.querySelectorAll('#hero-whatsapp, #contact-whatsapp, #urgency-whatsapp, #btn-whatsapp-chat').forEach(el => {
    if (el.tagName === 'A') {
      el.href = el.id === 'btn-whatsapp-chat' ? '#' : waUrl;
    }
  });

  // WhatsApp do hero e contato
  const heroWa = document.getElementById('hero-whatsapp');
  if (heroWa) heroWa.href = waUrl;

  const contactWa = document.getElementById('contact-whatsapp');
  if (contactWa) contactWa.href = waUrl;

  const urgencyWa = document.getElementById('urgency-whatsapp');
  if (urgencyWa) urgencyWa.href = waUrl;

  // Email
  const emailEl = document.getElementById('contact-email');
  if (emailEl && config.officeEmail) {
    emailEl.href = `mailto:${config.officeEmail}`;
    emailEl.textContent = config.officeEmail;
  }

  // OAB
  const oabEl = document.getElementById('contact-oab');
  if (oabEl && config.oab) oabEl.textContent = config.oab;
  const footerOab = document.getElementById('footer-oab');
  if (footerOab && config.oab) footerOab.textContent = config.oab;
}

function getWhatsAppUrl(summary = '') {
  const waNumber = (config.whatsapp || '').replace(/\D/g, '');
  if (!waNumber) return '#';
  const text = summary
    ? `Olá, acabei de usar a IA Jurídica do ${config.officeName || 'Duarte Advocacia'}. Resumo do meu caso: ${summary}`
    : `Olá, gostaria de falar com um advogado do ${config.officeName || 'Duarte Advocacia'}.`;
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
}

// ===== CHAT =====

/** Verifica consentimento no localStorage */
function hasConsent() {
  return localStorage.getItem('juridica_consent') === '1';
}

function saveConsent() {
  localStorage.setItem('juridica_consent', '1');
}

/** Salva histórico no sessionStorage */
function saveHistory() {
  try {
    sessionStorage.setItem('juridica_msgs', JSON.stringify(messages.slice(-MAX_HISTORY)));
  } catch { /* sessionStorage cheio — ignora */ }
}

function loadHistory() {
  try {
    const saved = sessionStorage.getItem('juridica_msgs');
    if (saved) messages = JSON.parse(saved);
  } catch { messages = []; }
}

// ===== DOM REFS =====
const chatPanel = document.getElementById('chat-panel');
const chatFab = document.getElementById('chat-fab');
const chatOverlay = document.getElementById('chat-overlay');
const chatClose = document.getElementById('chat-close');
const consentScreen = document.getElementById('consent-screen');
const chatMessages = document.getElementById('chat-messages');
const chatSuggestions = document.getElementById('chat-suggestions');
const chatInputArea = document.getElementById('chat-input-area');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const charCounter = document.getElementById('char-counter');
const urgencyBanner = document.getElementById('urgency-banner');
const consentCheckbox = document.getElementById('consent-checkbox');
const consentBtn = document.getElementById('consent-btn');
const btnNewChat = document.getElementById('btn-new-chat');
const btnDownload = document.getElementById('btn-download');
const btnWhatsappChat = document.getElementById('btn-whatsapp-chat');

// ===== ABRIR / FECHAR CHAT =====
function openChat(area) {
  if (area) currentArea = area;
  chatPanel.classList.add('open');
  chatPanel.setAttribute('aria-hidden', 'false');
  chatFab.setAttribute('aria-expanded', 'true');
  chatFab.querySelector('.fab-icon-open').style.display = 'none';
  chatFab.querySelector('.fab-icon-close').style.display = 'block';
  chatOverlay.classList.add('visible');

  if (hasConsent()) {
    showChatUI();
    if (messages.length === 0) showWelcome();
  }
  // Foca no input se já consentiu
  setTimeout(() => {
    if (hasConsent()) chatInput?.focus();
  }, 350);
}

function closeChat() {
  chatPanel.classList.remove('open');
  chatPanel.setAttribute('aria-hidden', 'true');
  chatFab.setAttribute('aria-expanded', 'false');
  chatFab.querySelector('.fab-icon-open').style.display = 'block';
  chatFab.querySelector('.fab-icon-close').style.display = 'none';
  chatOverlay.classList.remove('visible');
  chatFab.focus();
}

function showChatUI() {
  consentScreen.style.display = 'none';
  chatMessages.hidden = false;
  chatSuggestions.hidden = false;
  chatInputArea.hidden = false;
}

// ===== CONSENTIMENTO =====
consentCheckbox?.addEventListener('change', () => {
  consentBtn.disabled = !consentCheckbox.checked;
});

consentBtn?.addEventListener('click', () => {
  if (!consentCheckbox.checked) return;
  saveConsent();
  showChatUI();
  showWelcome();
  chatInput.focus();
});

// ===== MENSAGEM DE BOAS-VINDAS =====
function showWelcome() {
  const areaName = getAreaName(currentArea);
  const areaMsg = areaName ? ` sobre <strong>${areaName}</strong>` : '';
  const welcomeText = `Olá! Sou o assistente jurídico do **${config.officeName || 'Duarte Advocacia'}**. ${areaMsg ? `Vejo que você quer falar${areaMsg}. ` : ''}Como posso ajudar você hoje?\n\nDescreva sua situação com suas próprias palavras — sem precisar usar termos jurídicos. Tudo que você compartilhar é tratado com sigilo.`;
  appendMessage('assistant', welcomeText);
}

function getAreaName(areaSlug) {
  const map = {
    consumidor: 'Direito do Consumidor', trabalhista: 'Direito Trabalhista',
    familia: 'Família e Sucessões', civel: 'Cível e Contratos',
    previdenciario: 'Previdenciário (INSS)', penal: 'Penal',
    tributario: 'Tributário', imobiliario: 'Imobiliário',
    empresarial: 'Empresarial', digital: 'Digital e LGPD',
    saude: 'Saúde e Planos', bancario: 'Bancário',
  };
  return map[areaSlug] || null;
}

// ===== RENDERIZAÇÃO DE MENSAGENS =====

/**
 * Adiciona mensagem ao histórico e ao DOM.
 * O conteúdo do usuário é escapado antes de inserir no DOM.
 */
function appendMessage(role, content, options = {}) {
  const { streaming = false, showActions = true } = options;

  // Adiciona ao histórico em memória (evita duplicatas no streaming)
  if (!streaming) {
    messages.push({ role, content });
    if (messages.length > MAX_HISTORY) messages.shift();
    saveHistory();
  }

  const wrapper = document.createElement('div');
  wrapper.className = `msg-wrapper ${role}`;
  wrapper.dataset.role = role;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  // Renderiza Markdown seguro (HTML já escapado dentro de markdownToHtml)
  bubble.innerHTML = markdownToHtml(content);

  wrapper.appendChild(bubble);

  if (role === 'assistant' && showActions) {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    actions.setAttribute('aria-label', 'Ações da mensagem');

    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-action-btn';
    copyBtn.textContent = 'Copiar';
    copyBtn.setAttribute('aria-label', 'Copiar resposta');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(() => {
        copyBtn.textContent = 'Copiado!';
        setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 2000);
      });
    });
    actions.appendChild(copyBtn);
    wrapper.appendChild(actions);
  }

  chatMessages.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function appendTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.id = 'typing-indicator';
  indicator.setAttribute('aria-label', 'Assistente está digitando');
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span');
    dot.className = 'typing-dot';
    indicator.appendChild(dot);
  }
  chatMessages.appendChild(indicator);
  scrollToBottom();
  return indicator;
}

function removeTypingIndicator() {
  document.getElementById('typing-indicator')?.remove();
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showCrisisMessage() {
  const div = document.createElement('div');
  div.className = 'crisis-msg';
  div.setAttribute('role', 'alert');
  div.innerHTML = `
    <strong>Você mencionou algo que me preocupa.</strong> Se você está em risco agora, por favor contate:
    <ul class="crisis-contacts" style="margin-top:.5rem">
      <li>📞 <strong>CVV:</strong> 188 (24h, gratuito — apoio emocional)</li>
      <li>🚔 <strong>Polícia:</strong> 190</li>
      <li>💜 <strong>Ligue 180:</strong> violência contra a mulher</li>
      <li>🤝 <strong>Disque 100:</strong> direitos humanos</li>
      <li>🚑 <strong>SAMU:</strong> 192</li>
    </ul>
    <p style="margin-top:.75rem;color:var(--muted)">Quando estiver seguro(a), posso continuar ajudando com as questões jurídicas.</p>
  `;
  chatMessages.appendChild(div);
  scrollToBottom();
}

function showError(message, onRetry) {
  const div = document.createElement('div');
  div.className = 'error-msg';
  div.setAttribute('role', 'alert');

  const p = document.createElement('p');
  p.textContent = message;
  div.appendChild(p);

  if (onRetry) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline';
    btn.textContent = 'Tentar novamente';
    btn.addEventListener('click', () => {
      div.remove();
      onRetry();
    });
    div.appendChild(btn);
  }

  chatMessages.appendChild(div);
  scrollToBottom();
}

// ===== ENVIO DE MENSAGEM =====

async function sendMessage(text) {
  if (!text.trim() || isStreaming) return;
  if (!hasConsent()) return;

  const userText = text.trim().slice(0, MAX_CHARS);
  if (!userText) return;

  // Limpa input
  chatInput.value = '';
  chatInput.style.height = 'auto';
  updateCharCounter(0);
  chatSend.disabled = true;

  // Detecta e exibe crise antes de qualquer outra coisa
  if (isCrisis(userText)) {
    appendMessage('user', userText);
    showCrisisMessage();
    messages.push({ role: 'user', content: userText });
    saveHistory();
    return;
  }

  // Exibe urgência
  if (isUrgent(userText)) {
    urgencyBanner.hidden = false;
    // Atualiza link do WhatsApp de urgência com resumo
    const urgWa = document.getElementById('urgency-whatsapp');
    if (urgWa) urgWa.href = getWhatsAppUrl(userText.slice(0, 200));
  }

  appendMessage('user', userText);

  // Oculta sugestões após primeiro envio
  chatSuggestions.hidden = true;

  isStreaming = true;
  appendTypingIndicator();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        conversationId: conversationId || undefined,
      }),
    });

    removeTypingIndicator();

    if (!res.ok) {
      let errMsg = 'Erro ao processar sua mensagem.';
      try {
        const errData = await res.json();
        if (errData && errData.error) errMsg = errData.error;
      } catch {
        if (res.status === 429) errMsg = 'Muitas mensagens em pouco tempo. Aguarde alguns minutos.';
        else if (res.status === 502) errMsg = 'Não foi possível obter resposta do agente no momento. Tente novamente mais tarde.';
        else if (res.status === 400) errMsg = 'Mensagem inválida. Verifique e tente novamente.';
      }
      showError(errMsg, () => sendMessage(userText));
      isStreaming = false;
      chatSend.disabled = false;
      return;
    }

    const data = await res.json();

    if (data.conversationId) {
      conversationId = data.conversationId;
      sessionStorage.setItem('juridica_conv_id', conversationId);
    }

    const reply = data.reply || 'Sem resposta do agente.';
    appendMessage('assistant', reply);

  } catch (err) {
    removeTypingIndicator();
    const errMsg = err.name === 'TypeError'
      ? 'Sem conexão com a internet. Verifique sua rede e tente novamente.'
      : 'Erro inesperado. Tente novamente.';
    showError(errMsg, () => sendMessage(userText));
  }

  isStreaming = false;
  chatSend.disabled = false;
  chatInput.focus();
}

// ===== INPUT =====
chatInput?.addEventListener('input', () => {
  updateCharCounter(chatInput.value.length);
  chatSend.disabled = !chatInput.value.trim() || isStreaming;

  // Auto-resize
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
});

chatInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!chatSend.disabled) sendMessage(chatInput.value);
  }
});

chatSend?.addEventListener('click', () => sendMessage(chatInput.value));

function updateCharCounter(len) {
  charCounter.textContent = `${len}/${MAX_CHARS}`;
  charCounter.style.color = len > 1800 ? 'var(--danger)' : 'var(--muted)';
}

// ===== SUGESTÕES =====
document.querySelectorAll('.suggestion-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!hasConsent()) return;
    sendMessage(btn.dataset.msg);
  });
});

// ===== BOTÕES DE AÇÃO DO CHAT =====
btnNewChat?.addEventListener('click', () => {
  if (isStreaming) return;
  conversationId = null;
  sessionStorage.removeItem('juridica_conv_id');
  messages = [];
  sessionStorage.removeItem('juridica_msgs');
  chatMessages.innerHTML = '';
  urgencyBanner.hidden = true;
  chatSuggestions.hidden = false;
  currentArea = null;
  showWelcome();
});

btnDownload?.addEventListener('click', () => {
  if (messages.length === 0) return;
  const lines = messages.map(m => {
    const prefix = m.role === 'user' ? 'Você' : 'IA Jurídica';
    return `[${prefix}]\n${m.content}\n`;
  });
  const content = `Conversa — ${config.officeName || 'Duarte Advocacia'} IA Jurídica\nData: ${new Date().toLocaleDateString('pt-BR')}\n\n${lines.join('\n---\n\n')}`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `conversa-juridica-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

btnWhatsappChat?.addEventListener('click', (e) => {
  e.preventDefault();
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const url = getWhatsAppUrl(lastUserMsg?.content?.slice(0, 300) || '');
  window.open(url, '_blank', 'noopener,noreferrer');
});

// ===== BOTÕES DE ABERTURA DO CHAT =====
document.getElementById('hero-open-chat')?.addEventListener('click', () => openChat(null));
document.getElementById('header-open-chat')?.addEventListener('click', () => openChat(null));
chatFab?.addEventListener('click', () => {
  if (chatPanel.classList.contains('open')) closeChat();
  else openChat(null);
});
chatClose?.addEventListener('click', closeChat);
chatOverlay?.addEventListener('click', closeChat);

// Áreas
document.querySelectorAll('.area-card').forEach(card => {
  card.addEventListener('click', () => {
    const area = card.dataset.area;
    openChat(area);
    if (hasConsent() && messages.length === 0) {
      // A mensagem de boas-vindas será exibida por openChat
    } else if (hasConsent() && messages.length > 0) {
      // Apenas define a área sem resetar
      currentArea = area;
    }
  });
});

// Fecha com Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (chatPanel.classList.contains('open')) closeChat();
    if (mainNav?.classList.contains('open')) {
      mainNav.classList.remove('open');
      menuToggle?.setAttribute('aria-expanded', 'false');
    }
  }
});

// ===== ACORDEÕES =====
document.querySelectorAll('.accordion-trigger').forEach(trigger => {
  trigger.addEventListener('click', () => {
    const panelId = trigger.getAttribute('aria-controls');
    const panel = document.getElementById(panelId);
    const isOpen = trigger.getAttribute('aria-expanded') === 'true';

    // Fecha outros no mesmo acordeão
    const accordion = trigger.closest('.accordion');
    accordion.querySelectorAll('.accordion-trigger').forEach(t => {
      if (t !== trigger) {
        t.setAttribute('aria-expanded', 'false');
        const p = document.getElementById(t.getAttribute('aria-controls'));
        if (p) p.hidden = true;
      }
    });

    trigger.setAttribute('aria-expanded', String(!isOpen));
    if (panel) panel.hidden = isOpen;
  });
});

// ===== CALCULADORA DE PRAZOS =====
document.getElementById('calcular-prazo')?.addEventListener('click', () => {
  const tipo = document.getElementById('prazo-tipo').value;
  const dataStr = document.getElementById('prazo-data').value;
  const resultado = document.getElementById('prazo-resultado');

  if (!tipo || !dataStr) {
    alert('Por favor, selecione o tipo de prazo e informe a data da intimação.');
    return;
  }

  const dataBase = new Date(dataStr + 'T12:00:00'); // Evita problemas de fuso
  if (isNaN(dataBase.getTime())) {
    alert('Data inválida.');
    return;
  }

  let dataFinal;
  let desc = '';
  let isCPC = true;

  if (tipo.endsWith('u')) {
    // Dias úteis CPC
    const days = parseInt(tipo);
    isCPC = !tipo.includes('trab');
    dataFinal = calcBusinessDays(dataBase, days, isCPC);
    desc = `${days} dias úteis${isCPC ? ' (com suspensão de 20/dez a 20/jan — CPC)' : ' (trabalhista)'}`;
  } else if (tipo.endsWith('u-trab')) {
    const days = parseInt(tipo);
    dataFinal = calcBusinessDays(dataBase, days, false);
    desc = `${days} dias úteis trabalhistas`;
  } else {
    // Dias corridos
    const days = parseInt(tipo);
    dataFinal = calcCalendarDays(dataBase, days);
    desc = `${days} dias corridos`;
  }

  const daysUntil = Math.ceil((dataFinal - new Date()) / (1000 * 60 * 60 * 24));

  document.getElementById('prazo-data-resultado').textContent = formatDate(dataFinal);
  document.getElementById('prazo-dias-resultado').textContent =
    daysUntil > 0 ? `Faltam ${daysUntil} dia(s) — ${desc}` :
      daysUntil === 0 ? `Hoje é o último dia — ${desc}` :
        `Prazo vencido há ${Math.abs(daysUntil)} dia(s) — ${desc}`;

  resultado.hidden = false;
  resultado.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// ===== ANIMAÇÃO DA PRÉVIA DO HERO =====
function animateHeroPreview() {
  const userMsg = document.querySelector('.preview-msg.user');
  const assistantMsg = document.querySelector('.preview-msg.typing-preview');
  if (!userMsg || !assistantMsg) return;

  setTimeout(() => {
    userMsg.style.opacity = '1';
    userMsg.style.transition = 'opacity .4s ease';
  }, 1500);

  setTimeout(() => {
    assistantMsg.style.opacity = '1';
    assistantMsg.style.transition = 'opacity .4s ease';
  }, 2500);
}

// ===== MENU MOBILE =====
const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.getElementById('main-nav');
menuToggle?.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

// Fecha menu ao clicar em link
mainNav?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    mainNav.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  });
});

// Fecha menu ao clicar fora
document.addEventListener('click', (e) => {
  if (mainNav?.classList.contains('open') && !mainNav.contains(e.target) && !menuToggle?.contains(e.target)) {
    mainNav.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  }
});

// ===== ANO NO RODAPÉ =====
const footerYear = document.getElementById('footer-year');
if (footerYear) footerYear.textContent = new Date().getFullYear();

// ===== INICIALIZAÇÃO =====
async function init() {
  await loadConfig();
  loadHistory();

  // Reinicia histórico de sessão
  if (!sessionStorage.getItem('juridica_session_started')) {
    messages = [];
    conversationId = null;
    sessionStorage.removeItem('juridica_conv_id');
    sessionStorage.removeItem('juridica_msgs');
    sessionStorage.setItem('juridica_session_started', '1');
  }

  // Animação hero
  animateHeroPreview();

  // Se chat já foi consentido e estava aberto, não reabre automaticamente
}

init();

