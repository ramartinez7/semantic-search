import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import { ConfigManager, ConfigData } from './config-manager';
import { PromptsManager, DEFAULT_SUMMARIZATION_PROMPT } from './prompts-manager';

interface InitConfig {
  azureEndpoint: string;
  apiKey?: string;
  useAAD: boolean;
  embeddingDeployment: string;
  rerankDeployment: string;
  defaultDatabase: string;
  setupType: 'guided' | 'custom';
}

export class InitWizard {
  private config: Partial<InitConfig> = {};
  private configManager = new ConfigManager();
  private promptsManager = new PromptsManager();

  async run(): Promise<void> {
    console.clear();
    
    // Welcome banner
    this.showWelcomeBanner();
    
    // Setup type selection
    await this.selectSetupType();
    
    if (this.config.setupType === 'guided') {
      await this.runGuidedSetup();
    } else {
      await this.runCustomSetup();
    }
    
    // Save configuration
    await this.saveConfiguration();
    
    // Test connection
    await this.testConnection();
    
    // Show completion message
    this.showCompletionMessage();
  }

  private showWelcomeBanner(): void {
    const banner = boxen(
      chalk.bold.cyan('🔍 Semantic Search Library Setup\n\n') +
      chalk.white('Welcome to the semantic search setup wizard!\n') +
      chalk.gray('This will help you configure Azure OpenAI integration.'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        backgroundColor: 'black'
      }
    );
    console.log(banner);
  }

  private async selectSetupType(): Promise<void> {
    const { setupType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'setupType',
        message: chalk.bold('How would you like to set up your semantic search?'),
        choices: [
          {
            name: '🎯 Guided Setup (Recommended for beginners)',
            value: 'guided',
            short: 'Guided'
          },
          {
            name: '⚙️  Custom Setup (For advanced users)',
            value: 'custom',
            short: 'Custom'
          }
        ],
        default: 'guided'
      }
    ]);
    
    this.config.setupType = setupType;
  }

  private async runGuidedSetup(): Promise<void> {
    console.log(chalk.yellow('\n📋 Guided Setup Mode\n'));
    console.log(chalk.gray('I\'ll walk you through the essential configuration step by step.\n'));

    // Azure OpenAI endpoint
    const { azureEndpoint } = await inquirer.prompt([
      {
        type: 'input',
        name: 'azureEndpoint',
        message: 'Enter your Azure OpenAI endpoint URL:',
        validate: (input: string) => {
          if (!input) return 'Endpoint URL is required';
          if (!input.startsWith('https://')) return 'URL must start with https://';
          if (!input.includes('openai.azure.com')) return 'Must be an Azure OpenAI endpoint';
          return true;
        }
      }
    ]);
    this.config.azureEndpoint = azureEndpoint;

    // Authentication method
    const { authMethod } = await inquirer.prompt([
      {
        type: 'list',
        name: 'authMethod',
        message: 'How do you want to authenticate with Azure?',
        choices: [
          {
            name: '🔑 API Key',
            value: 'apikey',
            short: 'API Key'
          },
          {
            name: '🎫 Azure AD',
            value: 'aad',
            short: 'Azure AD'
          }
        ],
        default: 'apikey'
      }
    ]);

    if (authMethod === 'apikey') {
      const { apiKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'Enter your Azure OpenAI API key:',
          validate: (input: string) => {
            if (!input) return 'API key is required';
            if (input.length < 10) return 'API key seems too short';
            return true;
          },
          mask: '*'
        }
      ]);
      this.config.apiKey = apiKey;
      this.config.useAAD = false;
    } else {
      this.config.useAAD = true;
      console.log(chalk.blue('\n💡 Using Azure AD authentication. Make sure you\'re logged in with Azure CLI.'));
    }

    // Model deployments with common defaults
    console.log(chalk.yellow('\n🤖 Model Configuration\n'));
    
    const { embeddingDeployment } = await inquirer.prompt([
      {
        type: 'input',
        name: 'embeddingDeployment',
        message: 'Enter your text embedding deployment name:',
        default: 'text-embedding-ada-002',
        validate: (input: string) => input ? true : 'Deployment name is required'
      }
    ]);
    this.config.embeddingDeployment = embeddingDeployment;

    const { rerankDeployment } = await inquirer.prompt([
      {
        type: 'input',
        name: 'rerankDeployment',
        message: 'Enter your chat model deployment name (for reranking):',
        default: 'gpt-4.1-mini',
        validate: (input: string) => input ? true : 'Deployment name is required'
      }
    ]);
    this.config.rerankDeployment = rerankDeployment;

    // Database location
    const { defaultDatabase } = await inquirer.prompt([
      {
        type: 'input',
        name: 'defaultDatabase',
        message: 'Default database location:',
        default: this.configManager.getDefaultDatabasePath(),
        validate: (input: string) => input ? true : 'Database path is required'
      }
    ]);
    this.config.defaultDatabase = defaultDatabase;
  }

  private async runCustomSetup(): Promise<void> {
    console.log(chalk.yellow('\n⚙️ Custom Setup Mode\n'));
    console.log(chalk.gray('Configure all options manually.\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'azureEndpoint',
        message: 'Azure OpenAI endpoint URL:',
        validate: (input: string) => {
          if (!input) return 'Endpoint URL is required';
          if (!input.startsWith('https://')) return 'URL must start with https://';
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'useAAD',
        message: 'Use Azure AD authentication (instead of API key)?',
        default: false
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'Azure OpenAI API key:',
        when: (answers: any) => !answers.useAAD,
        validate: (input: string) => input ? true : 'API key is required when not using Azure AD',
        mask: '*'
      },
      {
        type: 'input',
        name: 'embeddingDeployment',
        message: 'Text embedding deployment name:',
        default: 'text-embedding-ada-002',
        validate: (input: string) => input ? true : 'Deployment name is required'
      },
      {
        type: 'input',
        name: 'rerankDeployment',
        message: 'Chat model deployment name (for reranking):',
        default: 'gpt-4.1-mini',
        validate: (input: string) => input ? true : 'Deployment name is required'
      },
      {
        type: 'input',
        name: 'defaultDatabase',
        message: 'Default database location:',
        default: this.configManager.getDefaultDatabasePath()
      }
    ]);

    Object.assign(this.config, answers);
  }

  private async saveConfiguration(): Promise<void> {
    const spinner = ora('Saving configuration...').start();
    
    try {
      // Create .env content
      const envContent = this.generateEnvContent();
      this.configManager.saveEnv(envContent);
      
      // Create config data
      const configData: ConfigData = {
        version: '0.2.0',
        setupDate: new Date().toISOString(),
        authentication: this.config.useAAD ? 'azure-ad' : 'api-key',
        endpoints: {
          azure: this.config.azureEndpoint!
        },
        deployments: {
          embedding: this.config.embeddingDeployment!,
          rerank: this.config.rerankDeployment!
        },
        storage: {
          defaultDatabase: this.config.defaultDatabase!
        },
        prompts: {
          summarization: DEFAULT_SUMMARIZATION_PROMPT
        }
      };
      
      this.configManager.save(configData);
      
      spinner.succeed('Configuration saved successfully!');
    } catch (error: any) {
      spinner.fail(`Failed to save configuration: ${error.message}`);
      throw error;
    }
  }

  private generateEnvContent(): string {
    let content = '# Semantic Search Configuration\n';
    content += '# Generated by init wizard\n\n';
    
    content += `AZURE_OPENAI_ENDPOINT=${this.config.azureEndpoint}\n`;
    
    if (this.config.apiKey && !this.config.useAAD) {
      content += `AZURE_OPENAI_API_KEY=${this.config.apiKey}\n`;
    }
    
    content += `AZURE_OPENAI_EMBED_DEPLOYMENT=${this.config.embeddingDeployment}\n`;
    content += `AZURE_OPENAI_RERANK_DEPLOYMENT=${this.config.rerankDeployment}\n`;
    content += `SEMSEARCH_DEFAULT_DB=${this.config.defaultDatabase}\n`;
    content += `SEMSEARCH_CONFIG_DIR=${this.configManager.getConfigPath()}\n`;
    
    return content;
  }

  private async testConnection(): Promise<void> {
    const { shouldTest } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldTest',
        message: 'Would you like to test the connection now?',
        default: true
      }
    ]);

    if (!shouldTest) return;

    const spinner = ora('Testing Azure OpenAI connection...').start();
    
    try {
      // Set environment variables for testing
      if (this.config.apiKey && !this.config.useAAD) {
        process.env.AZURE_OPENAI_API_KEY = this.config.apiKey;
      }
      
      // Import here to avoid circular dependencies
      const { SemanticStore } = await import('./store');
      const { DefaultAzureCredential } = await import('@azure/identity');
      
      const store = new SemanticStore({
        azure: {
          endpoint: this.config.azureEndpoint!,
          embeddingDeployment: this.config.embeddingDeployment!,
          rerankDeployment: this.config.rerankDeployment!
        },
        credential: this.config.useAAD ? new DefaultAzureCredential() : undefined,
        sqlite: { path: ':memory:' }, // Use in-memory DB for testing
        summarizer: { maxChars: 1000 }
      });

      // Test embedding
      spinner.text = 'Testing embedding model...';
      await (store as any).azure.client.embeddings.create({
        model: this.config.embeddingDeployment!,
        input: 'test'
      });

      // Test chat
      spinner.text = 'Testing chat model...';
      await (store as any).azure.client.chat.completions.create({
        model: this.config.rerankDeployment!,
        messages: [{ role: 'user', content: 'Say "test successful"' }],
        temperature: 0
      });

      spinner.succeed(chalk.green('✓ Connection test successful!'));
    } catch (error: any) {
      spinner.fail(chalk.red(`✗ Connection test failed: ${error.message}`));
      
      if (error.status === 404) {
        console.log(chalk.yellow('\n💡 Common issues:'));
        console.log(chalk.gray('• Check that your deployment names match those in Azure Portal'));
        console.log(chalk.gray('• Ensure your Azure OpenAI resource is in the correct region'));
        console.log(chalk.gray('• Verify your API key or Azure AD permissions'));
      }
      
      const { shouldContinue } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldContinue',
          message: 'Continue anyway? (You can fix the configuration later)',
          default: true
        }
      ]);
      
      if (!shouldContinue) {
        process.exit(1);
      }
    }
  }

  private showCompletionMessage(): void {
    console.log(chalk.green('\n🎉 Setup completed successfully!\n'));
    
    const status = this.configManager.getStatus();
    
    const nextSteps = boxen(
      chalk.bold.white('Next Steps:\n\n') +
      chalk.white('1. Index some documents:') + chalk.gray('\n   npx semsearch index ./my-documents\n\n') +
      chalk.white('2. Search your content:') + chalk.gray('\n   npx semsearch search "your query here"\n\n') +
      chalk.white('3. View configuration:') + chalk.gray(`\n   cat "${status.configDir}"\n\n`) +
      chalk.yellow(`💡 Configuration stored in: ${status.configDir}`),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }
    );
    
    console.log(nextSteps);
  }
}
