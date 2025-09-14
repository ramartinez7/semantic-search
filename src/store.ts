import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import { createAzureClients } from './azure';
import { summarizeFile, embedText, rerank, TokenUsage } from './nlp';
import { SqliteStore } from './sqlite';
import { FileRecord, StoreConfig, SearchResult } from './types';
import { isTextLike } from './utils';
import { IndexingProgressManager, ProgressCallbacks } from './indexing-progress';
import { DEFAULT_CONFIG } from './constants';

export class SemanticStore {
  private azure = createAzureClients(this.config.azure, this.config.credential);
  private db = new SqliteStore(this.config.sqlite.path);

  constructor(private config: StoreConfig) {}

  async indexPath(targetPath: string, options: { verbose?: boolean; callbacks?: ProgressCallbacks; concurrency?: number; force?: boolean } = {}) {
    const stat = fs.statSync(targetPath);
    const files: string[] = stat.isDirectory() 
      ? await fg('**/*', { cwd: targetPath, onlyFiles: true, absolute: true }) 
      : [path.resolve(targetPath)];
    
    // Filter to only text-like files
    const textFiles = files.filter(f => isTextLike(f));
    
    // Check which files need processing (unless force is true)
    const filesToProcess: string[] = [];
    if (options.force) {
      filesToProcess.push(...textFiles);
    } else {
      for (const filePath of textFiles) {
        if (await this.shouldProcessFile(filePath)) {
          filesToProcess.push(filePath);
        }
      }
    }
    
    // Initialize progress manager with total files found, but track processed vs skipped separately
    const progress = new IndexingProgressManager(
      textFiles.length, 
      options.callbacks || {}, 
      options.verbose || false
    );
    
    progress.start();
    
    // Skip files that don't need processing
    const skippedFiles = textFiles.filter(f => !filesToProcess.includes(f));
    for (const skippedFile of skippedFiles) {
      progress.skipFile(skippedFile, 'already up-to-date');
    }
    
    const concurrency = options.concurrency || DEFAULT_CONFIG.DEFAULT_CONCURRENCY; // Process files in parallel by default
    
    // Process files in batches for controlled parallelism
    for (let i = 0; i < filesToProcess.length; i += concurrency) {
      const batch = filesToProcess.slice(i, i + concurrency);
      
      // Show batch info when verbose and using concurrency > 1
      if (options.verbose && concurrency > 1 && filesToProcess.length > 1) {
        console.log(chalk.blue(`\n📦 Processing batch ${Math.floor(i / concurrency) + 1} (${batch.length} files):`));
      }
      
      const promises = batch.map(async (filePath) => {
        const fileStartTime = Date.now();
        progress.startFile(filePath);
        
        try {
          const tokens = await this.indexFile(filePath, (msg) => progress.updateProgress(msg));
          const duration = Date.now() - fileStartTime;
          progress.completeFile(filePath, duration, tokens);
        } catch (error) {
          progress.errorFile(filePath, error as Error);
        }
      });
      
      await Promise.all(promises);
      
      if (options.verbose && concurrency > 1 && filesToProcess.length > 1) {
        console.log(chalk.gray(`📦 Batch ${Math.floor(i / concurrency) + 1} completed\n`));
      }
    }
    
    progress.complete();
    return progress.getStats();
  }

  async indexFile(filePath: string, onProgress?: (msg: string) => void): Promise<{ summary: TokenUsage; embedding: TokenUsage }> {
    const stat = fs.statSync(filePath);
    const filename = path.basename(filePath);
    const resolvedPath = path.resolve(filePath);
    
    // Check if file already exists in database and reuse its ID
    const existingRecord = this.db.getByPath(resolvedPath);
    const id = existingRecord?.id || uuidv4();
    
    const { summary, tokens: summaryTokens } = await summarizeFile(this.azure, filePath, this.config.summarizer.maxChars, onProgress);
    const { embedding, tokens: embeddingTokens } = await embedText(this.azure, summary, onProgress);
    
    const rec: FileRecord = {
      id,
      metadata: {
        id,
        path: resolvedPath,
        filename,
        size: stat.size,
        createdAt: existingRecord?.metadata.createdAt || stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
      },
      summary,
      embedding,
    };
    
    this.db.upsert(rec);
    return { summary: summaryTokens, embedding: embeddingTokens };
  }

  private async shouldProcessFile(filePath: string): Promise<boolean> {
    try {
      const existingRecord = this.db.getByPath(path.resolve(filePath));
      
      // Only process if file is not in database
      return !existingRecord;
    } catch (error) {
      // If we can't check, err on the side of processing
      return true;
    }
  }

  async search(query: string, opts?: { topK?: number }): Promise<SearchResult[]> {
    const topK = opts?.topK ?? DEFAULT_CONFIG.DEFAULT_TOP_K;
    const qvec = await embedText(this.azure, query);
    const candidates = this.db.retrieveByEmbedding(qvec.embedding, Math.max(topK * DEFAULT_CONFIG.CANDIDATE_MULTIPLIER, DEFAULT_CONFIG.MIN_CANDIDATES));
    const reranked = await rerank(
      this.azure,
      query,
      candidates.map((c: { rec: FileRecord; score: number }) => ({ id: c.rec.id, summary: c.rec.summary })),
      topK
    );
    const byId = new Map<string, { rec: FileRecord; score: number }>(
      candidates.map((c: { rec: FileRecord; score: number }) => [c.rec.id, c])
    );
    return reranked
      .map((r: { id: string; score: number }) => {
        const candidate = byId.get(r.id);
        if (!candidate) return null;
        return { 
          id: r.id, 
          score: r.score, 
          metadata: candidate.rec.metadata, 
          summary: candidate.rec.summary 
        } as SearchResult;
      })
      .filter((result): result is SearchResult => result !== null);
  }

  info(id: string): FileRecord | null {
    return this.db.getById(id);
  }

  count(): number {
    return this.db.count();
  }
}
