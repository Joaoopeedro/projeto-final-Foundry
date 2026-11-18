FROM node:20-alpine

WORKDIR /app

# Instala dependências de produção
COPY package*.json ./
RUN npm ci --omit=dev

# Copia código da aplicação
COPY . .

# Variáveis padrão
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Executa com usuário não-root por segurança
USER node

CMD ["node", "server.js"]

