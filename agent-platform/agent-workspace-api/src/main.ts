/**
 * agent-workspace-api -- NestJS 2, port 4001, DATABASE B (workspace.db).
 *
 * Loads .env FIRST: JwtStrategy, AgentClient and the TypeORM factory all read
 * process.env, and a missing ISSUER/AUDIENCE must fail loudly at boot rather
 * than quietly widen what this API accepts.
 */
import 'dotenv/config';
import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { DEFAULT_DB_PATH } from './database/data-source';

const DEFAULT_PORT = 4001;
const DEFAULT_CORS_ORIGIN = 'http://localhost:3001';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const corsOrigin = process.env.CORS_ORIGIN?.trim() || DEFAULT_CORS_ORIGIN;

  // CORS: EXACTLY ONE ORIGIN -- agent-workspace-web (:3001).
  // Not "*", not a list, not a reflected Origin header. :4000 allows only
  // :3000 in the same way (SPEC.txt Section 8, "KNOWN LOCAL PITFALLS":
  // ":4000 allows only :3000. :4001 allows only :3001.").
  // Note that :3000 is NOT allowed here even though the workspace runs inside
  // an iframe hosted by :3000 -- the framed page's own origin is :3001, and it
  // is the page's origin, not the frame's host, that a browser sends.
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
    '  agent-workspace-api  --  NestJS 2  --  DATABASE B',
    line,
    `  listening   : http://localhost:${port}`,
    `  cors origin : ${corsOrigin}   (agent-workspace-web only)`,
    `  database    : ${process.env.DB_PATH?.trim() || DEFAULT_DB_PATH}   (DATABASE B -- separate file from gateway.db)`,
    `  issuer      : ${process.env.ISSUER}`,
    `  audience    : ${process.env.AUDIENCE}`,
    `  jwks        : ${process.env.JWKS_URI}`,
    '  scope       : access_as_user  (required)',
    `  agent-api   : ${process.env.AGENT_API_URL ?? 'http://localhost:8000'}   (internal; X-Internal-Secret only, NO user JWT)`,
    `  ${'-'.repeat(70)}`,
    '  routes      : GET  /me         guarded -- identity + local row (database "B")',
    '                GET  /analyses   guarded -- scoped to local user id',
    '                POST /analyses   guarded -- scoped to local user id',
    `  ${'-'.repeat(70)}`,
    '  identity is the (tid, oid) claim pair. JIT find-or-create on first call.',
    '  ISSUER / AUDIENCE / JWKS_URI must be byte-identical in identity-gateway-api.',
    '  src/auth/ is a verbatim copy of identity-gateway-api/src/auth/.',
    line,
  ].join('\n');
  logger.log(`\n${banner}`);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[agent-workspace-api] failed to start:', error);
  process.exit(1);
});
