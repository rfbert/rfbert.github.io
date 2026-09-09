/**
 * DATABASE A. SPEC.txt 4.3 + Section 3 ("PERSISTENCE").
 *
 * A file, not a server, and NOT the same file as agent-workspace-api's
 * workspace.db. Two genuinely separate SQLite databases is the point of the
 * design: there is no schema, no connection and no foreign key shared between
 * the two applications.
 *
 * `synchronize: true` is explicitly acceptable here -- this is a structural
 * proof, and it is what materialises the (tid, oid) unique index on boot.
 */
import { DataSource, DataSourceOptions } from 'typeorm';

import { Conversation } from '../conversations/conversation.entity';
import { User } from '../users/user.entity';

/** Default matches .env (DB_PATH=./gateway.db), relative to the process cwd. */
export const DEFAULT_DB_PATH = './gateway.db';

/**
 * Built lazily so the value of DB_PATH is read after dotenv has run, not at
 * module-import time.
 */
export function buildDataSourceOptions(): DataSourceOptions {
  return {
    type: 'better-sqlite3',
    database: process.env.DB_PATH?.trim() || DEFAULT_DB_PATH,
    entities: [User, Conversation],
    synchronize: true,
    logging: false,
  };
}

/** For the TypeORM CLI, should it ever be pointed at this service. */
export const AppDataSource = new DataSource(buildDataSourceOptions());
