/**
 * identity-gateway-api -- NestJS 1, port 4000, DATABASE A (gateway.db).
 *
 * Loads .env FIRST: JwtStrategy and the TypeORM factory both read process.env,
 * and a missing ISSUER/AUDIENCE must fail loudly at boot rather than quietly
 * widen what this API accepts.
 */
import 'dotenv/config';
import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { DEFAULT_DB_PATH } from './database/data-source';

const DEFAULT_PORT = 4000;
const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const corsOrigin = process.env.CORS_ORIGIN?.trim() || DEFAULT_CORS_ORIGIN;

  // CORS: EXACTLY ONE ORIGIN -- identity-gateway-web (:3000).
  // Not "*", not a list, not a reflected Origin header. :4001 allows only
  // :3001 in the same way (SPEC.txt Section 8, "KNOWN LOCAL PITFALLS").
  // credentials:true is required for the browser to send/receive cookies, and
  // is incompatible with a wildcard origin anyway.
  app.enableCors({
    origin: [corsOrigin],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  app.enableShutdownHooks();
  await app.listen(port);

  const line = '='.repeat(72);
  const logger = new Logger('bootstrap');
  const banner = [
    line,
    '  identity-gateway-api  --  NestJS 1  --  DATABASE A',
    line,
    `  listening   : http://localhost:${port}`,
    `  cors origin : ${corsOrigin}   (identity-gateway-web only)`,
    `  database    : ${process.env.DB_PATH?.trim() || DEFAULT_DB_PATH}   (DATABASE A -- separate file from workspace.db)`,
    `  issuer      : ${process.env.ISSUER}`,
    `  audience    : ${process.env.AUDIENCE}`,
    `  jwks        : ${process.env.JWKS_URI}`,
    '  scope       : access_as_user  (required)',
    `  ${'-'.repeat(70)}`,
    '  routes      : GET  /me             guarded -- identity + local row',
    '                GET  /conversations  guarded -- scoped to local user id',
    '                POST /conversations  guarded -- scoped to local user id',
    `  ${'-'.repeat(70)}`,
    '  identity is the (tid, oid) claim pair. JIT find-or-create on first call.',
    '  ISSUER / AUDIENCE / JWKS_URI must be byte-identical in agent-workspace-api.',
    line,
  ].join('\n');
  logger.log(`\n${banner}`);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[identity-gateway-api] failed to start:', error);
  process.exit(1);
});
