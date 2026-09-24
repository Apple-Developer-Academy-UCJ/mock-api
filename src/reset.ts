import { databasePath, openDatabase, resetDatabase } from './database.js';

if (!process.argv.includes('--confirm')) {
  console.error('Stop the server, then run npm run db:reset -- --confirm to replace all classroom data with seeds.');
  process.exitCode = 1;
} else {
  const db = openDatabase();
  try { resetDatabase(db); console.log(`Restored Indonesian seed data in ${databasePath()}`); }
  finally { db.close(); }
}
