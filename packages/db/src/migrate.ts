import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, MIGRATIONS_FOLDER } from './index.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const { pool, db } = createDb(url);
await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
console.log('migrations applied');
await pool.end();
