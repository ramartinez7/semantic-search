# 🔍 Semantic Search Library

A standalone semantic search library with Azure OpenAI integration, featuring intelligent indexing, vector similarity search, and AI-powered reranking.

## ✨ Features

- **🎯 Setup Wizard**: Interactive guided setup with beautiful CLI interface
- **🧠 Azure OpenAI Integration**: Text embeddings + GPT-4 reranking
- **💾 SQLite Storage**: Persistent vector database with efficient retrieval
- **📁 Smart Indexing**: Automatic file discovery, summarization, and embedding
- **🔍 Semantic Search**: Intent-aware search beyond keyword matching
- **🎨 Beautiful CLI**: Colorful, intuitive command-line interface
- **🔐 Flexible Auth**: API key or Azure AD authentication

## 🚀 Quick Start

### 1. Initialize (First Time Setup)
```bash
npx semsearch init
```
The setup wizard will guide you through:
- Azure OpenAI endpoint configuration  
- Authentication method (API key vs Azure AD)
- Model deployment selection
- Database location setup
- Connection testing

### 2. Index Your Documents
```bash
npx semsearch index ./my-documents
```

### 3. Search Your Content
```bash
npx semsearch search "machine learning algorithms"
```

## 📋 Commands

| Command | Description |
|---------|-------------|
| `init` | Run setup wizard (first time) |
| `status` | Show configuration and database status |
| `index <path>` | Index files for search |
| `search <query>` | Search indexed content (supports `--topK`, `--min-similarity`, `--min-score`) |
| `info <id>` | Get detailed file information |
| `test-connection` | Test Azure OpenAI connectivity |
  search "configure X" --topK 5 --db ./index.db
```
## 🔧 Configuration

The setup wizard creates two configuration files:

### `.env` (Environment Variables)
```bash
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your_api_key_here
AZURE_OPENAI_EMBED_DEPLOYMENT=text-embedding-ada-002
AZURE_OPENAI_RERANK_DEPLOYMENT=gpt-4.1-mini
SEMSEARCH_DEFAULT_DB=./.data/index.db
```

### `.semsearch.json` (Configuration Metadata)
```json
{
  "version": "0.2.0",
  "setupDate": "2025-09-14T08:24:01.945Z",
  "authentication": "api-key",
  "endpoints": {
    "azure": "https://your-resource.openai.azure.com/"
  },
  "deployments": {
    "embedding": "text-embedding-ada-002",
    "rerank": "gpt-4.1-mini"
  },
  "storage": {
    "defaultDatabase": "./.data/index.db"
  }
}
```

## 🎨 CLI Examples

### Status Check
```bash
$ npx semsearch status
📊 Semantic Search Status

Configuration:
  Endpoint: https://your-resource.openai.azure.com/
  Auth: API Key
  Embedding: text-embedding-ada-002
  Rerank: gpt-4.1-mini

Database:
  Path: ./.data/index.db
  Size: 60.0 KB
  Modified: 2025-09-14T08:25:13.398Z
  Documents: 5

Config Files:
  .env: ✓
  .semsearch.json: ✓
```

### Search Results
```bash
$ npx semsearch search "database design"
🔍 Searching for: database design

Found 5 results:

1. 100.0 database-design.md (eded72e8...)
   The text outlines fundamental database design principles, including 
   normalization, data integrity, performance optimization, and security...

2. 15.0 semantic-search.md (a9408b5e...)
   The text discusses semantic search technology, which leverages natural
   language processing and machine learning...

# Search with minimum similarity threshold
$ npx semsearch search "machine learning" --min-similarity 0.7
🔍 Searching for: machine learning
   Minimum cosine similarity: 0.70

Found 2 results:

# Search with minimum final score threshold  
$ npx semsearch search "database" --min-score 80
🔍 Searching for: database
   Minimum final score: 80

Found 1 result:
```

## 🏗️ Architecture

- **Azure OpenAI**: Text embeddings (`text-embedding-ada-002`) + reranking (`gpt-4.1-mini`)
- **SQLite Database**: Vector storage with BLOB support and WAL mode
- **TypeScript**: Fully typed with strict compilation
- **CLI Framework**: Commander.js with inquirer, chalk, ora, boxen for UX

## 🔐 Authentication Options

### API Key (Recommended for Development)
- Simple setup through init wizard
- Stored securely in `.env` file
- Immediate access without additional configuration

### Azure AD (Recommended for Production)
- Uses DefaultAzureCredential
- Supports managed identities
- Enhanced security for enterprise environments

## 📊 Performance

- **Embedding Model**: text-embedding-ada-002 (1536 dimensions)
- **Search Strategy**: Vector similarity + AI reranking
- **Storage**: SQLite with optimized BLOB storage
- **Retrieval**: Brute-force vector search with top-K filtering

## 💻 Library Usage

```typescript
import { SemanticStore } from 'semantic-search';
import { DefaultAzureCredential } from '@azure/identity';

const store = new SemanticStore({
  azure: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'https://your-resource.openai.azure.com/',
    embeddingDeployment: process.env.AZURE_OPENAI_EMBED_DEPLOYMENT || 'text-embedding-ada-002',
    rerankDeployment: process.env.AZURE_OPENAI_RERANK_DEPLOYMENT || 'gpt-4.1-mini'
  },
  credential: new DefaultAzureCredential(),
  sqlite: { path: './.data/index.db' },
  summarizer: { maxChars: 50000 }
});

await store.indexPath('./docs');
const results = await store.search('How to configure X?', { topK: 10 });
```

## 🛠️ Development

### Build from Source
```bash
npm install
npm run build
```

### Project Structure
```
src/
├── cli.ts           # Command-line interface
├── init-wizard.ts   # Setup wizard with beautiful UX
├── store.ts         # Main SemanticStore class
├── azure.ts         # Azure OpenAI client management
├── sqlite.ts        # SQLite vector database
├── nlp.ts           # NLP operations (embed, summarize, rerank)
├── types.ts         # TypeScript type definitions
└── utils.ts         # Utility functions
```

## 📝 Notes

- Embeddings are normalized Float32 arrays stored as SQLite BLOBs
- Uses brute-force cosine similarity for vector search
- Summaries are regenerated when file content changes
- WAL mode enabled for better SQLite performance
- Supports text files with automatic MIME type detection

## 📝 License

MIT
