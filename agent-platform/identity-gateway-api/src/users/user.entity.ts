/**
 * DATABASE A -- users table.  SPEC.txt 4.3.
 *
 * agent-workspace-api has a table that looks much like this one, in a
 * DIFFERENT FILE (workspace.db). The two are never joined, share no foreign
 * key, and their `id` columns are unrelated number spaces. The only thing that
 * correlates a row here with a row there is the (tid, oid) pair carried in the
 * token -- SPEC.txt Section 0.3 and Section 8.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'users' })
// THE UNIQUE COMPOSITE INDEX IS REQUIRED (SPEC.txt 4.3).
// It is what makes the JIT find-or-create idempotent: two concurrent requests
// carrying the same token cannot produce two rows, because the second INSERT
// is rejected by the database rather than merely by application logic.
@Index('UQ_users_tid_oid', ['tid', 'oid'], { unique: true })
export class User {
  /**
   * LOCAL primary key. Meaningful only inside DATABASE A. Every other table in
   * this database references the user through this id -- never through a claim.
   */
  @PrimaryGeneratedColumn('increment')
  id: number;

  /** Tenant id claim -- join key part 1. Immutable for the life of the row. */
  @Column({ type: 'text' })
  tid: string;

  /** Object id claim -- join key part 2. Immutable for the life of the row. */
  @Column({ type: 'text' })
  oid: string;

  /** Display metadata, refreshed from the token. Never used to look a user up. */
  @Column({ type: 'text' })
  displayName: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
