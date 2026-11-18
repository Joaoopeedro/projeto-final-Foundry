// tests/server.test.js
// Teste de integração do servidor Express (rotas /api/health, /api/config, GET /)

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../server.js';

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => {
  if (server) server.close();
});

describe('Rotas HTTP do servidor', () => {
  test('GET /api/health retorna status ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.service, 'Duarte Advocacia IA Jurídica');
  });

  test('GET /api/config retorna dados públicos do escritório', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.officeName);
    assert.ok(data.whatsapp !== undefined);
    assert.ok(data.oab !== undefined);
  });

  test('GET / carrega a landing page HTML', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Duarte Advocacia'));
    assert.ok(text.includes('IA Jurídica'));
  });

  test('GET /privacidade carrega página de privacidade', async () => {
    const res = await fetch(`${baseUrl}/privacidade`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Política de Privacidade'));
  });

  test('GET /termos carrega página de termos', async () => {
    const res = await fetch(`${baseUrl}/termos`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Termos de Uso'));
  });

  test('POST /api/chat com mensagem inválida ou vazia retorna 400', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '',
      }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  test('POST /api/chat com conversationId inválido retorna 400', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Pergunta válida',
        conversationId: 'invalido_sem_conv',
      }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });
});

