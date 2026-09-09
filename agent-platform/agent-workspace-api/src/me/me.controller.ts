/**
 * GET /me -- identity, with no side effects beyond the JIT provisioning that
 * every guarded route performs anyway.
 *
 * This is the cleanest evidence for acceptance test 5: hit :4000/me and
 * :4001/me with the SAME token and compare. tid and oid come back identical
 * (one identity, one login), `id` differs freely and `database` differs by
 * definition (two independent stores). Nothing here is a second code path --
 * it is the same guard, the same strategy and the same findOrCreate as
 * /analyses.
 *
 * The mirror of identity-gateway-api's /me, differing in exactly one constant.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';

import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';

/**
 * Which of the two independent databases answered. DATABASE B is workspace.db.
 * identity-gateway-api reports "A" from gateway.db.
 */
const DATABASE_LABEL = 'B';

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
    // (7) JIT find-or-create, then return the LOCAL row -- not the claims.
    // The difference matters: what comes back is proof that this database
    // provisioned this identity itself, from the token alone, with no help
    // from identity-gateway-api.
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
