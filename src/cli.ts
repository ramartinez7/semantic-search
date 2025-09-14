#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { DefaultAzureCredential } from '@azure/identity';
import { SemanticStore } from './store';
import { InitWizard } from './init-wizard';
import { ConfigManager } from './config-manager';
import { DEFAULT_CONFIG } from './constants';
import chalk from 'chalk';

const program = new Command();
program
  .name('semsearch')
  .description('🔍 Standalone semantic search CLI with Azure OpenAI integration')
  .version('0.3.2')
  .addHelpText('after', `
Examples:
  $ semsearch init                              # Setup wizard (first time)
  $ semsearch index ./documents                 # Index files for search
  $ semsearch search "machine learning"         # Search indexed content
  $ semsearch search "ML" --min-similarity 0.5  # Filter by vector similarity
  $ semsearch search "AI" --min-score 80        # Filter by final relevance score
  $ semsearch info <file-id>                    # Get file details
  $ semsearch test-connection                   # Test Azure OpenAI connection

Environment Variables:
  AZURE_OPENAI_ENDPOINT          Azure OpenAI endpoint URL
  AZURE_OPENAI_API_KEY           Azure OpenAI API key (optional with AAD)
  AZURE_OPENAI_EMBED_DEPLOYMENT  Embedding model deployment name
  AZURE_OPENAI_RERANK_DEPLOYMENT Chat model deployment name for reranking
  SEMSEARCH_DEFAULT_DB           Default database file location

For more help: https://github.com/your-repo/semantic-search
`);

// Global options for Azure OpenAI configuration
program
  .option('--endpoint <url>', 'Azure OpenAI endpoint URL')
  .option('--api-key <key>', 'Azure OpenAI API key (if not using managed identity)')
  .option('--embedding-model <model>', 'Azure OpenAI embedding deployment name', 'text-embedding-ada-002')
  .option('--llm-model <model>', 'Azure OpenAI LLM deployment name for reranking', 'gpt-4.1-mini')
  .option('-v, --verbose', 'Show detailed progress information');

function getConfiguredDefaults(): { endpoint: string; apiKey?: string; embeddingDeployment: string; rerankDeployment: string; defaultDb: string } {
  const configManager = new ConfigManager();
  const config = configManager.load();
  const envVars = configManager.loadEnv();
  
  return {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || envVars.AZURE_OPENAI_ENDPOINT || config?.endpoints.azure || '',
    apiKey: process.env.AZURE_OPENAI_API_KEY || envVars.AZURE_OPENAI_API_KEY,
    embeddingDeployment: process.env.AZURE_OPENAI_EMBED_DEPLOYMENT || envVars.AZURE_OPENAI_EMBED_DEPLOYMENT || config?.deployments.embedding || 'text-embedding-ada-002',
    rerankDeployment: process.env.AZURE_OPENAI_RERANK_DEPLOYMENT || envVars.AZURE_OPENAI_RERANK_DEPLOYMENT || config?.deployments.rerank || 'gpt-4.1-mini',
    defaultDb: process.env.SEMSEARCH_DEFAULT_DB || envVars.SEMSEARCH_DEFAULT_DB || config?.storage.defaultDatabase || configManager.getDefaultDatabasePath()
  };
}

function makeStore(dbPath: string, maxChars: number, cliOptions: any = {}) {
  const defaults = getConfiguredDefaults();
  const endpoint = cliOptions.endpoint || defaults.endpoint;
  const apiKey = cliOptions.apiKey || defaults.apiKey;
  const embeddingDeployment = cliOptions.embeddingModel || defaults.embeddingDeployment;
  const rerankDeployment = cliOptions.llmModel || defaults.rerankDeployment;
  
  if (!endpoint) {
    console.error('Error: Azure OpenAI endpoint is required. Set AZURE_OPENAI_ENDPOINT or use --endpoint option.');
    process.exit(1);
  }
  
  return new SemanticStore({
    azure: { endpoint, embeddingDeployment, rerankDeployment },
    credential: apiKey ? undefined : new DefaultAzureCredential(), // Use AAD if no API key
    apiKey: apiKey, // Pass the API key through
    sqlite: { path: dbPath },
    summarizer: { maxChars },
  });
}

program
  .command('status')
  .description('Show current configuration and database status')
  .option('--db <path>', 'SQLite path')
  .action(async (opts: { db?: string }) => {
    const defaults = getConfiguredDefaults();
    const configManager = new ConfigManager();
    const status = configManager.getStatus();
    
    console.log(chalk.blue.bold('📊 Semantic Search Status\n'));
    
    // Check if properly configured
    const isConfigured = defaults.endpoint && (defaults.apiKey || status.envExists || status.configExists);
    
    if (!isConfigured) {
      console.log(chalk.yellow('❌ Not configured'));
      console.log(chalk.gray('Run "semsearch init" to set up the tool.\n'));
      return;
    }
    
    const dbPath = opts.db || defaults.defaultDb;
    const fs = await import('fs');
    
    // Configuration
    console.log(chalk.yellow('Configuration:'));
    console.log(`  Endpoint: ${chalk.cyan(defaults.endpoint)}`);
    console.log(`  Auth: ${chalk.cyan(defaults.apiKey ? 'API Key' : 'Azure AD')}`);
    console.log(`  Embedding: ${chalk.cyan(defaults.embeddingDeployment)}`);
    console.log(`  Rerank: ${chalk.cyan(defaults.rerankDeployment)}`);
    
    // Configuration files
    console.log(chalk.yellow('\nConfiguration:'));
    console.log(`  Config file: ${status.configExists ? chalk.green('✓') : chalk.red('✗')} ${status.configDir}`);
    console.log(`  Environment: ${status.envExists ? chalk.green('✓') : chalk.red('✗')}`);
    
    // Database
    console.log(chalk.yellow('\nDatabase:'));
    console.log(`  Path: ${chalk.cyan(dbPath)}`);
    
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      console.log(`  Size: ${chalk.green((stats.size / 1024).toFixed(1) + ' KB')}`);
      console.log(`  Modified: ${chalk.gray(stats.mtime.toISOString())}`);
      
      try {
        // Create a store instance just to get the count without initializing Azure client
        const { SqliteStore } = await import('./sqlite');
        const db = new SqliteStore(dbPath);
        const count = db.count();
        const vectorCount = db.vectorCount();
        const hasVectorIndex = db.hasVectorIndex();
        db.close();
        console.log(`  Documents: ${chalk.green(count.toString())}`);
        
        // Vector search status
        if (hasVectorIndex) {
          const percentage = count > 0 ? Math.round((vectorCount / count) * 100) : 0;
          console.log(`  Vector Index: ${chalk.green('✓')} ${chalk.gray(`(${vectorCount}/${count} documents, ${percentage}%)`)}`);
          if (vectorCount < count) {
            console.log(`    ${chalk.yellow('Note:')} Some documents missing from vector index - run "semsearch index --force" to rebuild`);
          }
        } else {
          console.log(`  Vector Index: ${chalk.yellow('⚠')} ${chalk.gray('Not available - using brute-force search')}`);
          if (count > 0) {
            console.log(`    ${chalk.yellow('Note:')} Run "semsearch index --force" to enable fast vector search`);
          }
        }
      } catch (error: any) {
        console.log(`  Documents: ${chalk.red(`Unable to read (${error.message})`)}`);
      }
    } else {
      console.log(`  Status: ${chalk.red('Not created')} ${chalk.gray('(run "semsearch index" first)')}`);
    }
  });

program
  .command('reset')
  .description('Reset all configuration and data')
  .option('--force', 'Skip confirmation prompt')
  .option('--db-only', 'Reset only the database, keep configuration')
  .action(async (opts: { force?: boolean; dbOnly?: boolean }) => {
    const configManager = new ConfigManager();
    
    const resetType = opts.dbOnly ? 'database only' : 'ALL configuration and data';
    const warningMessage = opts.dbOnly 
      ? '⚠️  This will delete the database but keep your configuration. Are you sure?'
      : '⚠️  This will delete ALL configuration and data. Are you sure?';
    
    if (!opts.force) {
      const { confirmed } = await (await import('inquirer')).default.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: chalk.red(warningMessage),
          default: false
        }
      ]);
      
      if (!confirmed) {
        console.log(chalk.yellow('Reset cancelled.'));
        return;
      }
    }
    
    try {
      if (opts.dbOnly) {
        // Reset only database
        const { SqliteStore } = await import('./sqlite');
        const dbPath = configManager.getDefaultDatabasePath();
        if (require('fs').existsSync(dbPath)) {
          require('fs').unlinkSync(dbPath);
          console.log(chalk.green('✅ Database has been reset.'));
          console.log(chalk.gray('Your configuration is preserved. Run "semsearch index" to rebuild the database.'));
        } else {
          console.log(chalk.yellow('ℹ️  Database does not exist.'));
        }
      } else {
        // Reset everything
        configManager.reset();
        console.log(chalk.green('✅ All configuration and data has been reset.'));
        console.log(chalk.gray('Run "semsearch init" to set up again.'));
      }
    } catch (error: any) {
      console.log(chalk.red(`❌ Error during reset: ${error.message}`));
    }
  });

program
  .command('init')
  .description('Initialize semantic search with setup wizard')
  .action(async () => {
    const wizard = new InitWizard();
    await wizard.run();
  });

program
  .command('index')
  .argument('<path>')
  .option('--db <path>', 'SQLite path')
  .option('--maxChars <n>', 'Max characters to read', (v: string) => parseInt(v, 10), DEFAULT_CONFIG.MAX_CHARS_DEFAULT)
  .option('--force', 'Reprocess all files even if already indexed')
  .option('-c, --concurrency <n>', 'Number of files to process in parallel', (v: string) => parseInt(v, 10), DEFAULT_CONFIG.DEFAULT_CONCURRENCY)
  .action(async (targetPath: string, opts: { db?: string; maxChars: number; force?: boolean; concurrency: number }, command: any) => {
    const defaults = getConfiguredDefaults();
    const dbPath = opts.db || defaults.defaultDb;
    
    console.log(chalk.blue(`📚 Indexing: ${chalk.bold(targetPath)}`));
    console.log(chalk.gray(`Database: ${dbPath}\n`));
    
    const store = makeStore(dbPath, opts.maxChars, command.optsWithGlobals());
    
    // Enhanced indexing with progress visualization
    const stats = await store.indexPath(targetPath, {
      verbose: command.optsWithGlobals().verbose || false,
      concurrency: opts.concurrency,
      force: opts.force
    });
    
    // Final summary is handled by the progress manager
    console.log(chalk.green(`\n🎯 Total documents in database: ${chalk.bold(store.count())}`));
  });

program
  .command('search')
  .argument('<query>')
  .option('--db <path>', 'SQLite path')
  .option('--topK <n>', 'Top K results', (v: string) => parseInt(v, 10), DEFAULT_CONFIG.DEFAULT_TOP_K)
  .option('--min-similarity <n>', 'Minimum cosine similarity threshold (0.0-1.0, filters vector matches)', (v: string) => parseFloat(v), DEFAULT_CONFIG.DEFAULT_MIN_SIMILARITY)
  .option('--min-score <n>', 'Minimum final score threshold (0-100, filters reranked results)', (v: string) => parseFloat(v), DEFAULT_CONFIG.DEFAULT_MIN_SCORE)
  .action(async (query: string, opts: { db?: string; topK: number; minSimilarity: number; minScore: number }, command: any) => {
    const defaults = getConfiguredDefaults();
    const dbPath = opts.db || defaults.defaultDb;
    
    // Validate min-similarity range
    if (opts.minSimilarity < 0 || opts.minSimilarity > 1) {
      console.error(chalk.red('Error: --min-similarity must be between 0.0 and 1.0'));
      process.exit(1);
    }
    
    // Validate min-score range
    if (opts.minScore < 0 || opts.minScore > 100) {
      console.error(chalk.red('Error: --min-score must be between 0 and 100'));
      process.exit(1);
    }
    
    const store = makeStore(dbPath, DEFAULT_CONFIG.MAX_CHARS_DEFAULT, command.optsWithGlobals());
    console.log(chalk.blue(`🔍 Searching for: ${chalk.bold(query)}`));
    
    if (opts.minSimilarity !== DEFAULT_CONFIG.DEFAULT_MIN_SIMILARITY) {
      console.log(chalk.gray(`   Minimum cosine similarity: ${opts.minSimilarity.toFixed(2)}`));
    }
    if (opts.minScore !== DEFAULT_CONFIG.DEFAULT_MIN_SCORE) {
      console.log(chalk.gray(`   Minimum final score: ${opts.minScore.toFixed(0)}`));
    }
    console.log();
    
    const results = await store.search(query, { topK: opts.topK, minSimilarity: opts.minSimilarity, minScore: opts.minScore });
    
    if (results.length === 0) {
      const customSimilarity = opts.minSimilarity !== DEFAULT_CONFIG.DEFAULT_MIN_SIMILARITY;
      const customScore = opts.minScore !== DEFAULT_CONFIG.DEFAULT_MIN_SCORE;
      
      if (customSimilarity && customScore) {
        console.log(chalk.yellow(`No results found above similarity threshold ${opts.minSimilarity.toFixed(2)} and score threshold ${opts.minScore}.`));
        console.log(chalk.gray('Try lowering the --min-similarity or --min-score values, or use a different query.'));
      } else if (customSimilarity) {
        console.log(chalk.yellow(`No results found above similarity threshold ${opts.minSimilarity.toFixed(2)}.`));
        console.log(chalk.gray('Try lowering the --min-similarity value or use a different query.'));
      } else if (customScore) {
        console.log(chalk.yellow(`No results found above score threshold ${opts.minScore}.`));
        console.log(chalk.gray('Try lowering the --min-score value or use a different query.'));
      } else {
        console.log(chalk.yellow('No results found. Try a different query or index more documents.'));
      }
      return;
    }
    
    console.log(chalk.gray(`Found ${results.length} result${results.length === 1 ? '' : 's'}:\n`));
    
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const scoreColor = r.score >= 80 ? 'green' : r.score >= 60 ? 'yellow' : 'red';
      
      // Show both scores when either threshold is customized or in verbose mode
      const showCosineSim = opts.minSimilarity !== DEFAULT_CONFIG.DEFAULT_MIN_SIMILARITY || 
                           opts.minScore !== DEFAULT_CONFIG.DEFAULT_MIN_SCORE || 
                           command.optsWithGlobals().verbose;
      const scoreDisplay = showCosineSim 
        ? `${chalk[scoreColor](r.score.toFixed(1))} ${chalk.gray(`(cosine: ${r.cosineSimilarity.toFixed(3)})`)}`
        : chalk[scoreColor](r.score.toFixed(1));
      
      console.log(`${chalk.cyan(`${i + 1}.`)} ${scoreDisplay} ${chalk.bold.white(r.metadata.filename)} ${chalk.gray(`(${r.id.slice(0, 8)}...)`)}`);
      console.log(`   ${chalk.blue('Path:')} ${chalk.gray(r.metadata.path)}`);
      
      if (r.metadata.size) {
        const sizeKB = (r.metadata.size / 1024).toFixed(1);
        console.log(`   ${chalk.blue('Size:')} ${chalk.gray(sizeKB)} KB`);
      }
      
      console.log(`   ${chalk.blue('Summary:')} ${chalk.gray(r.summary)}\n`);
    }
  });

program
  .command('info')
  .argument('<id>')
  .option('--db <path>', 'SQLite path')
  .action((id: string, opts: { db?: string }, command: any) => {
    const defaults = getConfiguredDefaults();
    const dbPath = opts.db || defaults.defaultDb;
    
    const store = makeStore(dbPath, DEFAULT_CONFIG.MAX_CHARS_DEFAULT, command.optsWithGlobals());
    const rec = store.info(id);
    if (!rec) {
      console.error('Not found');
      process.exitCode = 1;
      return;
    }
    
    // Display formatted file information without the embedding vector
    console.log(chalk.blue.bold('📄 File Information'));
    console.log(chalk.blue('═'.repeat(50)));
    console.log(`${chalk.cyan('ID:')} ${rec.id}`);
    console.log(`${chalk.cyan('Path:')} ${rec.metadata.path}`);
    console.log(`${chalk.cyan('Filename:')} ${rec.metadata.filename}`);
    
    if (rec.metadata.size) {
      const sizeKB = (rec.metadata.size / 1024).toFixed(1);
      console.log(`${chalk.cyan('Size:')} ${sizeKB} KB`);
    }
    
    if (rec.metadata.createdAt) {
      console.log(`${chalk.cyan('Created:')} ${new Date(rec.metadata.createdAt).toLocaleString()}`);
    }
    
    if (rec.metadata.modifiedAt) {
      console.log(`${chalk.cyan('Modified:')} ${new Date(rec.metadata.modifiedAt).toLocaleString()}`);
    }
    
    console.log(`${chalk.cyan('Summary:')} ${rec.summary}`);
    
    // Show embedding info from vector table
    const vectorCount = store.vectorCount();
    const hasVector = store.hasVectorIndex();
    if (hasVector && vectorCount > 0) {
      console.log(`\n${chalk.cyan('Embedding:')} Stored in vector index (1536 dimensions)`);
    } else {
      console.log(`\n${chalk.cyan('Embedding:')} Not found in vector index`);
    }
  });

program
  .command('prompts')
  .description('View and edit AI prompts')
  .option('--edit', 'Edit prompts interactively')
  .option('--reset', 'Reset prompts to defaults')
  .action(async (opts: { edit?: boolean; reset?: boolean }) => {
    const configManager = new ConfigManager();
    const config = configManager.load();
    
    if (opts.reset) {
      if (config) {
        config.prompts = { summarization: (await import('./prompts-manager')).DEFAULT_SUMMARIZATION_PROMPT };
        configManager.save(config);
        console.log(chalk.green('✅ Prompts reset to defaults.'));
      } else {
        console.log(chalk.red('❌ No configuration found. Run "semsearch init" first.'));
      }
      return;
    }
    
    if (opts.edit) {
      if (!config) {
        console.log(chalk.red('❌ No configuration found. Run "semsearch init" first.'));
        return;
      }
      
      const inquirer = await import('inquirer');
      const { DEFAULT_SUMMARIZATION_PROMPT } = await import('./prompts-manager');
      
      const { newPrompt } = await inquirer.default.prompt([
        {
          type: 'editor',
          name: 'newPrompt',
          message: 'Edit the summarization prompt:',
          default: config.prompts?.summarization || DEFAULT_SUMMARIZATION_PROMPT
        }
      ]);
      
      config.prompts = { ...config.prompts, summarization: newPrompt };
      configManager.save(config);
      console.log(chalk.green('✅ Prompt updated successfully.'));
      return;
    }
    
    // Default: show current prompts
    console.log(chalk.blue.bold('🎯 AI Prompts\n'));
    
    if (config?.prompts?.summarization) {
      console.log(chalk.yellow('Summarization Prompt:'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(config.prompts.summarization);
      console.log(chalk.gray('─'.repeat(60)));
    } else {
      console.log(chalk.yellow('Using default prompts (no customization found)'));
      const { DEFAULT_SUMMARIZATION_PROMPT } = await import('./prompts-manager');
      console.log(chalk.yellow('\nDefault Summarization Prompt:'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(DEFAULT_SUMMARIZATION_PROMPT);
      console.log(chalk.gray('─'.repeat(60)));
    }
    
    console.log(chalk.gray('\nTip: Use "semsearch prompts --edit" to customize prompts'));
  });

program
  .command('test-connection')
  .option('--endpoint <url>', 'Azure OpenAI endpoint URL')
  .option('--api-key <key>', 'Azure OpenAI API key (if not using managed identity)')
  .option('--embedding-model <model>', 'Azure OpenAI embedding deployment name', 'text-embedding-ada-002')
  .option('--llm-model <model>', 'Azure OpenAI LLM deployment name for reranking', 'gpt-4.1-mini')
  .action(async (opts: any) => {
    const store = makeStore(DEFAULT_CONFIG.TEST_DB_PATH, DEFAULT_CONFIG.TEST_MAX_CHARS, opts);
    try {
      // Test embedding
      console.log('Testing embedding model...');
      const testEmbedding = await (store as any).azure.client.embeddings.create({
        model: (store as any).azure.embeddingDeployment,
        input: 'test'
      });
      console.log('✓ Embedding model working');
      
      // Test chat
      console.log('Testing chat model...');
      const testChat = await (store as any).azure.client.chat.completions.create({
        model: (store as any).azure.rerankDeployment,
        messages: [{ role: 'user', content: 'Say "test successful"' }],
        temperature: 0
      });
      console.log('✓ Chat model working');
      console.log('✓ All models are accessible');
    } catch (error: any) {
      console.error('✗ Connection test failed:', error.message);
      if (error.status === 404) {
        console.error('This usually means the deployment name doesn\'t exist in your Azure OpenAI resource.');
        console.error('Check your deployment names in the Azure Portal.');
      }
    }
  });

program
  .command('mcp')
  .description('Start MCP (Model Context Protocol) server for AI assistant integration')
  .option('--db <path>', 'SQLite database path')
  .action(async (opts: { db?: string }) => {
    const defaults = getConfiguredDefaults();
    const dbPath = opts.db || defaults.defaultDb;
    
    console.log(chalk.blue.bold('🔌 Starting MCP Server...\n'));
    console.log(chalk.gray(`Database: ${dbPath}`));
    console.log(chalk.gray(`Endpoint: ${defaults.endpoint}`));
    console.log(chalk.gray(`Auth: ${defaults.apiKey ? 'API Key' : 'Azure AD'}`));
    console.log(chalk.gray('Protocol: stdio (for AI assistant integration)\n'));
    
    // Set environment variables for the MCP server
    if (!process.env.AZURE_OPENAI_ENDPOINT) process.env.AZURE_OPENAI_ENDPOINT = defaults.endpoint;
    if (!process.env.AZURE_OPENAI_API_KEY && defaults.apiKey) process.env.AZURE_OPENAI_API_KEY = defaults.apiKey;
    if (!process.env.AZURE_OPENAI_EMBED_DEPLOYMENT) process.env.AZURE_OPENAI_EMBED_DEPLOYMENT = defaults.embeddingDeployment;
    if (!process.env.AZURE_OPENAI_RERANK_DEPLOYMENT) process.env.AZURE_OPENAI_RERANK_DEPLOYMENT = defaults.rerankDeployment;
    if (!process.env.SEMSEARCH_DEFAULT_DB) process.env.SEMSEARCH_DEFAULT_DB = dbPath;
    
    console.log(chalk.green('✅ MCP Server ready for AI assistant connections'));
    console.log(chalk.gray('Configure your AI assistant to connect to this server via stdio transport'));
    
    // Import and start the MCP server
    const { default: startMcpServer } = await import('./mcp-server-simple.js');
    await startMcpServer();
  });

program.parseAsync(process.argv);
