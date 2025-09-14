import fs from 'fs';
import crypto from 'crypto';

export function readTextFile(filePath: string, maxChars: number): { text: string; truncated: boolean } {
  const fd = fs.openSync(filePath, 'r');
  try {
    const stats = fs.fstatSync(fd);
    const length = Math.min(stats.size, maxChars);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, 0);
    const text = buffer.toString('utf8');
    return { text, truncated: stats.size > maxChars };
  } finally {
    fs.closeSync(fd);
  }
}

export function sha1(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex');
}

export function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export function cosine(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

export function toFloat32Blob(vec: number[]): Buffer {
  const arr = new Float32Array(vec);
  return Buffer.from(arr.buffer);
}

export function fromFloat32Blob(blob: Buffer, dim?: number): number[] {
  const arr = new Float32Array(blob.buffer, blob.byteOffset, dim ?? Math.floor(blob.byteLength / 4));
  return Array.from(arr);
}

export function isTextLike(filename: string): boolean {
  const lc = filename.toLowerCase();
  return /\.(txt|md|js|ts|tsx|jsx|json|yml|yaml|py|java|cs|go|rs|rb|php|sh|bat|ps1|csv|tsv|css|html|xml|sql)$/i.test(lc);
}
