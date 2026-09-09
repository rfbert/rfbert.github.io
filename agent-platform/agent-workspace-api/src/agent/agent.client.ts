/**
 * ============================================================================
 * THE INTERNAL BOUNDARY -- agent-workspace-api  ->  agent-api  (FastAPI :8000)
 *
 * SPEC.txt 4.5, 5.4 and Section 8. This file is where the scaffold's strongest
 * negative claim lives: "Do not forward the user JWT to agent-api."
 * ============================================================================
 *
 * THE CONTRACT (SPEC.txt 5.4), in full:
 *
 *     POST ${AGENT_API_URL}/analyze
 *     X-Internal-Secret: <INTERNAL_SECRET>
 *     { "text": "..." }
 *
 *     "No user identity crosses this boundary."
 *
 * HOW THAT IS ENFORCED HERE, in order of how hard it is to break:
 *
 *   1. STRUCTURALLY, BY THE SIGNATURE. `analyze()` takes a single string. It
 *      never receives the Request, the Authorization header, an AuthUser, a
 *      tid, an oid or a local user id -- so there is no token in scope to
 *      forward even by accident. This is the real defence; everything below is
 *      a backstop for a future edit.
 *
 *   2. THE HEADER SET IS A CLOSED LITERAL. Headers are built fresh for every
 *      call from the constant below. There is no merge with caller-supplied
 *      headers, no `...extraHeaders`, no per-request override -- the usual way
 *      an Authorization header leaks into a downstream call is a spread of
 *      incoming headers, and there is nowhere here to spread one into.
 *
 *   3. A RUNTIME ASSERTION, EVERY CALL. assertNoIdentityHeaders() inspects the
 *      outgoing header names and throws before the socket is opened if any
 *      identity-bearing header (authorization, cookie, proxy-authorization,
 *      x-forwarded-authorization, x-access-token, ...) is present. If someone
 *      later adds one, this service fails loudly instead of silently
 *      exfiltrating a user token to a service that has no business seeing it.
 *
 * Note also what is NOT sent: no user id, no tid, no oid, no display name.
 * agent-api receives text and returns an analysis; it is THIS service that
 * knows which local DATABASE B row the result belongs to, and persists it
 * there (see analyses.service.ts).
 */
import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

/** Shape returned by agent-api's POST /analyze (SPEC.txt 4.6, models.py). */
export interface AnalysisResult {
  summary: string;
  sentiment: string;
  tokens: number;
}

/** SPEC.txt 5.4 -- the one header that authenticates this call. */
const INTERNAL_SECRET_HEADER = 'X-Internal-Secret';

/** Defaults match .env / SPEC.txt 5.1. */
const DEFAULT_AGENT_API_URL = 'http://localhost:8000';

/** Server-to-server on localhost: a slow mock is a bug, not a network hiccup. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Header names that carry, or could carry, a user identity. None of these may
 * ever appear on a request to agent-api. Compared lower-cased.
 */
const FORBIDDEN_HEADERS: readonly string[] = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'x-forwarded-authorization',
  'x-forwarded-user',
  'x-access-token',
  'x-id-token',
  'x-user-token',
  'bearer',
];

/**
 * Fail loudly at boot for a missing required value, rather than quietly
 * sending an empty secret and getting an unexplained 403 at request time.
 */
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `[agent] Missing required environment variable ${name}. ` +
        'agent-workspace-api authenticates to agent-api with INTERNAL_SECRET ' +
        'and nothing else (SPEC.txt 5.4).',
    );
  }
  return value.trim();
}

/** Backstop for defence 3 above. Throws rather than stripping: silence hides bugs. */
function assertNoIdentityHeaders(headers: Record<string, string>): void {
  for (const name of Object.keys(headers)) {
    if (FORBIDDEN_HEADERS.includes(name.toLowerCase())) {
      throw new Error(
        `[agent] Refusing to call agent-api: outgoing header "${name}" carries a ` +
          'user identity. SPEC.txt Section 8 -- "Do not forward the user JWT to ' +
          'agent-api." No user identity crosses this boundary.',
      );
    }
  }
}

/** Narrow the untrusted JSON body to the documented response shape. */
function parseAnalysisResult(body: unknown): AnalysisResult {
  if (typeof body !== 'object' || body === null) {
    throw new BadGatewayException('agent-api returned a non-object body.');
  }
  const candidate = body as Record<string, unknown>;
  if (
    typeof candidate.summary !== 'string' ||
    typeof candidate.sentiment !== 'string' ||
    typeof candidate.tokens !== 'number'
  ) {
    throw new BadGatewayException(
      'agent-api response does not match the AnalyzeResponse contract ' +
        '{ summary: string, sentiment: string, tokens: number }.',
    );
  }
  return {
    summary: candidate.summary,
    sentiment: candidate.sentiment,
    tokens: candidate.tokens,
  };
}

@Injectable()
export class AgentClient {
  private readonly logger = new Logger(AgentClient.name);

  private readonly baseUrl: string;
  private readonly internalSecret: string;

  constructor() {
    this.baseUrl = (
      process.env.AGENT_API_URL?.trim() || DEFAULT_AGENT_API_URL
    ).replace(/\/+$/, '');
    // Read once, held privately, never logged and never returned.
    this.internalSecret = requiredEnv('INTERNAL_SECRET');

    this.logger.log(
      `internal boundary -> ${this.baseUrl}/analyze  ` +
        `auth=${INTERNAL_SECRET_HEADER} (server-to-server; no user JWT is forwarded)`,
    );
  }

  /**
   * POST /analyze.
   *
   * @param text the ONLY thing that crosses this boundary.
   */
  async analyze(text: string): Promise<AnalysisResult> {
    const url = `${this.baseUrl}/analyze`;

    // A closed literal (defence 2). Nothing is merged into this object.
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      [INTERNAL_SECRET_HEADER]: this.internalSecret,
    };

    // Defence 3: checked on every call, before the request leaves.
    assertNoIdentityHeaders(headers);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ServiceUnavailableException(
        `agent-api is unreachable at ${url} (${reason}). Start it with: ` +
          'uvicorn main:app --port 8000',
      );
    }

    if (!response.ok) {
      // 403 here means the secret does not match agent-api's INTERNAL_SECRET.
      // The secret itself is never included in the message.
      throw new BadGatewayException(
        `agent-api returned ${response.status} ${response.statusText} for POST /analyze.` +
          (response.status === 403
            ? ` Check that INTERNAL_SECRET matches agent-api's (${INTERNAL_SECRET_HEADER}).`
            : ''),
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new BadGatewayException('agent-api returned a body that is not JSON.');
    }

    return parseAnalysisResult(body);
  }
}
