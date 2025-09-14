import { AzureClients } from './azure';
import { readTextFile, normalize } from './utils';

export interface TokenUsage {
  prompt: number;    // Input tokens (for backward compatibility)
  completion: number; // Output tokens (for backward compatibility)
  total: number;
}

// Type aliases for better readability
export type InputTokens = number;
export type OutputTokens = number;

export interface SummarizeResult {
  summary: string;
  partial: boolean;
  tokens: TokenUsage;
}

export interface EmbedResult {
  embedding: number[];
  tokens: TokenUsage;
}

// Type for Azure OpenAI chat message
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Utility function for consistent Azure OpenAI error handling
function handleAzureOpenAIError(error: any, modelType: string, deploymentName: string): never {
  console.error(`Error calling Azure OpenAI ${modelType} model '${deploymentName}':`, error.message);
  throw error;
}

export async function summarizeFile(azure: AzureClients, filePath: string, maxChars: number, onProgress?: (msg: string) => void): Promise<SummarizeResult>
{
  const { text, truncated } = readTextFile(filePath, maxChars);
  const prompt = `Summarize this text (truncated if too long) into 2–3 sentences describing its main topics, entities, and keywords. Be concise and factual.\n\nTEXT BEGIN\n${text}\nTEXT END`;
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are a helpful assistant that writes concise, factual summaries. Temperature 0.' },
    { role: 'user', content: prompt }
  ];
  
  try {
    onProgress?.('Generating summary...');
    const response = await azure.client.chat.completions.create({
      model: azure.rerankDeployment,
      temperature: 0,
      messages: messages,
    });
    
    const summary = response.choices?.[0]?.message?.content?.toString().trim() || '';
    const tokens: TokenUsage = {
      prompt: response.usage?.prompt_tokens || 0,
      completion: response.usage?.completion_tokens || 0,
      total: response.usage?.total_tokens || 0
    };
    
    return { 
      summary, 
      partial: truncated,
      tokens
    };
  } catch (error: any) {
    handleAzureOpenAIError(error, 'chat', azure.rerankDeployment);
  }
}

export async function embedText(azure: AzureClients, text: string, onProgress?: (msg: string) => void): Promise<EmbedResult> {
  try {
    onProgress?.('Computing embeddings...');
    const response = await azure.client.embeddings.create({
      model: azure.embeddingDeployment,
      input: text,
    });
    
    const vec = response.data[0]?.embedding as number[];
    const tokens: TokenUsage = {
      prompt: response.usage?.prompt_tokens || 0,
      completion: 0, // embeddings don't have completion tokens
      total: response.usage?.total_tokens || 0
    };
    
    return {
      embedding: normalize(vec),
      tokens
    };
  } catch (error: any) {
    handleAzureOpenAIError(error, 'embedding', azure.embeddingDeployment);
  }
}

export async function rerank(azure: AzureClients, query: string, candidates: Array<{ id: string; summary: string }>, topK: number): Promise<Array<{ id: string; score: number }>> {
  // Simple LLM reranker: ask model to assign a 0-100 relevance score for each candidate
  const list = candidates.map((c, i) => `ID: ${c.id}\nSUMMARY: ${c.summary}`).join('\n\n');
  const prompt = `Query: ${query}\n\nYou are a reranker. For each item, output a JSON array of {id, score} with score 0-100 for relevance to the query. Only output JSON.\n\nITEMS:\n${list}`;
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are a precise reranker. Only output strict JSON.' },
    { role: 'user', content: prompt }
  ];
  const response = await azure.client.chat.completions.create({
    model: azure.rerankDeployment,
    temperature: 0,
    messages: messages,
  });
  const content = response.choices?.[0]?.message?.content?.toString() || '[]';
  try {
    const parsed = JSON.parse(content) as Array<{ id: string; score: number }>;
    parsed.sort((a, b) => b.score - a.score);
    return parsed.slice(0, topK);
  } catch {
    // fallback: uniform scores
    return candidates.slice(0, topK).map((c, i) => ({ id: c.id, score: candidates.length - i }));
  }
}
