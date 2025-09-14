import { homedir } from 'os';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs';

export interface ConfigData {
  version: string;
  setupDate: string;
  authentication: 'api-key' | 'azure-ad';
  endpoints: {
    azure: string;
  };
  deployments: {
    embedding: string;
    rerank: string;
  };
  storage: {
    defaultDatabase: string;
  };
  prompts?: {
    summarization?: string;
  };
}

export class ConfigManager {
  private readonly configDir: string;
  private readonly configFile: string;
  private readonly envFile: string;
  private readonly dataDir: string;

  constructor() {
    // Use platform-appropriate config directory
    this.configDir = this.getConfigDirectory();
    this.configFile = join(this.configDir, 'config.json');
    this.envFile = join(this.configDir, '.env');
    this.dataDir = join(this.configDir, 'data');
  }

  private getConfigDirectory(): string {
    const platform = process.platform;
    const home = homedir();
    
    switch (platform) {
      case 'win32':
        return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'semsearch');
      case 'darwin':
        return join(home, 'Library', 'Application Support', 'semsearch');
      default: // Linux and others
        return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'semsearch');
    }
  }

  getConfigPath(): string {
    return this.configFile;
  }

  getDataDirectory(): string {
    return this.dataDir;
  }

  getDefaultDatabasePath(): string {
    return join(this.dataDir, 'index.db');
  }

  ensureDirectories(): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  exists(): boolean {
    return existsSync(this.configFile);
  }

  load(): ConfigData | null {
    if (!this.exists()) {
      return null;
    }
    try {
      const content = readFileSync(this.configFile, 'utf8');
      return JSON.parse(content) as ConfigData;
    } catch (error) {
      return null;
    }
  }

  save(config: ConfigData): void {
    this.ensureDirectories();
    writeFileSync(this.configFile, JSON.stringify(config, null, 2), 'utf8');
  }

  saveEnv(envContent: string): void {
    this.ensureDirectories();
    writeFileSync(this.envFile, envContent, 'utf8');
  }

  loadEnv(): Record<string, string> {
    if (!existsSync(this.envFile)) {
      return {};
    }
    const content = readFileSync(this.envFile, 'utf8');
    const env: Record<string, string> = {};
    
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    
    return env;
  }

  reset(): void {
    if (existsSync(this.configDir)) {
      rmSync(this.configDir, { recursive: true, force: true });
    }
  }

  getStatus(): {
    configExists: boolean;
    envExists: boolean;
    dataDir: string;
    configDir: string;
  } {
    return {
      configExists: existsSync(this.configFile),
      envExists: existsSync(this.envFile),
      dataDir: this.dataDir,
      configDir: this.configDir
    };
  }
}
