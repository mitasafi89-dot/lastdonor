import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// prepare: false is required for Supabase connection pooling (PgBouncer transaction mode)
const client = postgres(connectionString, {
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 20,
  max: 5,
  max_lifetime: 60 * 30, // 30 min max connection lifetime
});

export const db = drizzle(client, { schema });
