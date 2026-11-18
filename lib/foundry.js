// lib/foundry.js
// Integração com o agente do Microsoft Foundry via Azure AI Projects

import { AIProjectClient } from '@azure/ai-projects';
import { DefaultAzureCredential } from '@azure/identity';

let openAIClientInstance = null;

/**
 * Obtém ou inicializa o cliente OpenAI conectado ao Microsoft Foundry.
 * @returns {object}
 */
function getOpenAIClient() {
  if (!openAIClientInstance) {
    const endpoint = process.env.PROJECT_ENDPOINT;
    if (!endpoint) {
      throw new Error('PROJECT_ENDPOINT não configurado nas variáveis de ambiente.');
    }

    const credential = process.env.AZURE_BEARER_TOKEN
      ? { getToken: async () => ({ token: process.env.AZURE_BEARER_TOKEN, expiresOnTimestamp: Date.now() + 3600000 }) }
      : new DefaultAzureCredential();

    const projectClient = new AIProjectClient(endpoint, credential);
    openAIClientInstance = projectClient.getOpenAIClient();
  }

  return openAIClientInstance;
}

/**
 * Envia uma mensagem para o agente no Microsoft Foundry.
 * Cria a conversa se não houver conversationId ou reaproveita a existente.
 *
 * @param {object} params
 * @param {string} params.message - Mensagem do usuário
 * @param {string|null} [params.conversationId] - Identificador da conversa (conv_...)
 * @returns {Promise<{ reply: string, conversationId: string }>}
 */
export async function sendFoundryMessage({ message, conversationId }) {
  const agentName = process.env.AGENT_NAME;
  if (!agentName) {
    throw new Error('AGENT_NAME não configurado nas variáveis de ambiente.');
  }

  const client = getOpenAIClient();
  let currentConversationId = conversationId;

  // Cria a conversa apenas uma vez quando não houver conversationId
  if (!currentConversationId) {
    const conversation = await client.conversations.create();
    currentConversationId = conversation.id;
  }

  // Gera a resposta utilizando agent_reference
  const response = await client.responses.create({
    conversation: currentConversationId,
    input: message,
    agent_reference: {
      name: agentName,
      type: 'agent_reference',
    },
  });

  // Extrai o texto da resposta do agente
  let reply = '';
  if (typeof response?.output_text === 'string' && response.output_text.length > 0) {
    reply = response.output_text;
  } else if (Array.isArray(response?.output)) {
    reply = response.output
      .filter((item) => item.type === 'message')
      .flatMap((msg) => msg.content || [])
      .filter((c) => c.type === 'output_text')
      .map((c) => c.text)
      .join('\n');
  }

  return {
    reply,
    conversationId: currentConversationId,
  };
}

