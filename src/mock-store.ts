import { FileRecord } from './types';
import { cosine } from './utils';

/**
 * In-memory mock store for testing/development when better-sqlite3 is unavailable
 */
export class MockStore {
  private records = new Map<string, FileRecord>();

  upsert(record: FileRecord) {
    this.records.set(record.id, record);
  }

  getById(id: string): FileRecord | null {
    return this.records.get(id) || null;
  }

  listAll(): FileRecord[] {
    return Array.from(this.records.values());
  }

  // Brute-force vector retrieval; returns [record, dotProduct]
  retrieveByEmbedding(queryEmbedding: number[], topK: number): Array<{ rec: FileRecord; score: number }> {
    const results: Array<{ rec: FileRecord; score: number }> = [];
    for (const rec of this.records.values()) {
      const score = cosine(queryEmbedding, rec.embedding);
      results.push({ rec, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  clear() {
    this.records.clear();
  }
}
