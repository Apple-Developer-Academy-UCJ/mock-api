import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { resources } from './schema.js';
import { seed } from './seed.js';
import { migrateAvatars } from './avatars.js';

export const databasePath = () => process.env.DATABASE_PATH ?? 'data/classroom.sqlite';

export function openDatabase(path = databasePath()): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  try {
    db.exec('BEGIN');
    db.exec('CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    for (const name of ['users', 'shops', 'products', 'reviews']) {
      const resource = resources[name];
      const columns = Object.entries(resource.fields).map(([key, field]) => {
        let column = `${key} ${field.type === 'string' ? 'TEXT' : 'INTEGER'}${field.nullable ? '' : ' NOT NULL'}`;
        if (field.email) column += ' COLLATE NOCASE UNIQUE';
        if (field.reference) column += ` REFERENCES ${field.reference}(id) ON DELETE RESTRICT`;
        if (field.type === 'boolean') column += ` CHECK (${key} IN (0,1))`;
        if (field.min !== undefined) column += ` CHECK (${key} >= ${field.min})`;
        if (field.max !== undefined) column += ` CHECK (${key} <= ${field.max})`;
        if (field.values) column += ` CHECK (${key} IN (${field.values.map(value => `'${value}'`).join(',')}))`;
        return column;
      });
      db.exec(`CREATE TABLE IF NOT EXISTS ${name} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${columns.join(',')}, ${resource.created} TEXT NOT NULL) STRICT`);
      for (const key of resource.filters) db.exec(`CREATE INDEX IF NOT EXISTS idx_${name}_${key} ON ${name} (${key})`);
    }
    migrateAvatars(db);
    if (!db.prepare("SELECT value FROM metadata WHERE key = 'seeded'").get()) {
      seed(db);
      db.prepare('INSERT INTO metadata (key,value) VALUES (?,?)').run('seeded', '1');
    }
    db.exec('COMMIT');
    return db;
  } catch (error) {
    db.exec('ROLLBACK');
    db.close();
    throw error;
  }
}

export function resetDatabase(db: DatabaseSync) {
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const name of ['reviews', 'products', 'shops', 'users']) db.exec(`DELETE FROM ${name}`);
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('reviews','products','shops','users')");
    seed(db);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
