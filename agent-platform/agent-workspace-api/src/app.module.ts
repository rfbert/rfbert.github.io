/**
 * agent-workspace-api -- NestJS 2, port 4001, DATABASE B.
 *
 * TypeORM (its own SQLite file) + the canonical AuthModule + the feature
 * modules. Note what is absent: no session store, no token cache, no link to
 * identity-gateway-api. This service knows nothing about the other
 * application -- not its URL, not its database, not its user ids. All it has
 * is the same three environment values and the same auth folder, and that is
 * enough to accept the same token.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AnalysesModule } from './analyses/analyses.module';
import { AuthModule } from './auth/auth.module';
import { buildDataSourceOptions } from './database/data-source';
import { MeModule } from './me/me.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: buildDataSourceOptions }),
    AuthModule,
    UsersModule,
    AnalysesModule,
    MeModule,
  ],
})
export class AppModule {}
