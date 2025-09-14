# SemanticSearch AI Agent Instructions

## Architecture Overview

This is a TypeScript CLI tool and library for AI-powered semantic search using Azure OpenAI embeddings + GPT reranking with local SQLite storage.

**Core Components:**
- `SemanticStore` (`src/store.ts`): Main orchestrator - indexing, search, file management
- `AzureClients` (`src/azure.ts`): Azure OpenAI client factory with dual auth (API key/AAD)
- `SqliteStore` (`src/sqlite.ts`): Vector database with Float32 BLOB storage and brute-force cosine similarity
- `InitWizard` (`src/init-wizard.ts`): Beautiful CLI setup with inquirer/chalk/boxen/ora
- CLI (`src/cli.ts`): Commander.js-based interface with config loading from `.env` + `config.json`

**Data Flow:**
1. **Index**: File → summarizeFile() → embedText() → SQLite BLOB storage
2. **Search**: Query → embedText() → vector similarity → rerank() → ranked results

## Critical Development Patterns

### Authentication Precedence
```typescript
// ALWAYS pass apiKey parameter through the chain:
// CLI options → config defaults → StoreConfig.apiKey → createAzureClients()
const finalApiKey = apiKey || envApiKey; // Fallback to managed identity if neither
```

### Configuration Loading Pattern
```typescript
// ConfigManager loads both .env and .semsearch.json
const defaults = getConfiguredDefaults(); // Combines both sources
// ALWAYS call this before creating SemanticStore instances
```

### Vector Storage Implementation
- Embeddings stored as `toFloat32Blob()` in SQLite BLOB columns
- Retrieved with `fromFloat32Blob()` for cosine similarity calculations
- Uses brute-force search (no vector index) - acceptable for typical document collections

### Error Handling Convention
```typescript
// Use handleAzureOpenAIError() for consistent Azure OpenAI error formatting
// Include deployment names and model types in error messages
```

## Essential Commands

```bash
# Development workflow
npm run build          # TypeScript compilation to dist/
npm run smoke          # Mock-based integration test
npm run test           # Real Azure OpenAI test (needs config)

# CLI testing
npx semsearch init     # Interactive setup wizard
npx semsearch status   # Config/database diagnostics
```

## Testing Strategy

- **smoke.ts**: Mocks Azure clients for CI/build validation
- **test.ts**: Real Azure OpenAI connectivity test requiring live credentials
- Use `require('./azure').createAzureClients = () => mockClients` pattern for mocking

## File Processing Conventions

- Only text-like files indexed (see `isTextLike()` in `utils.ts`)
- File change detection via `modifiedAt` comparison
- UUIDs preserve identity across re-indexing
- Summaries regenerated when content changes, embeddings follow

## Configuration Architecture

Two-file system:
- `.env`: Environment variables (API keys, endpoints)
- `.semsearch.json`: Metadata (auth method, deployment names, paths)

`ConfigManager` combines both sources into unified defaults accessed via `getConfiguredDefaults()`.

## Common Gotchas

- **Authentication Bug**: Must pass `apiKey` through `StoreConfig` → `createAzureClients()`, not just env vars
- **Concurrency**: Default 3 concurrent files during indexing (`DEFAULT_CONCURRENCY`)
- **Reranking**: Retrieves 3x candidates (`CANDIDATE_MULTIPLIER`) for LLM reranking to improve relevance
- **SQLite WAL Mode**: Enabled for better performance, creates `.db-wal` files
- **CLI Binary**: Points to `dist/cli.js`, ensure `npm run build` before testing CLI changes

## Integration Points

- **Azure OpenAI**: Dual SDK usage - `@azure/openai` + `openai` packages for different auth patterns
- **SQLite**: `better-sqlite3` with synchronous operations throughout
- **File Discovery**: `fast-glob` for directory traversal with text file filtering
- **CLI UX**: `inquirer` + `chalk` + `ora` + `boxen` for rich terminal interface
