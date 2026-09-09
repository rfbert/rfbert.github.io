/**
 * GET  /conversations   - list this user's conversations
 * POST /conversations   - create one
 *
 * Both guarded. The sequence in every handler is the architecture in miniature:
 *
 *     token -> validated claims (tid, oid)     [JwtAuthGuard + JwtStrategy]
 *           -> LOCAL user row in DATABASE A    [UsersService.findOrCreate = (4)]
 *           -> query scoped by user.id         [never by a claim]
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
import { Conversation } from './conversation.entity';
import { ConversationsService } from './conversations.service';

const MAX_TITLE_LENGTH = 200;

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(
    private readonly users: UsersService,
    private readonly conversations: ConversationsService,
  ) {}

  @Get()
  async list(@CurrentUser() claims: AuthUser): Promise<Conversation[]> {
    // (4) JIT: a GET is enough to provision. Acceptance test 3 relies on this.
    const user = await this.users.resolve(claims);
    return this.conversations.findAllForUser(user.id);
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() claims: AuthUser,
    @Body() body: { title?: unknown },
  ): Promise<Conversation> {
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title) {
      throw new BadRequestException('title is required and must be a non-empty string');
    }
    if (title.length > MAX_TITLE_LENGTH) {
      throw new BadRequestException(`title must be at most ${MAX_TITLE_LENGTH} characters`);
    }

    const user = await this.users.resolve(claims);
    return this.conversations.create(user.id, title);
  }
}
