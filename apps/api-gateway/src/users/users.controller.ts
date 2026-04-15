import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, Permission, Permissions, Role, Roles } from '@app/common';
import { FindAllQueryDto, UpdateProfileDto, BanUserDto, AssignRoleDto } from './dto/request.dto';
import { PaginatedUsersDto, UserDto } from './dto/response.dto';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@ApiExtraModels(UserDto, PaginatedUsersDto)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(PermissionsGuard)
  @Roles(Role.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List all users (ADMIN+)' })
  @ApiOkResponse({ type: PaginatedUsersDto })
  @ApiForbiddenResponse({ description: 'ADMIN role required' })
  findAll(@Query() query: FindAllQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  @ApiOkResponse({ type: UserDto })
  getMe(@CurrentUser('userId') userId: string) {
    return this.usersService.findById(userId);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get user by ID (ADMIN+)' })
  @ApiOkResponse({ type: UserDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiForbiddenResponse({ description: 'ADMIN role required' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update own profile' })
  @ApiOkResponse({ type: UserDto })
  updateMe(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @UseGuards(PermissionsGuard)
  @Permissions(Permission.USERS_BAN)
  @Patch(':id/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ban or unban a user (ADMIN+)' })
  @ApiOkResponse({ description: '{ userId, isActive }' })
  @ApiForbiddenResponse({ description: 'USERS_BAN permission required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  banUser(
    @Param('id', ParseUUIDPipe) targetUserId: string,
    @CurrentUser('userId') requesterId: string,
    @Body() dto: BanUserDto,
  ) {
    return this.usersService.banUser(targetUserId, requesterId, dto);
  }

  @UseGuards(PermissionsGuard)
  @Roles(Role.SUPER_ADMIN)
  @Patch(':id/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign role to user (SUPER_ADMIN only)' })
  @ApiOkResponse({ description: '{ userId, role }' })
  @ApiForbiddenResponse({ description: 'SUPER_ADMIN role required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  assignRole(
    @Param('id', ParseUUIDPipe) targetUserId: string,
    @CurrentUser('userId') requesterId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.assignRole(targetUserId, requesterId, dto);
  }
}
