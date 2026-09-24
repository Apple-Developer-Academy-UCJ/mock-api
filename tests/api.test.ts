import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { openDatabase, resetDatabase } from '../src/database.js';

test('classroom API end-to-end', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'classroom-api-'));
  const path = join(directory, 'test.sqlite');
  const db = openDatabase(path);
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  async function request(path: string, method = 'GET', body?: unknown, status = 200): Promise<any> {
    const response = await fetch(base + path, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`);
    if (status === 204) { assert.equal(await response.text(), ''); return; }
    const result = await response.json() as any;
    if (status >= 400) { assert.equal(typeof result.error.code, 'string'); assert.equal(typeof result.error.message, 'string'); }
    return result;
  }

  await t.test('Indonesian seeds, exact naming, booleans, nulls and aggregates', async () => {
    const shops = await request('/shops');
    assert.equal(shops.length, 3);
    assert.deepEqual(new Set(shops.map((s: any) => s.shopTier)), new Set(['bronze', 'silver', 'gold']));
    assert.deepEqual(Object.keys(shops[0]).sort(), ['id','ownerId','shopName','description','city','shopTier','avatarUrl','createdAt'].sort());
    const products = await request('/products');
    assert.equal(products.length, 15);
    assert.deepEqual(Object.keys(products[0]).sort(), ['id','shopId','productName','description','price','stockCount','imageUrl','avatarUrl','isAvailable','reviewCount','totalRating','createdAt'].sort());
    assert.equal(products[0].productName, 'Kemeja Batik Parang');
    assert.equal(products[0].reviewCount, 3);
    assert.equal(products[0].totalRating, 13);
    assert.equal(products[12].reviewCount, 0);
    assert.equal(products[12].totalRating, 0);
    assert.equal(products[3].isAvailable, false);
    assert.equal(products[3].description, null);
    const users = await request('/users');
    assert.equal(users.length, 6);
    assert.equal(users[0].full_name, 'Budi Santoso');
    assert.deepEqual(Object.keys(users[0]).sort(), ['id','full_name','email','avatar_url','created_at'].sort());
    assert.match(users[0].avatar_url, /^https:\/\/dummyimage\.com\/256x256\/[0-9a-f]{6}\/ffffff\.png&text=BS$/);
    const reviews = await request('/reviews');
    assert.equal(reviews.length, 20);
    assert.deepEqual(Object.keys(reviews[0]).sort(), ['id','product_id','user_id','rating','review_text','avatar_url','created_at'].sort());
    for (const [records, field] of [[shops, 'avatarUrl'], [products, 'avatarUrl'], [users, 'avatar_url'], [reviews, 'avatar_url']] as const) {
      for (const record of records) assert.match(record[field], /^https:\/\/dummyimage\.com\/256x256\/[0-9a-f]{6}\/ffffff\.png&text=[A-Z]+$/);
    }
    assert.match(shops[0].avatarUrl, /&text=TBN$/);
    assert.match(shops[1].avatarUrl, /&text=KSB$/);
    assert.match(shops[2].avatarUrl, /&text=KJ$/);
    assert.equal((await request('/shops/1')).avatarUrl, shops[0].avatarUrl);
    assert.match(reviews[0].created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  await t.test('CRUD for every entity, PUT replacement, PATCH preservation and constraints', async () => {
    const userBody = { full_name: 'Nadia Permata', email: 'nadia@example.com', avatar_url: null };
    const user = await request('/users', 'POST', userBody, 201);
    assert.deepEqual(await request(`/users/${user.id}`), user);
    const patchedUser = await request(`/users/${user.id}`, 'PATCH', { full_name: 'Nadia Putri' });
    assert.equal(patchedUser.email, user.email);
    await request(`/users/${user.id}`, 'PUT', userBody);
    const shopBody = { ownerId: user.id, shopName: 'Warung Nusantara', city: 'Surabaya', shopTier: 'bronze', description: 'Pilihan lokal.' };
    const shop = await request('/shops', 'POST', shopBody, 201);
    assert.deepEqual(await request(`/shops/${shop.id}`), shop);
    const avatar = 'https://dummyimage.com/256x256/335577/ffffff.png&text=WN';
    assert.equal((await request(`/shops/${shop.id}`, 'PATCH', { avatarUrl: avatar })).avatarUrl, avatar);
    await request(`/shops/${shop.id}`, 'PATCH', { avatarUrl: 'invalid' }, 400);
    for (const shopTier of ['bronze', 'silver', 'gold']) assert.equal((await request(`/shops/${shop.id}`, 'PATCH', { shopTier })).shopTier, shopTier);
    const replaced = await request(`/shops/${shop.id}`, 'PUT', { ...shopBody, description: undefined });
    assert.equal(replaced.description, null);
    const productBody = { shopId: shop.id, productName: 'Sambal Bawang', description: null, price: 25000, stockCount: 5, imageUrl: null, isAvailable: true };
    const product = await request('/products', 'POST', productBody, 201);
    assert.deepEqual(await request(`/products/${product.id}`), product);
    assert.equal((await request(`/products/${product.id}`, 'PATCH', { stockCount: 4 })).productName, product.productName);
    await request(`/products/${product.id}`, 'PUT', productBody);
    const reviewBody = { product_id: product.id, user_id: user.id, rating: 5, review_text: 'Rasanya enak sekali.' };
    const review = await request('/reviews', 'POST', reviewBody, 201);
    assert.deepEqual(await request(`/reviews/${review.id}`), review);
    assert.equal((await request(`/products/${product.id}`)).totalRating, 5);
    await request(`/reviews/${review.id}`, 'PATCH', { rating: 2 });
    assert.equal((await request(`/products/${product.id}`)).totalRating, 2);
    await request(`/reviews/${review.id}`, 'PUT', { ...reviewBody, product_id: 13, rating: 4 });
    assert.equal((await request(`/products/${product.id}`)).reviewCount, 0);
    assert.equal((await request('/products/13')).totalRating, 4);
    await request(`/users/${user.id}`, 'DELETE', undefined, 409);
    await request(`/shops/${shop.id}`, 'DELETE', undefined, 409);
    await request('/products/13', 'DELETE', undefined, 409);
    await request(`/reviews/${review.id}`, 'DELETE', undefined, 204);
    assert.equal((await request('/products/13')).totalRating, 0);
    for (const [resource, id] of [['products', product.id], ['shops', shop.id], ['users', user.id]]) {
      await request(`/${resource}/${id}`, 'DELETE', undefined, 204);
      await request(`/${resource}/${id}`, 'GET', undefined, 404);
    }
  });

  await t.test('relationship filters and validation errors', async () => {
    assert.equal((await request('/shops?ownerId=1')).length, 1);
    assert.equal((await request('/products?shopId=1')).length, 5);
    assert.equal((await request('/reviews?product_id=1')).length, 3);
    assert.equal((await request('/reviews?product_id=1&user_id=1')).length, 1);
    assert.deepEqual(await request('/products?shopId=9999'), []);
    for (const path of ['/products?shopId=x', '/products?shopId=1&shopId=2', '/users?sort=id', '/shops/0', '/shops/nope']) await request(path, 'GET', undefined, 400);
    await request('/shops/9999', 'GET', undefined, 404);
    await request('/missing', 'GET', undefined, 404);
    const invalidBodies = [ {}, { shopTier: 'platinum' }, { shopTier: null }, { ownerId: 99999 }, { shop_name: 'Salah' }, { id: 42 }, { createdAt: '2026-01-01' } ];
    for (const body of invalidBodies) await request('/shops/1', 'PATCH', body, 400);
    for (const body of [{ reviewCount: 2 }, { totalRating: 7 }, { price: -1 }, { price: 1.5 }, { stockCount: -1 }, { isAvailable: 1 }, { imageUrl: 'invalid' }]) await request('/products/1', 'PATCH', body, 400);
    for (const rating of [0, 6, 2.5, '5', null]) await request('/reviews/1', 'PATCH', { rating }, 400);
    await request('/users', 'POST', { full_name: 'Budi', email: 'BUDI.SANTOSO@example.com' }, 409);
    await request('/users', 'POST', { full_name: 'Budi', email: 'bad' }, 400);
    await request('/users', 'POST', [], 400);
    await request('/shops/1', 'PUT', { shopTier: 'gold' }, 400);
    await request('/reviews', 'POST', { product_id: 1, user_id: 1, rating: 4 }, 400);
    const malformed = await fetch(base + '/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json() as any).error.code, 'invalid_input');
  });

  await t.test('persistence across connections and transactional reset', async () => {
    await request('/users/1', 'PATCH', { full_name: 'Budi Diperbarui' });
    const reopened = openDatabase(path);
    assert.equal(reopened.prepare('SELECT full_name FROM users WHERE id = 1').get()?.full_name, 'Budi Diperbarui');
    reopened.close();
    resetDatabase(db);
    assert.equal((await request('/users/1')).full_name, 'Budi Santoso');
    assert.equal((await request('/reviews')).length, 20);
    assert.equal((await request('/products/1')).totalRating, 13);
    resetDatabase(db);
    assert.equal((await request('/shops')).length, 3);
  });
});
