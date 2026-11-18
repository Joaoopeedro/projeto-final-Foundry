// tests/safety.test.js
// Testes automatizados para lib/safety.js
// Execute com: node --test tests/safety.test.js

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isUrgent, isCrisis, sanitizeInput } from '../lib/safety.js';

describe('isUrgent()', () => {
  test('detecta "preso" como urgente', () => {
    assert.equal(isUrgent('meu filho foi preso ontem'), true);
  });
  test('detecta "citado" como urgente', () => {
    assert.equal(isUrgent('fui citado em um processo'), true);
  });
  test('detecta "bloqueio de conta" como urgente', () => {
    assert.equal(isUrgent('minha conta foi bloqueada judicialmente'), true);
  });
  test('detecta "liminar" como urgente', () => {
    assert.equal(isUrgent('conseguiram uma liminar contra mim'), true);
  });
  test('detecta "medida protetiva" como urgente', () => {
    assert.equal(isUrgent('preciso de uma medida protetiva'), true);
  });
  test('não detecta texto comum como urgente', () => {
    assert.equal(isUrgent('gostaria de saber sobre meus direitos trabalhistas'), false);
  });
  test('trata string vazia como não urgente', () => {
    assert.equal(isUrgent(''), false);
  });
  test('trata null como não urgente', () => {
    assert.equal(isUrgent(null), false);
  });
  test('detecta palavra com acento normalizado', () => {
    assert.equal(isUrgent('recebi uma intimação hoje'), true);
  });
});

describe('isCrisis()', () => {
  test('detecta "suicídio" como crise', () => {
    assert.equal(isCrisis('estou pensando em suicídio'), true);
  });
  test('detecta "quero me matar" como crise', () => {
    assert.equal(isCrisis('não aguento mais, quero me matar'), true);
  });
  test('não detecta texto jurídico comum como crise', () => {
    assert.equal(isCrisis('fui demitido sem justa causa'), false);
  });
  test('trata string vazia como não crise', () => {
    assert.equal(isCrisis(''), false);
  });
});

describe('sanitizeInput()', () => {
  test('remove caracteres de controle perigosos', () => {
    const result = sanitizeInput('texto\x00com\x01controle');
    assert.equal(result.includes('\x00'), false);
    assert.equal(result.includes('\x01'), false);
  });
  test('mantém texto normal intacto', () => {
    const input = 'Olá, preciso de ajuda com meu caso jurídico.';
    assert.equal(sanitizeInput(input), input.trim());
  });
  test('mantém newlines e tabs', () => {
    const input = 'linha 1\nlinha 2\ttab';
    assert.equal(sanitizeInput(input), input.trim());
  });
  test('trata null como string vazia', () => {
    assert.equal(sanitizeInput(null), '');
  });
  test('faz trim de espaços externos', () => {
    assert.equal(sanitizeInput('  texto  '), 'texto');
  });
});

