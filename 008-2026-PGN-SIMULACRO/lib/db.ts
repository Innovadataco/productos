import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'estudio.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

export { db };
export default db;
