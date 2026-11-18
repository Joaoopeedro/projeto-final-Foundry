// routes/chat.js
// Rota principal do chat — /api/chat
// Integração com o agente do Microsoft Foundry

import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { sendFoundryMessage } from '../lib/foundry.js';
import { sanitizeInput } from '../lib/safety.js';

const router = Router();

// === RATE LIMITING ===
// 20 mensagens por 10 minutos por IP (curto prazo)
const shortRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas mensagens em pouco tempo. Aguarde alguns minutos e tente novamente.' },
  keyGenerator: (req) => req.ip,
});

// 200 mensagens por dia por IP (longo prazo)
const dailyRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite diário de mensagens atingido. Retorne amanhã ou entre em contato com o escritório.' },
  keyGenerator: (req) => req.ip,
});

// === VALIDAÇÃO ZOD ===
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

// === ROTA POST /api/chat ===
router.post('/', shortRateLimit, dailyRateLimit, async (req, res) => {
  const logger = req.app.get('logger');
  const startTime = Date.now();

  // Validação do corpo da requisição
  const parseResult = ChatBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Mensagem inválida ou parâmetros incorretos.',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  const { message, conversationId } = parseResult.data;
  const sanitizedMessage = sanitizeInput(message);

  if (!sanitizedMessage) {
    return res.status(400).json({
      error: 'A mensagem não pode estar vazia após sanitização.',
    });
  }

  // Log estritamente de metadados — SEM REGISTRAR O CONTEÚDO DAS MENSAGENS (LGPD)
  logger.info({
    hasConversationId: Boolean(conversationId),
    conversationId: conversationId || undefined,
    messageLength: sanitizedMessage.length,
    ip: req.ip?.replace(/\d+$/, 'xxx'),
  }, 'chat_request');

  try {
    const result = await sendFoundryMessage({
      message: sanitizedMessage,
      conversationId: conversationId || undefined,
    });

    logger.info({
      durationMs: Date.now() - startTime,
      conversationId: result.conversationId,
    }, 'chat_done');

    return res.json({
      reply: result.reply,
      conversationId: result.conversationId,
    });
  } catch (err) {
    logger.error({ err: err.message }, 'foundry_agent_error');
    return res.status(502).json({
      error: 'Não foi possível obter resposta do agente no momento. Tente novamente mais tarde.',
    });
  }
});

export default router;
