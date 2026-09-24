import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, resetDatabase } from '../src/database.js';

test('avatar migration preserves existing records and custom URLs, and runs only once', () => {
  const directory = mkdtempSync(join(tmpdir(), 'avatar-migration-'));
  const path = join(directory, 'legacy.sqlite');
  let db = openDatabase(path);
  try {
    // Reproduce the previous schema and a classroom dataset with user edits.
    db.exec(`
      ALTER TABLE shops DROP COLUMN avatarUrl;
      ALTER TABLE products DROP COLUMN avatarUrl;
      ALTER TABLE reviews DROP COLUMN avatar_url;
      DELETE FROM metadata WHERE key = 'avatars_v1';
      UPDATE users SET avatar_url = NULL;
      UPDATE users SET avatar_url = 'https://example.com/custom.png' WHERE id = 1;
      UPDATE shops SET shopName = 'Warung Bu Siti' WHERE id = 1;
    `);
    const before = db.prepare('SELECT COUNT(*) AS count FROM reviews').get()?.count;
    db.close();
    db = openDatabase(path);
    const shop = db.prepare('SELECT * FROM shops WHERE id = 1').get()!;
    assert.equal(shop.shopName, 'Warung Bu Siti');
    assert.match(String(shop.avatarUrl), /&text=WBS$/);
    assert.equal(db.prepare('SELECT avatar_url FROM users WHERE id = 1').get()?.avatar_url, 'https://example.com/custom.png');
    assert.match(String(db.prepare('SELECT avatar_url FROM users WHERE id = 2').get()?.avatar_url), /&text=SR$/);
    assert.match(String(db.prepare('SELECT avatarUrl FROM products WHERE id = 1').get()?.avatarUrl), /&text=KBP$/);
    assert.match(String(db.prepare('SELECT avatar_url FROM reviews WHERE id = 1').get()?.avatar_url), /&text=BS$/);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM reviews').get()?.count, before);
    db.exec('UPDATE users SET avatar_url = NULL WHERE id = 2');
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare('SELECT avatarUrl FROM shops WHERE id = 1').get()?.avatarUrl, shop.avatarUrl);
    assert.equal(db.prepare('SELECT avatar_url FROM users WHERE id = 2').get()?.avatar_url, null);
    resetDatabase(db);
    assert.match(String(db.prepare('SELECT avatarUrl FROM shops WHERE id = 1').get()?.avatarUrl), /&text=TBN$/);
    assert.match(String(db.prepare('SELECT avatar_url FROM users WHERE id = 2').get()?.avatar_url), /&text=SR$/);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
