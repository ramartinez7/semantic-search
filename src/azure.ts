import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { AzureOpenAI } from 'openai';
import type { AzureConfig } from './types';

export type AzureClients = {
  client: AzureOpenAI;
  embeddingDeployment: string;
  rerankDeployment: string;
};

export function createAzureClients(cfg: AzureConfig, credential?: DefaultAzureCredential | any, apiKey?: string): AzureClients {
  const envApiKey = process.env.AZURE_OPENAI_API_KEY;
  const finalApiKey = apiKey || envApiKey;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-01';

  let client: AzureOpenAI;
  if (finalApiKey) {
    console.log(`Using Azure OpenAI with API key authentication`);
    client = new AzureOpenAI({
      apiKey: finalApiKey,
      endpoint: cfg.endpoint,
      apiVersion,
    });
  } else {
    console.log(`Using Azure OpenAI with managed identity authentication`);
    const cred = credential || new DefaultAzureCredential();
    const scope = 'https://cognitiveservices.azure.com/.default';
    const azureADTokenProvider = getBearerTokenProvider(cred, scope);
    client = new AzureOpenAI({
      azureADTokenProvider,
      endpoint: cfg.endpoint,
      apiVersion,
    });
  }

  return { client, embeddingDeployment: cfg.embeddingDeployment, rerankDeployment: cfg.rerankDeployment };
}
