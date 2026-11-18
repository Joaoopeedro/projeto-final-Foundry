// tests/markdown.test.js
// Testes para o renderizador seguro de Markdown (escape de HTML + conversão)
// Execute com: node --test tests/markdown.test.js

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Replica a lógica de markdownToHtml do frontend (versão Node.js)
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function markdownToHtml(text) {
  let html = escapeHtml(text);

  // Remove tentativas de javascript: injection
  html = html.replace(/javascript\s*:/gi, '');

  // Tabelas
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

  // Código inline
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Negrito e itálico
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Parágrafos
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<ul>') || p.startsWith('<ol>') || p.startsWith('<table>')) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).filter(Boolean).join('\n');

  return html;
}

describe('escapeHtml()', () => {
  test('escapa < e >', () => {
    const result = escapeHtml('<script>alert(1)</script>');
    assert.equal(result.includes('<script>'), false);
    assert.equal(result.includes('&lt;script&gt;'), true);
  });

  test('escapa &', () => {
    assert.equal(escapeHtml('a & b'), 'a &amp; b');
  });

  test('escapa aspas duplas', () => {
    assert.equal(escapeHtml('diz "olá"'), 'diz &quot;olá&quot;');
  });

  test('escapa aspas simples', () => {
    assert.equal(escapeHtml("it's"), "it&#39;s");
  });

  test('mantém texto normal intacto', () => {
    assert.equal(escapeHtml('texto normal 123'), 'texto normal 123');
  });
});

describe('markdownToHtml() — XSS prevention', () => {
  test('não renderiza tag script do usuário', () => {
    const result = markdownToHtml('<script>alert("xss")</script>');
    assert.equal(result.includes('<script>'), false);
  });

  test('não renderiza img com onerror', () => {
    const result = markdownToHtml('<img src=x onerror=alert(1)>');
    assert.equal(result.includes('<img'), false);
  });

  test('não permite javascript: em links', () => {
    const result = markdownToHtml('<a href="javascript:alert(1)">clique</a>');
    assert.equal(result.includes('javascript:'), false);
  });
});

describe('markdownToHtml() — renderização', () => {
  test('converte **negrito** para <strong>', () => {
    const result = markdownToHtml('texto **negrito** aqui');
    assert.ok(result.includes('<strong>negrito</strong>'));
  });

  test('converte *itálico* para <em>', () => {
    const result = markdownToHtml('texto *itálico* aqui');
    assert.ok(result.includes('<em>itálico</em>'));
  });

  test('converte `código` para <code>', () => {
    const result = markdownToHtml('use `código` aqui');
    assert.ok(result.includes('<code>código</code>'));
  });

  test('converte lista com - para <ul>', () => {
    const result = markdownToHtml('- item 1\n- item 2');
    assert.ok(result.includes('<ul>'));
    assert.ok(result.includes('<li>item 1</li>'));
    assert.ok(result.includes('<li>item 2</li>'));
  });

  test('converte lista com * para <ul>', () => {
    const result = markdownToHtml('* item 1\n* item 2');
    assert.ok(result.includes('<ul>'));
  });

  test('envolve texto em <p>', () => {
    const result = markdownToHtml('Parágrafo simples.');
    assert.ok(result.includes('<p>'));
    assert.ok(result.includes('</p>'));
  });

  test('combina negrito e escape corretamente', () => {
    const result = markdownToHtml('**prazo de 15 dias** para <contestação>');
    assert.ok(result.includes('<strong>prazo de 15 dias</strong>'));
    assert.ok(result.includes('&lt;contestação&gt;'));
  });
});

