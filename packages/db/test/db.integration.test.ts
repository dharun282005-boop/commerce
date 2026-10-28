import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, MIGRATIONS_FOLDER } from '../src/index.ts';
import { seed } from '../src/seed.ts';

const url = process.env.DATABASE_URL ?? 'postgres://cuc:cuc_dev_password@localhost:5432/cuc';
const { pool, db } = createDb(url);

beforeAll(async () => {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
});
afterAll(async () => {
  await pool.end();
});

describe('database (needs docker compose up -d postgres)', () => {
  it('has pg_trgm and pgvector enabled', async () => {
    const { rows } = await pool.query(
      "select extname from pg_extension where extname in ('pg_trgm','vector') order by 1",
    );
    expect(rows.map((r) => r.extname)).toEqual(['pg_trgm', 'vector']);
  });

  it('seeds localities, sources and offers for all four verticals', async () => {
    const result = await seed(url);
    expect(result.localities).toBeGreaterThanOrEqual(20);
    const { rows } = await pool.query('select distinct vertical from offers order by 1');
    expect(rows.map((r) => r.vertical)).toEqual(['food', 'grocery', 'property', 'shopping']);
  });

  it('price_observations rejects UPDATE and DELETE (append-only)', async () => {
    await expect(pool.query('update price_observations set price_paise = 1')).rejects.toThrow(/append-only/);
    await expect(pool.query('delete from price_observations')).rejects.toThrow(/append-only/);
  });

  it('trigram similarity works on offer titles', async () => {
    const { rows } = await pool.query(
      "select title from offers where vertical = 'shopping' order by similarity(title, 'samsung s24 fe 128gb') desc limit 1",
    );
    expect(rows[0].title).toMatch(/S24 FE/);
  });
});
