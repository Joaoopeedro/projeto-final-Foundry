# Duarte Advocacia — IA Jurídica 🏛️⚖️

Sistema web completo de apoio jurídico com inteligência artificial para clientes do escritório de advocacia **Duarte Advocacia**. 

O sistema permite que clientes tirem dúvidas jurídicas, entendam seus direitos, identifiquem prazos e documentos necessários, com triagem automatizada e encaminhamento direto ao WhatsApp do advogado responsável.

---

## 📋 Sumário
- [Recursos Principais](#-recursos-principais)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Instalação e Execução Local](#-instalação-e-execução-local)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Testes Automatizados](#-testes-automatizados)
- [Deploy em Produção](#-deploy-em-produção)
- [Segurança e Conformidade (LGPD e OAB)](#-segurança-e-conformidade-lgpd-e-oab)

---

## 🚀 Recursos Principais

1. **Atendimento Informativo via Agente Microsoft Foundry:**
   - Respostas geradas pelo agente do Microsoft Foundry utilizando `@azure/ai-projects` e `@azure/identity` (`DefaultAzureCredential`).
   - Gestão de conversas com `conversations.create` e `responses.create` via `agent_reference`, reaproveitando o `conversationId`.
   - Renderização segura de Markdown (negrito, itálico, tabelas, listas) com proteção estrita contra XSS.

2. **Conformidade Ética e LGPD:**
   - **Consentimento prévio obrigatório** via checkbox antes de iniciar a conversa.
   - **Zero persistência no servidor:** nenhuma mensagem ou dado sensível é gravado em banco de dados ou logs (apenas metadados técnicos).
   - O agente **não é advogado**, não promete resultados e recusa qualquer pedido que envolva fraude ou atos ilícitos.
   - Enquadrado no **Provimento CFE-OAB 205/2021** (publicidade informativa).

3. **Detector de Urgência e Crise Pessoal:**
   - **Urgência jurídica:** Detecta palavras como prisão, citação, intimação, mandado, bloqueio, liminar. Exibe faixa vermelha em destaque com botão direto para WhatsApp de plantão.
   - **Crise pessoal / Violência:** Detecta situações de emergência e exibe de imediato os números de acolhimento: **CVV 188**, **Polícia 190**, **Ligue 180** e **SAMU 192**.

4. **12 Áreas de Atuação Especializadas:**
   - Consumidor, Trabalhista, Família e Sucessões, Cível e Contratos, Previdenciário (INSS), Penal, Tributário, Imobiliário, Empresarial, Digital e LGPD, Saúde e Bancário.
   - Cada área possui perguntas de triagem e orientações normativas personalizadas em `/prompts/areas/*.md`.

5. **Ferramentas Integradas:**
   - **Calculadora de Prazos Processuais:** Calcula dias úteis (CPC, com suspensão de 20/12 a 20/01), trabalhistas (CLT) e dias corridos com feriados fixos nacionais.
   - **Checklist de Documentos:** Acordeão interativo com documentos essenciais para cada área.
   - **FAQ Jurídico:** 10 perguntas e respostas sobre direitos, honorários e funcionamento da IA.
   - **Exportação da conversa:** Botão para baixar conversa em `.txt` ou encaminhar resumo ao WhatsApp.

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** Node.js 20+, Express.js (ES Modules).
- **Segurança:** Helmet (Content Security Policy restritiva), express-rate-limit, Zod (validação de schemas).
- **IA:** Integração nativa com o agente do Microsoft Foundry via `@azure/ai-projects` e `@azure/identity`.
- **Logs:** Pino (sem logar mensagens dos usuários).
- **Frontend:** HTML5 semântico, CSS3 (variáveis, design preto e roxo, responsivo de 360px a 1920px), JavaScript Vanilla ES Modules.
- **Tipografia:** Google Fonts (*Fraunces* para títulos elegantes, *Inter* para leitura confortável).

---

## 📂 Estrutura do Projeto

```text
├── server.js               # Ponto de entrada do servidor Express
├── routes/
│   └── chat.js             # Rota POST /api/chat (validação Zod, rate limit, SSE)
├── lib/
│   ├── foundry.js          # Cliente do agente Microsoft Foundry (@azure/ai-projects)
│   └── safety.js           # Detectores de urgência, crise e sanitização
├── prompts/
│   ├── system.md           # Prompt de sistema mestre (modo cliente)
│   ├── system_cliente.md   # Prompt de sistema cliente
│   ├── system_equipe.md    # Prompt para modo equipe/advogados (opcional)
│   └── areas/              # Módulos específicos das 12 áreas do Direito
├── public/
│   ├── index.html          # Landing page e interface de chat
│   ├── styles.css          # Estilos com paleta preta (#07060B) e roxa (#7C3AED)
│   ├── app.js              # Lógica do chat, calculadora de prazos e interações
│   ├── privacidade.html    # Política de Privacidade (LGPD)
│   ├── termos.html         # Termos de Uso e Provimento OAB 205/2021
│   └── assets/             # Favicon SVG e ícones
├── knowledge/              # Base de conhecimento e documentação de apoio
├── tests/                  # Testes automatizados (node:test)
├── Dockerfile              # Imagem para containerização em produção
├── docker-compose.yml      # Orquestração do container
└── .env.example            # Modelo de configuração
```

---

## ⚙️ Instalação e Execução Local

### Pré-requisitos
- Node.js versão 20 ou superior instalado.
- Endpoint do projeto e nome do agente no Microsoft Foundry.
- Autenticação configurada via Azure CLI (`az login`), variáveis de ambiente ou Managed Identity.

### Passo a Passo

1. **Clone ou navegue até o diretório do projeto:**
   ```bash
   cd c:\Users\fic\Documents\teste
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure o arquivo de ambiente `.env`:**
   Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
   Abra o arquivo `.env` e configure o endpoint e nome do agente:
   ```env
   PROJECT_ENDPOINT=https://your-foundry-resource.services.ai.azure.com/api/projects/your-project
   AGENT_NAME=seu-agente-name
   PORT=3000
   ALLOWED_ORIGIN=http://localhost:3000
   WHATSAPP_NUMBER=5511999999999
   OFFICE_NAME=Duarte Advocacia
   OFFICE_EMAIL=contato@duarteadvocacia.com.br
   OAB_REGISTER=OAB/SP 000000
   ```

4. **Inicie o servidor:**
   ```bash
   npm start
   ```
   Ou em modo desenvolvimento com auto-reload:
   ```bash
   npm run dev
   ```

5. **Acesse no navegador:**
   Abra [http://localhost:3000](http://localhost:3000).

---

## 🧪 Testes Automatizados

O projeto inclui suíte completa de testes usando o executor nativo do Node.js (`node:test`):

```bash
npm test
```

Os testes cobrem:
- Validação de payload com Zod (`tests/validation.test.js`).
- Detecção de palavras de urgência jurídica e crises pessoais (`tests/safety.test.js`).
- Algoritmo da calculadora de prazos em dias úteis, fins de semana e suspensão CPC (`tests/prazos.test.js`).
- Renderização de Markdown seguro e prevenção de ataques XSS (`tests/markdown.test.js`).

---

## 🚢 Deploy em Produção

### Opção 1: Docker / Docker Compose
```bash
docker compose up -d --build
```

### Opção 2: Plataformas PaaS (Render, Railway, Fly.io)
- Defina o Build Command: `npm install`
- Defina o Start Command: `npm start`
- Adicione as variáveis de ambiente (`PROJECT_ENDPOINT`, `AGENT_NAME`, `PORT`, `ALLOWED_ORIGIN`, `WHATSAPP_NUMBER`, etc.) no painel da plataforma.

---

## 🛡️ Segurança e LGPD

- **Sem dados armazenados:** A plataforma atua puramente como proxy seguro para o modelo de linguagem.
- **CSP Estrita:** Cabeçalhos Helmet impedem carregamento de scripts externos maliciosos.
- **Proteção contra Prompt Injection:** As regras de conduta e segurança do sistema são protegidas e o agente é expressamente instruído a não alterar seu comportamento por instruções inseridas pelo usuário.

