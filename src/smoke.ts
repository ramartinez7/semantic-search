import { SemanticStore } from './store';

// Mock Azure clients for testing
const mockAzureClients = {
  client: {
    chat: {
      completions: {
        create: async (opts: any) => ({
          choices: [{ message: { content: 'Mock summary: This is a test file with sample content.' } }]
        })
      }
    },
    embeddings: {
      create: async (opts: any) => ({
        data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }]
      })
    }
  },
  embeddingDeployment: 'text-embedding-3-large',
  rerankDeployment: 'gpt-4o-mini'
};

async function main() {
  console.log('Smoke test: Creating mock store...');
  
  // Mock the azure client creation
  const originalCreateClients = require('./azure').createAzureClients;
  require('./azure').createAzureClients = () => mockAzureClients;
  
  const store = new SemanticStore({
    azure: {
      endpoint: 'https://mock.openai.azure.com',
      embeddingDeployment: 'text-embedding-3-large',
      rerankDeployment: 'gpt-4o-mini',
    },
    sqlite: { path: './.data/smoke-test.db' },
    summarizer: { maxChars: 1000 },
  });
  
  console.log('✓ Store initialized successfully with mock backend');
  
  // Create a test file to index
  const fs = require('fs');
  const path = require('path');
  const testDir = './.data/test-docs';
  const testFile = path.join(testDir, 'sample.txt');
  
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(testFile, 'This is a sample document for testing semantic search functionality.');
  
  console.log('Smoke test: Indexing test file...');
  const tokenInfo = await store.indexFile(testFile);
  console.log(`✓ File indexed (tokens: ${tokenInfo.summary.total + tokenInfo.embedding.total})`);
  
  console.log('Smoke test: Searching...');
  const results = await store.search('sample document', { topK: 3 });
  console.log(`✓ Search returned ${results.length} results`);
  
  if (results.length > 0) {
    console.log(`  First result: ${results[0].metadata.filename} (score: ${results[0].score})`);
    
    console.log('Smoke test: Getting file info...');
    const info = store.info(results[0].id);
    console.log(`✓ File info retrieved: ${info?.metadata.filename}`);
  }
  
  // Cleanup
  fs.rmSync(testDir, { recursive: true, force: true });
  
  console.log('✓ Smoke test completed successfully!');
  console.log('\nNote: This used mock Azure clients. For real usage:');
  console.log('1. Set up Azure OpenAI environment variables');
  console.log('2. Install better-sqlite3 for persistent storage');
  console.log('3. Run: npx semsearch index <path> --db <db-path>');
}

main().catch((e) => {
  console.error('Smoke test failed:', e);
  process.exit(1);
});
