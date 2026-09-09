/**
 * Conversations, DATABASE A.
 *
 * THE DATA-ISOLATION CLAIM LIVES HERE. Every method takes a `userId` -- the
 * LOCAL primary key resolved by UsersService.findOrCreate -- and every query
 * filters on it. No method accepts a tid, an oid or a raw claim, so no caller
 * can accidentally scope a query by something that came off the wire.
 * SPEC.txt Section 8: "Scope every data query by the locally-resolved user id,
 * never by a claim directly."
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Conversation } from './conversation.entity';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
  ) {}

  /** Every row this user owns, and by construction only those. */
  findAllForUser(userId: number): Promise<Conversation[]> {
    return this.conversations.find({
      where: { userId },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  /** The new row is stamped with the resolved local id, not with a claim. */
  create(userId: number, title: string): Promise<Conversation> {
    return this.conversations.save(
      this.conversations.create({ userId, title }),
    );
  }
}
