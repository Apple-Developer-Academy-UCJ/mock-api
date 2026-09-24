import { createApp } from './app.js';
import { openDatabase } from './database.js';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
const db = openDatabase();
const server = createApp(db).listen(port, '0.0.0.0', () => console.log(`Classroom API listening on http://0.0.0.0:${port}/api`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
