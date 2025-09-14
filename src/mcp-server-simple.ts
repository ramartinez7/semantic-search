#!/usr/bin/env node

/**
 * Simple MCP Server wrapper that starts the MCP server process
 * This avoids complex module resolution issues by delegating to a separate script
 */

import { spawn } from 'child_process';
import { SemanticStore } from './store';
import { ConfigManager } from './config-manager';

/**
 * Start a simple JSON-RPC server over stdio for MCP
 */
async function startMcpServer() {
  console.log('🔌 Starting Semantic Search MCP Server...');
  
  // Initialize the semantic store
  const configManager = new ConfigManager();
  const config = configManager.load();
  const envVars = configManager.loadEnv();
  
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT || envVars.AZURE_OPENAI_ENDPOINT || config?.endpoints.azure;
  const apiKey = process.env.AZURE_OPENAI_API_KEY || envVars.AZURE_OPENAI_API_KEY;
  const embeddingDeployment = process.env.AZURE_OPENAI_EMBED_DEPLOYMENT || envVars.AZURE_OPENAI_EMBED_DEPLOYMENT || config?.deployments.embedding || 'text-embedding-ada-002';
  const rerankDeployment = process.env.AZURE_OPENAI_RERANK_DEPLOYMENT || envVars.AZURE_OPENAI_RERANK_DEPLOYMENT || config?.deployments.rerank || 'gpt-4.1-mini';
  const defaultDb = process.env.SEMSEARCH_DEFAULT_DB || envVars.SEMSEARCH_DEFAULT_DB || config?.storage.defaultDatabase || configManager.getDefaultDatabasePath();

  if (!endpoint) {
    throw new Error('Azure OpenAI endpoint not configured. Run "semsearch init" first.');
  }

  const store = new SemanticStore({
    azure: {
      endpoint,
      embeddingDeployment,
      rerankDeployment,
    },
    apiKey,
    sqlite: { path: defaultDb },
    summarizer: { maxChars: 1000 },
  });

  console.log('✅ Semantic Store initialized');
  console.log('📊 Server Info:');
  console.log(`   - Endpoint: ${endpoint}`);
  console.log(`   - Database: ${defaultDb}`);
  console.log(`   - Auth: ${apiKey ? 'API Key' : 'Azure AD'}`);
  
  // Simple JSON-RPC server over stdio
  let requestId = 0;
  
  const sendResponse = (id: number | string | null, result?: any, error?: any) => {
    const response = {
      jsonrpc: '2.0',
      id,
      ...(error ? { error } : { result })
    };
    console.log(JSON.stringify(response));
  };

  const sendNotification = (method: string, params?: any) => {
    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };
    console.log(JSON.stringify(notification));
  };

  // Handle incoming JSON-RPC requests
  const handleRequest = async (request: any) => {
    try {
      const { id, method, params } = request;

      switch (method) {
        case 'initialize':
          sendResponse(id, {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {}
            },
            serverInfo: {
              name: 'semantic-search-mcp',
              version: '0.3.2'
            }
          });
          break;

        case 'tools/list':
          sendResponse(id, {
            tools: [
              {
                name: 'search',
                description: 'Perform semantic search across indexed documents',
                inputSchema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string', description: 'The search query' },
                    topK: { type: 'number', description: 'Max results', default: 5 },
                    minScore: { type: 'number', description: 'Min final score (0-100)', default: 0 }
                  },
                  required: ['query']
                }
              },
              {
                name: 'get_stats',
                description: 'Get database statistics',
                inputSchema: { type: 'object', properties: {} }
              }
            ]
          });
          break;

        case 'tools/call':
          const { name, arguments: args } = params;
          
          if (name === 'search') {
            const { query, topK = 5, minScore = 0 } = args;
            const results = await store.search(query, { topK, minSimilarity: 0.1, minScore });
            
            const formattedResults = results.map((result, index) => 
              `${index + 1}. ${result.score.toFixed(1)} - ${result.metadata.filename}\n` +
              `   Path: ${result.metadata.path}\n` +
              `   Summary: ${result.summary.substring(0, 150)}...\n`
            ).join('\n');

            sendResponse(id, {
              content: [
                {
                  type: 'text',
                  text: `Found ${results.length} results:\n\n${formattedResults}`
                }
              ]
            });
          } else if (name === 'get_stats') {
            const stats = await store.getStats();
            sendResponse(id, {
              content: [
                {
                  type: 'text',
                  text: `Database Statistics:\n` +
                    `- Documents: ${stats.totalDocuments}\n` +
                    `- Vector Coverage: ${stats.vectorIndexCoverage}%\n` +
                    `- Size: ${stats.databaseSize}\n` +
                    `- Endpoint: ${stats.azureConfig.endpoint}`
                }
              ]
            });
          } else {
            sendResponse(id, null, { code: -32601, message: `Unknown tool: ${name}` });
          }
          break;

        case 'resources/list':
          sendResponse(id, { resources: [] });
          break;

        default:
          sendResponse(id, null, { code: -32601, message: `Unknown method: ${method}` });
      }
    } catch (error) {
      console.error('Error handling request:', error);
      sendResponse(request.id, null, { 
        code: -32603, 
        message: 'Internal error', 
        data: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  };

  // Process stdin line by line
  process.stdin.setEncoding('utf8');
  let buffer = '';
  
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        try {
          const request = JSON.parse(trimmed);
          handleRequest(request);
        } catch (error) {
          console.error('Invalid JSON:', trimmed);
        }
      }
    }
  });

  // Send ready notification
  sendNotification('ready');
  
  // Keep process alive
  process.stdin.resume();
}

// Export for CLI usage
export default startMcpServer;

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('🛑 MCP Server shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('🛑 MCP Server terminated');
  process.exit(0);
});

// Check if this module is being run directly
if (process.argv[1].includes('mcp-server')) {
  startMcpServer().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}
