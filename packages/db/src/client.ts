import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

export type Db = NodePgDatabase<typeof schema>;

export function createDb(url: string): { pool: pg.Pool; db: Db } {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return { pool, db: drizzle({ client: pool, schema }) };
}

export const MIGRATIONS_FOLDER = new URL('../migrations', import.meta.url).pathname;
