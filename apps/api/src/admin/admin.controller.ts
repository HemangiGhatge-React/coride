import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ListUsersQueryDto, UpdateRoleDto } from './admin.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('users')
  listUsers(
    // Local pipe with transform so ?page=2 arrives as a number.
    @Query(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    query: ListUsersQueryDto,
  ) {
    return this.admin.listUsers(query);
  }

  @Patch('users/:id/role')
  updateRole(
    @Req() req: { user: { userId: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRoleDto,
  ) {
    return this.admin.updateRole(req.user.userId, id, body.role);
  }

  @Get('users/:id/sessions')
  listSessions(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.listSessions(id);
  }

  @Post('users/:id/revoke-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAll(@Param('id', ParseUUIDPipe) id: string) {
    await this.admin.revokeAllSessions(id);
  }

  @Delete('sessions/:familyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(@Param('familyId', ParseUUIDPipe) familyId: string) {
    await this.admin.revokeSession(familyId);
  }
}
