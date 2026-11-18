// tests/validation.test.js
// Testes de validação do body da rota /api/chat (Microsoft Foundry)
// Execute com: node --test tests/validation.test.js

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

// Replica o schema de validação do backend
const ChatBodySchema = z.object({
  message: z
    .string({ required_error: 'A mensagem é obrigatória.' })
    .trim()
    .min(1, 'A mensagem não pode estar vazia.')
    .max(2000, 'A mensagem deve ter no máximo 2000 caracteres.'),
  conversationId: z
    .string()
    .trim()
    .regex(/^conv_[A-Za-z0-9_-]+$/, 'Formato de conversationId inválido (deve iniciar com conv_).')
    .optional()
    .nullable(),
});

describe('ChatBodySchema — casos válidos', () => {
  test('aceita mensagem válida sem conversationId', () => {
    const result = ChatBodySchema.safeParse({
      message: 'Olá, preciso de orientações jurídicas.',
    });
    assert.equal(result.success, true);
    assert.equal(result.data.message, 'Olá, preciso de orientações jurídicas.');
  });

  test('aceita mensagem com conversationId válido', () => {
    const result = ChatBodySchema.safeParse({
      message: 'Gostaria de saber o prazo da contestação.',
      conversationId: 'conv_123456789abcdef',
    });
    assert.equal(result.success, true);
    assert.equal(result.data.conversationId, 'conv_123456789abcdef');
  });

  test('aceita conversationId nulo', () => {
    const result = ChatBodySchema.safeParse({
      message: 'Pergunta inicial',
      conversationId: null,
    });
    assert.equal(result.success, true);
  });

  test('aceita mensagem de até 2000 caracteres', () => {
    const text = 'a'.repeat(2000);
    const result = ChatBodySchema.safeParse({
      message: text,
      conversationId: 'conv_abc123',
    });
    assert.equal(result.success, true);
  });
});

describe('ChatBodySchema — casos inválidos', () => {
  test('rejeita body sem message', () => {
    const result = ChatBodySchema.safeParse({});
    assert.equal(result.success, false);
  });

  test('rejeita mensagem vazia', () => {
    const result = ChatBodySchema.safeParse({
      message: '',
    });
    assert.equal(result.success, false);
  });

  test('rejeita mensagem apenas com espaços em branco', () => {
    const result = ChatBodySchema.safeParse({
      message: '   ',
    });
    assert.equal(result.success, false);
  });

  test('rejeita mensagem com mais de 2000 caracteres', () => {
    const result = ChatBodySchema.safeParse({
      message: 'a'.repeat(2001),
    });
    assert.equal(result.success, false);
  });

  test('rejeita conversationId com formato inválido (sem prefixo conv_)', () => {
    const result = ChatBodySchema.safeParse({
      message: 'Mensagem válida',
      conversationId: '123456',
    });
    assert.equal(result.success, false);
  });

  test('rejeita conversationId com caracteres inválidos', () => {
    const result = ChatBodySchema.safeParse({
      message: 'Mensagem válida',
      conversationId: 'conv_invalid@character!',
    });
    assert.equal(result.success, false);
  });
});
