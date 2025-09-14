import fs from 'fs';
import path from 'path';
import { FileRecord } from './types';
import { cosine } from './utils';

/**
 * Simple file-based store for persistence when better-sqlite3 is not available
 */
export class FileStore {
  private dbPath: string;
  private indexPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.indexPath = dbPath.replace('.db', '.json');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadIndex(): Record<string, FileRecord> {
    if (!fs.existsSync(this.indexPath)) {
      return {};
    }
    try {
      const data = fs.readFileSync(this.indexPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private saveIndex(records: Record<string, FileRecord>) {
    fs.writeFileSync(this.indexPath, JSON.stringify(records, null, 2));
  }

  upsert(record: FileRecord) {
    const records = this.loadIndex();
    records[record.id] = record;
    this.saveIndex(records);
  }

  getById(id: string): FileRecord | null {
    const records = this.loadIndex();
    return records[id] || null;
  }

  listAll(): FileRecord[] {
    const records = this.loadIndex();
    return Object.values(records);
  }

  // Brute-force vector retrieval; returns [record, dotProduct]
  retrieveByEmbedding(queryEmbedding: number[], topK: number): Array<{ rec: FileRecord; score: number }> {
    const records = this.loadIndex();
    const results: Array<{ rec: FileRecord; score: number }> = [];
    
    for (const rec of Object.values(records)) {
      const score = cosine(queryEmbedding, rec.embedding);
      results.push({ rec, score });
    }
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  clear() {
    if (fs.existsSync(this.indexPath)) {
      fs.unlinkSync(this.indexPath);
    }
  }
}
