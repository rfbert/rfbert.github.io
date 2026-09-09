/**
 * Analyses, DATABASE B.
 *
 * THE DATA-ISOLATION CLAIM LIVES HERE. Every method takes a `userId` -- the
 * LOCAL primary key resolved by UsersService.findOrCreate (step 7) -- and every
 * query filters on it. No method accepts a tid, an oid or a raw claim, so no
 * caller can accidentally scope a query by something that came off the wire.
 * SPEC.txt Section 8: "Scope every data query by the locally-resolved user id,
 * never by a claim directly."
 *
 * It is also where the two halves of SPEC.txt 4.5 meet: call AgentClient, then
 * persist the result against the local user. Note the ORDER -- the agent call
 * happens first and its result is awaited, so a failed internal call leaves no
 * half-written row behind.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AgentClient } from '../agent/agent.client';
import { Analysis } from './analysis.entity';

@Injectable()
export class AnalysesService {
  constructor(
    @InjectRepository(Analysis)
    private readonly analyses: Repository<Analysis>,
    private readonly agent: AgentClient,
  ) {}

  /** Every row this user owns, and by construction only those. */
  findAllForUser(userId: number): Promise<Analysis[]> {
    return this.analyses.find({
      where: { userId },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  /**
   * Step (7)'s payoff: analyse text over the internal boundary, then stamp the
   * result with the resolved local id -- not with a claim, and not with any id
   * that came from the other application.
   *
   * `userId` is passed in already resolved; this service never sees the token.
   */
  async create(userId: number, inputText: string): Promise<Analysis> {
    // Server-to-server. Only `inputText` crosses; no user identity (SPEC.txt 5.4).
    const result = await this.agent.analyze(inputText);

    return this.analyses.save(
      this.analyses.create({ userId, inputText, result }),
    );
  }
}
