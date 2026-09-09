/**
 * DATABASE B. SPEC.txt 4.5 + Section 3 ("PERSISTENCE").
 *
 * A file, not a server, and NOT the same file as identity-gateway-api's
 * gateway.db. Two genuinely separate SQLite databases is the point of the
 * design: SPEC.txt Section 3 -- "They must be genuinely separate database
 * files [...] Do NOT use one file with two schemas." There is no schema, no
 * connection and no foreign key shared between the two applications.
 *
 * `synchronize: true` is explicitly acceptable here -- this is a structural
 * proof, and it is what materialises the (tid, oid) unique index on boot.
 */
import { DataSource, DataSourceOptions } from 'typeorm';

import { Analysis } from '../analyses/analysis.entity';
import { User } from '../users/user.entity';

/** Default matches .env (DB_PATH=./workspace.db), relative to the process cwd. */
export const DEFAULT_DB_PATH = './workspace.db';

/**
 * Built lazily so the value of DB_PATH is read after dotenv has run, not at
 * module-import time.
 */
export function buildDataSourceOptions(): DataSourceOptions {
  return {
    type: 'better-sqlite3',
    database: process.env.DB_PATH?.trim() || DEFAULT_DB_PATH,
    entities: [User, Analysis],
    synchronize: true,
    logging: false,
  };
}

/** For the TypeORM CLI, should it ever be pointed at this service. */
export const AppDataSource = new DataSource(buildDataSourceOptions());
