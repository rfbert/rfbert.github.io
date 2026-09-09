/**
 * ============================================================================
 * CANONICAL AUTH MODULE -- src/auth/auth.module.ts
 *
 * SPEC.txt 4.3 / 4.5. Copied verbatim into agent-workspace-api.
 * ============================================================================
 *
 * Wires PassportModule to JwtStrategy and exports both, so any feature module
 * that imports AuthModule can put JwtAuthGuard on a route.
 *
 * Deliberately has NO forRoot()/register() options and reads no service-
 * specific configuration: the strategy is driven purely by the environment
 * (JWKS_URI / ISSUER / AUDIENCE). That is what makes this folder droppable
 * into a second, independent API without a single edit.
 */
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [JwtStrategy],
  exports: [PassportModule, JwtStrategy],
})
export class AuthModule {}
