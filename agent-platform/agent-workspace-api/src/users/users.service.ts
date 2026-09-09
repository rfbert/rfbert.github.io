/**
 * STEP (7) of SPEC.txt Section 2: JIT find-or-create in DATABASE B.
 *
 * "agent-workspace-api validates that same JWT using the SAME issuer, audience
 *  and JWKS, then performs ITS OWN JIT find-or-create in DATABASE B, keyed on
 *  the same (tid, oid). Two user rows now exist, in two databases, never joined
 *  at the database level."
 *
 * This is deliberately the same logic as identity-gateway-api's step (4),
 * running against a different file. There is no token exchange, no user sync,
 * no provisioning call between the two applications: the token alone is enough
 * for this service to materialise its own row the first time it sees a valid
 * (tid, oid) pair.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthUser } from '../auth/current-user.decorator';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /**
   * Resolve the claims pair to a local row, creating it on first sight.
   *
   * Race safety: the (tid, oid) unique index is the real guard. Two requests
   * that both miss the SELECT will both try to INSERT; the database rejects
   * one, and that loser re-reads the winner's row instead of failing the
   * request. Application-level checking alone could not do this.
   */
  async findOrCreate(tid: string, oid: string, name: string): Promise<User> {
    const existing = await this.users.findOne({ where: { tid, oid } });
    if (existing) {
      // Display name is metadata: refresh it, but never re-key on it.
      if (name && existing.displayName !== name) {
        existing.displayName = name;
        await this.users.save(existing);
      }
      return existing;
    }

    try {
      const created = await this.users.save(
        this.users.create({ tid, oid, displayName: name }),
      );
      this.logger.log(
        `JIT provisioned user id=${created.id} tid=${tid} oid=${oid} into DATABASE B`,
      );
      return created;
    } catch (error) {
      // Lost the race: the unique index fired. The winner's row is the answer.
      const raced = await this.users.findOne({ where: { tid, oid } });
      if (raced) return raced;
      throw error;
    }
  }

  /** Convenience wrapper over the validated claims. */
  resolve(claims: AuthUser): Promise<User> {
    return this.findOrCreate(claims.tid, claims.oid, claims.name);
  }
}
