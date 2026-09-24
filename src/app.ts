import express, { type ErrorRequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { resources } from './schema.js';
import { ApiError, invalid, parseId, validateBody } from './validation.js';
import { timestamp } from './seed.js';

export function createApp(db: DatabaseSync) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  for (const [name, resource] of Object.entries(resources)) {
    const base = `/api/${name}`;
    const select = name === 'products'
      ? 'SELECT products.*, (SELECT COUNT(*) FROM reviews WHERE product_id = products.id) AS reviewCount, (SELECT COALESCE(SUM(rating), 0) FROM reviews WHERE product_id = products.id) AS totalRating FROM products'
      : `SELECT * FROM ${name}`;
    const serialize = (row: Record<string, unknown>) => {
      if (name === 'products') row.isAvailable = Boolean(row.isAvailable);
      return row;
    };
    const get = (id: number) => {
      const row = db.prepare(`${select} WHERE ${name}.id = ?`).get(id);
      if (!row) throw new ApiError(404, 'not_found', `${name} record ${id} was not found.`);
      return serialize(row);
    };
    app.get(base, (req, res) => {
      const filters = Object.entries(req.query).map(([key, value]) => {
        if (!resource.filters.includes(key)) invalid(`Unsupported filter: ${key}.`);
        return [key, parseId(value, key)] as const;
      });
      const where = filters.length ? ` WHERE ${filters.map(([key]) => `${name}.${key} = ?`).join(' AND ')}` : '';
      res.json(db.prepare(`${select}${where} ORDER BY ${name}.id`).all(...filters.map(([, value]) => value)).map(serialize));
    });
    app.get(`${base}/:id`, (req, res) => res.json(get(parseId(req.params.id))));
    app.post(base, (req, res) => {
      const values = validateBody(req.body, resource, false, db);
      values[resource.created] = timestamp();
      const keys = Object.keys(values);
      const result = db.prepare(`INSERT INTO ${name} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(values));
      const id = Number(result.lastInsertRowid);
      res.location(`${base}/${id}`).status(201).json(get(id));
    });
    for (const method of ['put', 'patch'] as const) {
      app[method](`${base}/:id`, (req, res) => {
        const id = parseId(req.params.id);
        get(id);
        const values = validateBody(req.body, resource, method === 'patch', db);
        db.prepare(`UPDATE ${name} SET ${Object.keys(values).map(key => `${key} = ?`).join(',')} WHERE id = ?`).run(...Object.values(values), id);
        res.json(get(id));
      });
    }
    app.delete(`${base}/:id`, (req, res) => {
      const id = parseId(req.params.id);
      get(id);
      db.prepare(`DELETE FROM ${name} WHERE id = ?`).run(id);
      res.status(204).end();
    });
  }
  app.use((_req, _res, next) => next(new ApiError(404, 'not_found', 'Endpoint was not found.')));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ApiError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
    if (error.type === 'entity.parse.failed') { res.status(400).json({ error: { code: 'invalid_input', message: 'Body contains invalid JSON.' } }); return; }
    if (error.type === 'entity.too.large') { res.status(413).json({ error: { code: 'payload_too_large', message: 'Body exceeds 100 KB.' } }); return; }
    if (error.code === 'ERR_SQLITE_ERROR' && [787, 1811, 2067].includes(error.errcode)) {
      res.status(409).json({ error: { code: 'conflict', message: error.errcode === 2067 ? 'Email address already exists.' : 'Record has dependent records; delete them first.' } }); return;
    }
    console.error(error);
    res.status(500).json({ error: { code: 'internal_error', message: 'An unexpected server error occurred.' } });
  };
  app.use(errors);
  return app;
}
