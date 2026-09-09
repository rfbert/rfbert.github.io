/**
 * GET  /analyses   - list this user's analyses
 * POST /analyses   - analyse text via agent-api and store the result
 *
 * Both guarded. The sequence in every handler is the architecture in miniature,
 * and it is byte-for-byte the same shape as identity-gateway-api's
 * /conversations -- because the auth folder driving it is byte-for-byte the
 * same folder:
 *
 *     token -> validated claims (tid, oid)     [JwtAuthGuard + JwtStrategy]
 *           -> LOCAL user row in DATABASE B    [UsersService.findOrCreate = (7)]
 *           -> query scoped by user.id         [never by a claim]
 *
 * POST adds one step between the second and third: the internal call to
 * agent-api, which the user's token does NOT accompany.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { Analysis } from './analysis.entity';
import { AnalysesService } from './analyses.service';

const MAX_INPUT_LENGTH = 10_000;

@Controller('analyses')
@UseGuards(JwtAuthGuard)
export class AnalysesController {
  constructor(
    private readonly users: UsersService,
    private readonly analyses: AnalysesService,
  ) {}

  @Get()
  async list(@CurrentUser() claims: AuthUser): Promise<Analysis[]> {
    // (7) JIT: a GET is enough to provision. Acceptance test 5 relies on this.
    const user = await this.users.resolve(claims);
    return this.analyses.findAllForUser(user.id);
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() claims: AuthUser,
    @Body() body: { text?: unknown; inputText?: unknown },
  ): Promise<Analysis> {
    // Accepts `text` (the agent-api field name) or `inputText` (the column
    // name), so a caller that knows either side of the boundary is not wrong.
    const raw = typeof body?.text === 'string' ? body.text : body?.inputText;
    const inputText = typeof raw === 'string' ? raw.trim() : '';

    if (!inputText) {
      throw new BadRequestException('text is required and must be a non-empty string');
    }
    if (inputText.length > MAX_INPUT_LENGTH) {
      throw new BadRequestException(`text must be at most ${MAX_INPUT_LENGTH} characters`);
    }

    const user = await this.users.resolve(claims);
    return this.analyses.create(user.id, inputText);
  }
}
