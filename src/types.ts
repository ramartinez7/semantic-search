export type FileMetadata = {
  id: string; // UUID
  path: string;
  filename: string;
  mimetype?: string;
  size?: number;
  createdAt?: string; // ISO
  modifiedAt?: string;
};

export type FileRecord = {
  id: string;
  metadata: FileMetadata;
  summary: string;
  embedding: number[];
};

export type AzureConfig = {
  endpoint: string;
  embeddingDeployment: string; // Azure OpenAI embeddings deployment (e.g., text-embedding-3-large)
  rerankDeployment: string; // Azure OpenAI chat model for reranking (e.g., gpt-4.1-mini)
};

export type StoreConfig = {
  azure: AzureConfig;
  credential?: any; // DefaultAzureCredential or similar
  apiKey?: string; // Azure OpenAI API key
  sqlite: { path: string };
  summarizer: { maxChars: number };
};

export type SearchResult = {
  id: string;
  score: number; // final score after reranking (0-100)
  cosineSimilarity: number; // original vector similarity (0.0-1.0)
  metadata: FileMetadata;
  summary: string;
};
