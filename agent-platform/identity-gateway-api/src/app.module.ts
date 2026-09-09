/**
 * identity-gateway-api -- NestJS 1, port 4000, DATABASE A.
 *
 * TypeORM (its own SQLite file) + the canonical AuthModule + the feature
 * modules. Note what is absent: no session store, no token cache, no link to
 * agent-workspace-api. This service knows nothing about the other application.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { ConversationsModule } from './conversations/conversations.module';
import { buildDataSourceOptions } from './database/data-source';
import { MeModule } from './me/me.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: buildDataSourceOptions }),
    AuthModule,
    UsersModule,
    ConversationsModule,
    MeModule,
  ],
})
export class AppModule {}
