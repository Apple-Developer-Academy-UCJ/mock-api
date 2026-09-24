import { randomInt } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export function avatarUrl(name: string): string {
  const initials = name.trim().split(/\s+/u).map(word => Array.from(word)[0]).join('').toUpperCase();
  // Dark RGB channels keep the white initials legible.
  const background = Array.from({ length: 3 }, () => randomInt(32, 145).toString(16).padStart(2, '0')).join('');
  return `https://dummyimage.com/256x256/${background}/ffffff.png&text=${encodeURIComponent(initials)}`;
}

/** Called once for existing databases, and after inserting a fresh seed dataset. */
export function populateAvatars(db: DatabaseSync) {
  for (const [table, field, label] of [
    ['users', 'avatar_url', 'full_name'], ['shops', 'avatarUrl', 'shopName'],
    ['products', 'avatarUrl', 'productName']
  ]) {
    const update = db.prepare(`UPDATE ${table} SET ${field} = ? WHERE id = ?`);
    for (const row of db.prepare(`SELECT id, ${label} AS label FROM ${table} WHERE ${field} IS NULL`).all()) {
      update.run(avatarUrl(String(row.label)), row.id);
    }
  }
  const updateReview = db.prepare('UPDATE reviews SET avatar_url = ? WHERE id = ?');
  for (const row of db.prepare('SELECT reviews.id, users.full_name FROM reviews JOIN users ON users.id = reviews.user_id WHERE reviews.avatar_url IS NULL').all()) {
    updateReview.run(avatarUrl(String(row.full_name)), row.id);
  }
}

export function migrateAvatars(db: DatabaseSync) {
  if (db.prepare("SELECT value FROM metadata WHERE key = 'avatars_v1'").get()) return;
  for (const [table, field] of [['shops', 'avatarUrl'], ['products', 'avatarUrl'], ['reviews', 'avatar_url']]) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some(column => column.name === field)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${field} TEXT`);
  }
  populateAvatars(db);
  db.prepare('INSERT INTO metadata (key,value) VALUES (?,?)').run('avatars_v1', '1');
}
