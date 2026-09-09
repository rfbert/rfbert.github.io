/**
 * ============================================================================
 * CANONICAL AUTH MODULE -- src/auth/current-user.decorator.ts
 *
 * SPEC.txt 4.3 / 4.5. This directory is shared VERBATIM between
 * identity-gateway-api (DATABASE A) and agent-workspace-api (DATABASE B).
 * Nothing in it may reference either service. Its only configuration is the
 * environment: JWKS_URI, ISSUER, AUDIENCE.
 * ============================================================================
 *
 * The identity carried by a validated token.
 *
 * `tid` + `oid` is THE STABLE IDENTITY (SPEC.txt Section 2, step 2): the
 * correlation key across both applications. Not email, not `sub`, not `name`.
 * `name` is display metadata only and must never be used as a key.
 *
 * NOTE THE SHAPE OF THIS TYPE: it deliberately does NOT contain a local
 * database id. A claim is not a user row. Controllers must exchange this for a
 * locally-resolved user (findOrCreate) and scope every query by that local id
 * -- see SPEC.txt Section 8, "Scope every data query by the locally-resolved
 * user id, never by a claim directly."
 */
export interface AuthUser {
  /** Tenant id claim -- join key part 1. */
  tid: string;
  /** Object id claim -- join key part 2. */
  oid: string;
  /** Display name. Metadata only; never a key. */
  name: string;
}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * `@CurrentUser()` -- the AuthUser that JwtStrategy.validate() returned.
 *
 * Only meaningful on a route protected by JwtAuthGuard; on an unguarded route
 * Passport never runs and this resolves to undefined.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    return request.user as AuthUser;
  },
);
