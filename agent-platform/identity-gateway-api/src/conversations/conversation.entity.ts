/**
 * DATABASE A -- conversations table. SPEC.txt 4.3.
 *
 * `userId` points at users.id in THIS database. It is a local foreign key and
 * nothing else: it does not, and must not, carry tid/oid, and it has no
 * relationship whatsoever to any row in workspace.db (DATABASE B).
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

import { User } from '../users/user.entity';

@Entity({ name: 'conversations' })
@Index('IDX_conversations_userId', ['userId'])
export class Conversation {
  @PrimaryGeneratedColumn('increment')
  id: number;

  /** FK -> users.id, LOCAL to DATABASE A. The only key data is scoped by. */
  @Column({ type: 'integer' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'text' })
  title: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
