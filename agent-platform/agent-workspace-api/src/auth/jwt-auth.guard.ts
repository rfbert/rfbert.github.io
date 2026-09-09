/**
 * ============================================================================
 * CANONICAL AUTH MODULE -- src/auth/jwt-auth.guard.ts
 *
 * SPEC.txt 4.3 / 4.5. Copied verbatim into agent-workspace-api. Service-
 * agnostic by construction.
 * ============================================================================
 *
 * The only gate in front of user data. `AuthGuard('jwt')` runs the passport
 * strategy registered under the name 'jwt' -- JwtStrategy in this same folder
 * -- and rejects with 401 if it throws or returns nothing.
 */
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
