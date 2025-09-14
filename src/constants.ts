// Configuration constants for the semantic search system
export const DEFAULT_CONFIG = {
  // File processing
  MAX_CHARS_DEFAULT: 50000,
  
  // Indexing concurrency
  DEFAULT_CONCURRENCY: 3,
  
  // Search results
  DEFAULT_TOP_K: 5,
  CANDIDATE_MULTIPLIER: 3, // Retrieve 3x topK candidates for reranking
  MIN_CANDIDATES: 10,
  
  // Test database
  TEST_DB_PATH: './.data/test.db',
  TEST_MAX_CHARS: 1000,
} as const;
