import Database from 'better-sqlite3';
import fs from 'fs';
import mime from 'mime-types';
import path from 'path';
import { FileMetadata, FileRecord } from './types';
import * as sqliteVec from 'sqlite-vec';

export class SqliteStore {
  private db: Database.Database;
  private vectorTableReady = false;

  constructor(public filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    
    // Load sqlite-vec extension
    this.db.loadExtension(sqliteVec.getLoadablePath());
    
    this.initializeSchema();
  }

  private initializeSchema() {
    // Create the main files table (without embedding column)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        path TEXT,
        filename TEXT,
        mimetype TEXT,
        size INTEGER,
        createdAt TEXT,
        modifiedAt TEXT,
        summary TEXT
      );
    `);
    
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
      CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename);
    `);
  }

  private ensureVectorTable(embeddingDimension: number) {
    if (this.vectorTableReady) return;
    
    try {
      // Drop existing table if dimensions don't match
      this.db.exec('DROP TABLE IF EXISTS vec_files');
      
      // Create virtual vector table with correct dimensions
      this.db.exec(`
        CREATE VIRTUAL TABLE vec_files USING vec0(
          id TEXT PRIMARY KEY,
          embedding float[${embeddingDimension}]
        );
      `);
      
      this.vectorTableReady = true;
    } catch (error) {
      console.warn('Failed to create vector table:', error);
    }
  }

  upsert(record: FileRecord) {
    const { id, metadata, summary, embedding } = record;
    
    // Validate embedding data
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Invalid embedding data: must be non-empty array');
    }
    
    if (!embedding.every(n => typeof n === 'number' && !isNaN(n))) {
      throw new Error('Embedding contains invalid values: all elements must be numbers');
    }
    
    // Ensure vector table exists with correct dimensions
    this.ensureVectorTable(embedding.length);
    
    // Insert/update main table (without embedding)
    const stmt = this.db.prepare(`
      INSERT INTO files (id, path, filename, mimetype, size, createdAt, modifiedAt, summary)
      VALUES (@id, @path, @filename, @mimetype, @size, @createdAt, @modifiedAt, @summary)
      ON CONFLICT(id) DO UPDATE SET
        path=excluded.path,
        filename=excluded.filename,
        mimetype=excluded.mimetype,
        size=excluded.size,
        createdAt=excluded.createdAt,
        modifiedAt=excluded.modifiedAt,
        summary=excluded.summary
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
    });

    // Store embedding in vector table (delete + insert since UPSERT not supported)
    const deleteVecStmt = this.db.prepare('DELETE FROM vec_files WHERE id = ?');
    deleteVecStmt.run(id);
    
    const insertVecStmt = this.db.prepare('INSERT INTO vec_files (id, embedding) VALUES (?, ?)');
    insertVecStmt.run(id, JSON.stringify(embedding));
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

  vectorCount(): number {
    try {
      const result = this.db.prepare('SELECT COUNT(*) as count FROM vec_files').get() as any;
      return result.count;
    } catch {
      return 0;
    }
  }

  hasVectorIndex(): boolean {
    try {
      this.db.prepare('SELECT COUNT(*) FROM vec_files LIMIT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  // Vector-based retrieval using sqlite-vec
  retrieveByEmbedding(queryEmbedding: number[], topK: number): Array<{ rec: FileRecord; score: number }> {
    const vecQuery = this.db.prepare(`
      SELECT 
        id, 
        distance
      FROM vec_files 
      WHERE embedding MATCH ? 
      ORDER BY distance 
      LIMIT ?
    `);
    
    const vecResults = vecQuery.all(JSON.stringify(queryEmbedding), topK) as Array<{ id: string; distance: number }>;
    
    // Convert distance to similarity score (cosine distance -> cosine similarity)
    const results: Array<{ rec: FileRecord; score: number }> = [];
    for (const vecResult of vecResults) {
      const fileRecord = this.getById(vecResult.id);
      if (fileRecord) {
        // sqlite-vec returns distance, convert to similarity
        const similarity = 1 - vecResult.distance;
        results.push({ rec: fileRecord, score: similarity });
      }
    }
    
    return results;
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
      // No embedding field - embeddings are managed by sqlite-vec separately
    };
  }

  close() {
    this.db.close();
  }
}
