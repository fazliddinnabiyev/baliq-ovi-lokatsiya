import { Pool } from "pg";
import type { QueryResult, QueryResultRow } from "pg";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS spots (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  fish_most TEXT,
  fish_mid TEXT,
  fish_least TEXT,
  bait TEXT NOT NULL DEFAULT '',
  times TEXT[] NOT NULL DEFAULT '{}',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE spots ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS draft BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS share_token TEXT;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS owner_name TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS spots_share_idx ON spots (share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS spots_owner_idx ON spots (owner_id);
CREATE TABLE IF NOT EXISTS spot_media (
  id SERIAL PRIMARY KEY,
  spot_id INT NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spot_media_spot_idx ON spot_media (spot_id);
CREATE TABLE IF NOT EXISTS pending_spots (
  owner_id TEXT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminded_at TIMESTAMPTZ,
  remind_count INT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS spot_comments (
  id SERIAL PRIMARY KEY,
  spot_id INT NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spot_comments_spot_idx ON spot_comments (spot_id);
`;

const g = globalThis as unknown as {
  _fishPool?: Pool;
  _fishSchema?: Promise<void>;
};

function getPool(): Pool {
  if (!g._fishPool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL topilmadi (Vercel Environment Variables'ni tekshiring)");
    const local = /localhost|127\.0\.0\.1/.test(url);
    g._fishPool = new Pool({
      connectionString: url,
      max: 3,
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
  }
  return g._fishPool;
}

function ensureSchema(): Promise<void> {
  if (!g._fishSchema) {
    g._fishSchema = getPool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((e) => {
        g._fishSchema = undefined;
        throw e;
      });
  }
  return g._fishSchema;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  await ensureSchema();
  return getPool().query<T>(text, params);
}
