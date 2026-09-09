/**
 * DATABASE B -- document_analyses table. SPEC.txt 4.5 (and Section 1,
 * "Database B: users, document_analyses / Analisis AI mock").
 *
 * `userId` points at users.id in THIS database. It is a local foreign key and
 * nothing else: it does not, and must not, carry tid/oid, and it has no
 * relationship whatsoever to any row in gateway.db (DATABASE A). The same
 * human is a different integer here than there, and that is the proof.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AnalysisResult } from '../agent/agent.client';
import { User } from '../users/user.entity';

@Entity({ name: 'document_analyses' })
@Index('IDX_document_analyses_userId', ['userId'])
export class Analysis {
  @PrimaryGeneratedColumn('increment')
  id: number;

  /** FK -> users.id, LOCAL to DATABASE B. The only key data is scoped by. */
  @Column({ type: 'integer' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** The text that was sent across the internal boundary, verbatim. */
  @Column({ type: 'text' })
  inputText: string;

  /**
   * The agent-api response, stored as JSON.
   *
   * `simple-json` is TypeORM's JSON column for SQLite: the object is
   * serialised to a text column and parsed back on read, so `result` is a real
   * object in application code. SQLite has no native JSON column type, and
   * inventing one would break `synchronize: true`.
   *
   * Note what is NOT stored alongside it: no token, no claim. The link to the
   * person is `userId`, and `userId` is local.
   */
  @Column({ type: 'simple-json' })
  result: AnalysisResult;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
