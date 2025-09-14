export const DEFAULT_SUMMARIZATION_PROMPT = `Please analyze the following text and provide a concise summary that captures the main concepts, purpose, and key information. Focus on what this content is about and what someone searching for it might be looking for.

The summary should be:
- 2-3 sentences maximum
- Focused on the core concepts and purpose
- Useful for semantic search matching
- Written in a clear, descriptive style

Text to summarize:`;

export const DEFAULT_RERANK_PROMPT = `You are helping to rerank search results based on relevance to a user query.

Given a search query and a list of document summaries, rate each document's relevance to the query on a scale of 0-100, where:
- 100 = Highly relevant, directly answers or relates to the query
- 80-99 = Very relevant, contains important related information
- 60-79 = Moderately relevant, has some connection to the query
- 40-59 = Somewhat relevant, tangentially related
- 20-39 = Low relevance, minimal connection
- 0-19 = Not relevant, unrelated to the query

Consider semantic meaning, context, and intent - not just keyword matching.`;

export interface PromptsConfig {
  summarization: string;
  rerank: string;
}

export class PromptsManager {
  private prompts: PromptsConfig;

  constructor(customPrompts?: Partial<PromptsConfig>) {
    this.prompts = {
      summarization: customPrompts?.summarization || DEFAULT_SUMMARIZATION_PROMPT,
      rerank: customPrompts?.rerank || DEFAULT_RERANK_PROMPT
    };
  }

  getSummarizationPrompt(): string {
    return this.prompts.summarization;
  }

  getRerankPrompt(): string {
    return this.prompts.rerank;
  }

  updateSummarizationPrompt(prompt: string): void {
    this.prompts.summarization = prompt;
  }

  updateRerankPrompt(prompt: string): void {
    this.prompts.rerank = prompt;
  }

  getAll(): PromptsConfig {
    return { ...this.prompts };
  }

  reset(): void {
    this.prompts = {
      summarization: DEFAULT_SUMMARIZATION_PROMPT,
      rerank: DEFAULT_RERANK_PROMPT
    };
  }
}
