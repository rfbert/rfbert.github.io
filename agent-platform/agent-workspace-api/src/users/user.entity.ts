/**
 * DATABASE B -- users table.  SPEC.txt 4.5.
 *
 * "Its own users table. Same (tid, oid) unique index. Different database file."
 *
 * identity-gateway-api has a table that looks much like this one, in a
 * DIFFERENT FILE (gateway.db). The two are never joined, share no foreign key,
 * and their `id` columns are unrelated number spaces -- the row for Ada may be
 * id=1 there and id=7 here, or the other way round, and nothing anywhere cares.
 * The only thing that correlates a row here with a row there is the (tid, oid)
 * pair carried in the token -- SPEC.txt Section 0.3 and Section 8:
 * "Do not share a database, a users table, or a foreign key between the two
 * applications."
 *
 * This file is intentionally NOT imported from the other service and not
 * published as a shared package. Duplication is the design.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'users' })
// THE UNIQUE COMPOSITE INDEX IS REQUIRED (SPEC.txt 4.5, mirroring 4.3).
// It is what makes the JIT find-or-create idempotent: two concurrent requests
// carrying the same token cannot produce two rows, because the second INSERT
// is rejected by the database rather than merely by application logic.
@Index('UQ_users_tid_oid', ['tid', 'oid'], { unique: true })
export class User {
  /**
   * LOCAL primary key. Meaningful only inside DATABASE B. Every other table in
   * this database references the user through this id -- never through a claim,
   * and never through identity-gateway-api's id for the same person.
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
