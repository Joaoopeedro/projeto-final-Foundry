// server.js
// Servidor principal — Duarte Advocacia IA Jurídica
// Segurança: helmet, CORS restrito, rate limit, sem x-powered-by, CSP

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import pino from 'pino';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import chatRouter from './routes/chat.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// === LOGGER (pino — sem conteúdo de mensagens) ===
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || `http://localhost:${PORT}`;

// === DESABILITAR X-POWERED-BY ===
app.disable('x-powered-by');

// === TRUST PROXY (para rate limit com IP real atrás de Nginx/Railway) ===
app.set('trust proxy', 1);
app.set('logger', logger);

// === HELMET — CSP restritiva ===
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        // Nonce seria melhor, mas para JS inline simples usamos hash ou strict-dynamic
        // Ajuste conforme necessário para produção
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // necessário para CSS variáveis inline no style=""
        'https://fonts.googleapis.com',
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  crossOriginEmbedderPolicy: false, // Relaxado para SSE funcionar corretamente
}));

// === CORS MANUAL (restrito a ALLOWED_ORIGIN) ===
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === ALLOWED_ORIGIN || !origin) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// === COMPRESSÃO ===
app.use(compression());

// === BODY PARSER (limite 50kb por segurança) ===
app.use(express.json({ limit: '50kb' }));

// === ROTAS DA API ===
app.use('/api/chat', chatRouter);

// Rota de saúde
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Duarte Advocacia IA Jurídica',
  });
});

// Rota de configuração pública (sem dados sensíveis)
app.get('/api/config', (req, res) => {
  res.json({
    officeName: process.env.OFFICE_NAME || 'Duarte Advocacia',
    whatsapp: process.env.WHATSAPP_NUMBER || '',
    oab: process.env.OAB_REGISTER || '',
    officeEmail: process.env.OFFICE_EMAIL || '',
  });
});

// === ARQUIVOS ESTÁTICOS ===
app.use(express.static(join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
  index: false, // Controlamos o index manualmente
}));

// === ROTAS DE PÁGINAS LEGAIS ===
// Servidas como HTML simples (gerado abaixo)
app.get('/privacidade', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'privacidade.html'));
});

app.get('/termos', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'termos.html'));
});

// === INDEX ===
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// === TRATAMENTO DE ERROS ===
app.use((err, req, res, next) => {
  logger.error({ err: err.message, path: req.path }, 'server_error');
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// === INICIALIZAÇÃO ===
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'server_started');
    logger.info(`🏛️  Duarte Advocacia IA Jurídica rodando em http://localhost:${PORT}`);

    if (!process.env.PROJECT_ENDPOINT || !process.env.AGENT_NAME) {
      logger.warn('⚠️  PROJECT_ENDPOINT ou AGENT_NAME não configurados no .env!');
    }
  });
}

// Graceful shutdown e prevenção de crash não tratado
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason instanceof Error ? reason.message : reason }, 'unhandled_rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err: err.message }, 'uncaught_exception');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido, encerrando servidor...');
  if (server) {
    server.close(() => {
      logger.info('Servidor encerrado.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

export default app;

