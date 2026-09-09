/**
 * ============================================================================
 * CANONICAL AUTH MODULE -- src/auth/jwt.strategy.ts
 *
 * SPEC.txt 4.3 / 4.5. This file is copied VERBATIM into agent-workspace-api.
 * "Their working without modification is a deliverable, not an accident."
 *
 * Two independent APIs, on different ports, with different databases, running
 * THIS EXACT FILE, must reach the same verdict about the same token. So it
 * contains no service name, no service-specific import, and no hard-coded
 * URL: its entire configuration is three environment variables.
 *
 *     JWKS_URI   where the issuer publishes its public keys
 *     ISSUER     the exact expected "iss" claim
 *     AUDIENCE   the exact expected "aud" claim
 *
 * These three MUST be byte-identical in both services (SPEC.txt 5.1). They are
 * read from the environment rather than injected through a config module
 * precisely so that dropping this folder into another Nest app requires no
 * wiring on the other side.
 * ============================================================================
 *
 * WHAT IS ENFORCED, AND WHY EACH CHECK IS LOAD-BEARING
 *
 *   1. RS256 signature, verified against the live JWKS at JWKS_URI, selecting
 *      the key by the token header's `kid`. Asymmetric on purpose: the APIs
 *      hold no secret and cannot mint tokens, only verify them.
 *      `algorithms: ['RS256']` is explicit -- without it a token could arrive
 *      with alg "none" or a symmetric alg and subvert verification.
 *   2. iss === ISSUER          (a valid token from elsewhere is not valid here)
 *   3. aud === AUDIENCE        (ONE app registration, ONE audience: 5.1)
 *   4. exp                     (ignoreExpiration:false -- expiry drives the
 *                               renewal handshake in acceptance test 6)
 *   5. scp contains "access_as_user"  (SPEC.txt 5.2: "both APIs must require
 *                               this"). A token minted for this audience but
 *                               without the delegated scope is NOT a user
 *                               session and is refused.
 *   6. tid AND oid both present. The whole model -- one identity, two
 *      databases, correlated only by this pair -- collapses without it, so a
 *      token missing either claim is refused rather than silently provisioning
 *      a junk row.
 *
 * Checks 1-4 are done by passport-jwt/jsonwebtoken before validate() is ever
 * called; checks 5-6 are done here. Anything that throws becomes a 401.
 */
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

import { AuthUser } from './current-user.decorator';

/** SPEC.txt 5.2 -- the delegated scope both APIs require. */
const REQUIRED_SCOPE = 'access_as_user';

/** The claims this strategy cares about. Everything else is ignored. */
interface JwtClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  tid?: unknown;
  oid?: unknown;
  name?: unknown;
  preferred_username?: unknown;
  /** Space-delimited string (Entra v2) or an array (some issuers). */
  scp?: unknown;
  exp?: number;
  iat?: number;
}

/**
 * Read a required environment variable, or fail loudly at startup.
 *
 * Deliberately fatal: a missing ISSUER/AUDIENCE would otherwise turn into
 * "accepts any issuer" or "accepts any audience", which is a security hole
 * that looks exactly like a working service.
 */
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `[auth] Missing required environment variable ${name}. ` +
        'JWKS_URI, ISSUER and AUDIENCE must be set, and must be byte-identical ' +
        'in every API that validates this token (SPEC.txt 5.1).',
    );
  }
  return value.trim();
}

/** Normalise a claim that may be a string or an array of strings. */
function toStringClaim(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * True when the token carries the required delegated scope.
 *
 * `scp` may be:
 *   - a space-delimited string:  "access_as_user User.Read"
 *   - an array of strings:       ["access_as_user", "User.Read"]
 * Both forms are accepted; the match is exact per-entry, so a scope merely
 * *containing* the substring (e.g. "no_access_as_user") does not pass.
 */
function hasRequiredScope(scp: unknown): boolean {
  const entries: string[] = [];

  if (typeof scp === 'string') {
    entries.push(...scp.split(/\s+/));
  } else if (Array.isArray(scp)) {
    for (const item of scp) {
      if (typeof item === 'string') entries.push(...item.split(/\s+/));
    }
  }

  return entries.some((entry) => entry.trim() === REQUIRED_SCOPE);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private static readonly logger = new Logger('JwtStrategy');

  constructor() {
    const jwksUri = requiredEnv('JWKS_URI');
    const issuer = requiredEnv('ISSUER');
    const audience = requiredEnv('AUDIENCE');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Expiry is enforced. The 120s token lifetime is what makes the silent
      // renewal handshake observable (SPEC.txt 4.1, acceptance test 6).
      ignoreExpiration: false,
      algorithms: ['RS256'],
      issuer,
      audience,
      // jwks-rsa fetches the signing key by `kid` from the issuer's JWKS.
      // cache: survive the 120s token churn without a network call per request.
      // rateLimit: an attacker sending random `kid`s cannot turn this API into
      // an amplifier against the IdP.
      secretOrKeyProvider: passportJwtSecret({
        jwksUri,
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 10 * 60 * 1000, // 10 minutes
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        timeout: 5000,
      }),
    });

    JwtStrategy.logger.log(
      `validating RS256 bearer tokens  iss=${issuer}  aud=${audience}  ` +
        `jwks=${jwksUri}  required scope=${REQUIRED_SCOPE}`,
    );
  }

  /**
   * Runs only after signature, issuer, audience and expiry have already passed.
   * Returns the value that `@CurrentUser()` will hand to controllers.
   *
   * It returns claims and NOTHING ELSE -- no database access happens here.
   * Turning claims into a local row is each service's own JIT step (4)/(7),
   * against its own database.
   */
  validate(payload: JwtClaims): AuthUser {
    if (!hasRequiredScope(payload.scp)) {
      throw new UnauthorizedException(
        `Token does not carry the required scope "${REQUIRED_SCOPE}".`,
      );
    }

    const tid = toStringClaim(payload.tid);
    const oid = toStringClaim(payload.oid);

    // The stable identity is the PAIR. Half of it is not an identity.
    if (!tid || !oid) {
      throw new UnauthorizedException(
        'Token is missing the stable identity claims (tid and oid are both required).',
      );
    }

    // Display metadata only, never a key. Falls back so a nameless token still
    // authenticates -- it is the pair above that has to be right.
    const name =
      toStringClaim(payload.name) ??
      toStringClaim(payload.preferred_username) ??
      oid;

    return { tid, oid, name };
  }
}
