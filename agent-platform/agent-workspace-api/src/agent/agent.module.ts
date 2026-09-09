import { Module } from '@nestjs/common';

import { AgentClient } from './agent.client';

/**
 * The internal boundary, packaged. Exports AgentClient so AnalysesModule can
 * inject it; imports nothing -- in particular nothing from auth or users, so
 * there is no path by which a user identity could reach it.
 */
@Module({
  providers: [AgentClient],
  exports: [AgentClient],
})
export class AgentModule {}
