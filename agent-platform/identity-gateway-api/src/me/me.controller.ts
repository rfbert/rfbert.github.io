/**
 * GET /me -- identity, with no side effects beyond the JIT provisioning that
 * every guarded route performs anyway.
 *
 * This is the cleanest evidence for acceptance tests 3 and 5: hit :4000/me and
 * :4001/me with the SAME token and compare. tid and oid come back identical
 * (one identity), `id` differs freely and `database` differs by definition
 * (two independent stores). Nothing here is a second code path -- it is the
 * same guard, the same strategy and the same findOrCreate as /conversations.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';

import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';

/**
 * Which of the two independent databases answered. DATABASE A is gateway.db.
 * agent-workspace-api reports "B" from workspace.db.
 */
const DATABASE_LABEL = 'A';

export interface MeResponse {
  id: number;
  tid: string;
  oid: string;
  displayName: string;
  createdAt: Date;
  database: string;
}

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async me(@CurrentUser() claims: AuthUser): Promise<MeResponse> {
    // (4) JIT find-or-create, then return the LOCAL row -- not the claims.
    // The difference matters: what comes back is proof that this database
    // provisioned this identity itself.
    const user = await this.users.resolve(claims);

    return {
      id: user.id,
      tid: user.tid,
      oid: user.oid,
      displayName: user.displayName,
      createdAt: user.createdAt,
      database: DATABASE_LABEL,
    };
  }
}
