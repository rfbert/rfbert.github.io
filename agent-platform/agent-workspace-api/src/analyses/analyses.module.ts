import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentModule } from '../agent/agent.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { Analysis } from './analysis.entity';
import { AnalysesController } from './analyses.controller';
import { AnalysesService } from './analyses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Analysis]),
    AuthModule,
    UsersModule,
    AgentModule,
  ],
  controllers: [AnalysesController],
  providers: [AnalysesService],
})
export class AnalysesModule {}
