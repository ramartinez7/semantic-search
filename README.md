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
- **🤖 MCP Server**: Model Context Protocol integration for AI assistants
- **⚡ Performance Optimized**: sqlite-vec integration for fast vector search
- **🛠️ Customizable**: Configurable prompts, thresholds, and processing options
- **📊 Comprehensive**: Detailed status reporting and database statistics

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
| `search <query>` | Search indexed content |
| `info <id>` | Get detailed file information |
| `reset` | Reset configuration and/or database |
| `prompts` | Manage AI prompts for summarization and reranking |
| `test-connection` | Test Azure OpenAI connectivity |
| `mcp` | Start MCP server for AI assistant integration |

### Command Options

#### Global Options
- `--endpoint <url>` - Azure OpenAI endpoint URL
- `--api-key <key>` - Azure OpenAI API key (if not using managed identity) 
- `--embedding-model <model>` - Azure OpenAI embedding deployment name (default: text-embedding-ada-002)
- `--llm-model <model>` - Azure OpenAI LLM deployment name for reranking (default: gpt-4.1-mini)
- `-v, --verbose` - Show detailed progress information

#### `status [options]`
- `--db <path>` - SQLite database path

#### `reset [options]` 
- `--force` - Skip confirmation prompt
- `--db-only` - Reset only the database, keep configuration

#### `index <path> [options]`
- `--db <path>` - SQLite database path
- `--maxChars <n>` - Max characters to read per file (default: 50000)
- `--force` - Reprocess all files even if already indexed
- `-c, --concurrency <n>` - Number of files to process in parallel (default: 3)

#### `search <query> [options]`
- `--db <path>` - SQLite database path
- `--topK <n>` - Maximum number of results to return (default: 5)
- `--min-similarity <n>` - Minimum cosine similarity threshold 0.0-1.0, filters vector matches (default: 0.1)
- `--min-score <n>` - Minimum final score threshold 0-100, filters reranked results (default: 0)

#### `info <id> [options]`
- `--db <path>` - SQLite database path

#### `prompts [options]`
- `--edit` - Edit prompts interactively
- `--reset` - Reset prompts to defaults

#### `test-connection [options]`
- `--endpoint <url>` - Azure OpenAI endpoint URL
- `--api-key <key>` - Azure OpenAI API key

### Example Usage
```bash
# Basic commands
npx semsearch init                              # Interactive setup
npx semsearch index ./documents                 # Index documents
npx semsearch search "machine learning"         # Basic search

# Advanced indexing options
npx semsearch index ./docs --maxChars 100000 --concurrency 5 --force

# Advanced search with filtering
npx semsearch search "database design" --topK 10 --min-similarity 0.7 --min-score 80

# Use custom database location
npx semsearch search "query" --db ./custom/index.db

# Reset database only (keep configuration)
npx semsearch reset --db-only --force

# Edit AI prompts
npx semsearch prompts --edit

# Test connection with specific credentials
npx semsearch test-connection --endpoint https://your-endpoint.com --api-key your-key
```

## 🤖 MCP Server Integration

The MCP (Model Context Protocol) server allows AI assistants to access your semantic search functionality directly.

### Start MCP Server
```bash
npx semsearch mcp
# OR use the direct binary
npx semsearch-mcp
```

This starts a JSON-RPC server using stdio transport that provides:

#### 🛠️ Tools
- **`search`**: Perform semantic search across indexed documents
  - Parameters: `query` (string), `topK` (number, default: 5), `minScore` (number, default: 0)
- **`get_stats`**: Get database statistics (document count, size, etc.)

#### 📚 Resources  
- **`file://<id>`**: Access individual indexed documents by their UUID
- Dynamic resource list based on your indexed content

#### AI Assistant Integration
Configure your AI assistant (Claude Desktop, VS Code Copilot, etc.) to connect to the MCP server:

```json
{
  "mcpServers": {
    "semsearch": {
      "command": "npx",
      "args": ["semsearch@latest", "mcp"],
      "type": "stdio"
    }
  }
}
```

**Note**: The MCP server automatically uses your configured database and settings from the default locations. No environment variables needed!

The AI assistant can then:
- Search your documents semantically
- Retrieve specific files by ID
- Get database statistics
- Access your knowledge base contextually
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
  "version": "0.3.0",
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
- **SQLite Database**: Vector storage with sqlite-vec extension and WAL mode
- **TypeScript**: Fully typed with strict compilation
- **CLI Framework**: Commander.js with inquirer, chalk, ora, boxen for UX
- **Binary Entry Points**: 
  - `semsearch` - Main CLI interface
  - `semsearch-mcp` - Direct MCP server launcher
- **MCP Integration**: JSON-RPC over stdio transport for AI assistant integration

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
- **Storage**: SQLite with sqlite-vec extension for optimized vector operations
- **Retrieval**: Sub-linear vector search with fallback to brute-force when needed
- **Optimization**: Dynamic vector table creation with dimension detection
- **Concurrency**: Configurable parallel processing for indexing operations

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
├── cli.ts                  # Command-line interface with all commands
├── init-wizard.ts          # Setup wizard with beautiful UX
├── store.ts                # Main SemanticStore class
├── azure.ts                # Azure OpenAI client management
├── sqlite.ts               # SQLite vector database with sqlite-vec
├── nlp.ts                  # NLP operations (embed, summarize, rerank)
├── mcp-server-simple.ts    # MCP server implementation (JSON-RPC over stdio)
├── config-manager.ts       # Configuration file management
├── indexing-progress.ts    # Progress tracking for indexing operations
├── prompts-manager.ts      # AI prompt management and customization
├── types.ts                # TypeScript type definitions
└── utils.ts                # Utility functions
```

## 📝 Notes

- Embeddings are normalized Float32 arrays stored as SQLite BLOBs
- Uses brute-force cosine similarity for vector search
- Summaries are regenerated when file content changes
- WAL mode enabled for better SQLite performance
- Supports text files with automatic MIME type detection

## 📝 License

MIT
