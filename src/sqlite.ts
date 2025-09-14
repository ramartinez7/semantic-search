import Database from 'better-sqlite3';
import fs from 'fs';
import mime from 'mime-types';
import path from 'path';
import { FileMetadata, FileRecord } from './types';
import { fromFloat32Blob, toFloat32Blob, cosine } from './utils';

export class SqliteStore {
  private db: Database.Database;

  constructor(public filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        path TEXT,
        filename TEXT,
        mimetype TEXT,
        size INTEGER,
        createdAt TEXT,
        modifiedAt TEXT,
        summary TEXT,
        embedding BLOB
      );
      CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
      CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename);
    `);
  }

  upsert(record: FileRecord) {
    const { id, metadata, summary, embedding } = record;
    const stmt = this.db.prepare(`
      INSERT INTO files (id, path, filename, mimetype, size, createdAt, modifiedAt, summary, embedding)
      VALUES (@id, @path, @filename, @mimetype, @size, @createdAt, @modifiedAt, @summary, @embedding)
      ON CONFLICT(id) DO UPDATE SET
        path=excluded.path,
        filename=excluded.filename,
        mimetype=excluded.mimetype,
        size=excluded.size,
        createdAt=excluded.createdAt,
        modifiedAt=excluded.modifiedAt,
        summary=excluded.summary,
        embedding=excluded.embedding
    `);
    stmt.run({
      id,
      path: metadata.path,
      filename: metadata.filename,
      mimetype: metadata.mimetype || mime.lookup(metadata.filename) || null,
      size: metadata.size ?? null,
      createdAt: metadata.createdAt ?? null,
      modifiedAt: metadata.modifiedAt ?? null,
      summary,
      embedding: toFloat32Blob(record.embedding),
    });
  }

  getById(id: string): FileRecord | null {
    const row = this.db.prepare('SELECT * FROM files WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.rowToRecord(row);
  }

  getByPath(filePath: string): FileRecord | null {
    const row = this.db.prepare('SELECT * FROM files WHERE path = ?').get(filePath) as any;
    if (!row) return null;
    return this.rowToRecord(row);
  }

  listAll(): FileRecord[] {
    const rows = this.db.prepare('SELECT * FROM files').all() as any[];
    return rows.map((r) => this.rowToRecord(r));
  }

  count(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM files').get() as any;
    return result.count;
  }

  // Brute-force vector retrieval; returns [record, dotProduct]
  retrieveByEmbedding(queryEmbedding: number[], topK: number): Array<{ rec: FileRecord; score: number }> {
    const rows = this.db.prepare('SELECT id, summary, embedding, path, filename, mimetype, size, createdAt, modifiedAt FROM files').all() as any[];
    const results: Array<{ rec: FileRecord; score: number }> = [];
    for (const r of rows) {
      const embedding = fromFloat32Blob(r.embedding);
      const score = cosine(queryEmbedding, embedding);
      const rec = this.rowToRecord(r);
      results.push({ rec, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  private rowToRecord(row: any): FileRecord {
    return {
      id: row.id,
      metadata: {
        id: row.id,
        path: row.path,
        filename: row.filename,
        mimetype: row.mimetype || undefined,
        size: row.size || undefined,
        createdAt: row.createdAt || undefined,
        modifiedAt: row.modifiedAt || undefined,
      },
      summary: row.summary,
      embedding: fromFloat32Blob(row.embedding),
    };
  }

  close() {
    this.db.close();
  }
}
