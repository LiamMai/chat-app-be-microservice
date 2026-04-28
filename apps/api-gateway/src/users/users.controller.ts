import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, Permission, Permissions, Role, Roles } from '@app/common';
import {
  FindAllQueryDto,
  SearchUsersQueryDto,
  UpdateProfileDto,
  BanUserDto,
  AssignRoleDto,
} from './dto/request.dto';
import { PaginatedUsersDto, UserDto } from './dto/response.dto';

const IMAGE_MIME_REGEX = /^image\/(jpeg|png|webp)$/;
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;   // 5 MB
const COVER_MAX_BYTES  = 10 * 1024 * 1024;  // 10 MB

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

  @Get('search')
  @ApiOperation({ summary: 'Search users by name, email, or username' })
  @ApiOkResponse({ type: PaginatedUsersDto })
  searchUsers(@Query() query: SearchUsersQueryDto) {
    return this.usersService.searchUsers(query);
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

  @Patch('me/avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: AVATAR_MAX_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload profile avatar (JPEG / PNG / WebP, max 5 MB)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({ description: '{ userId, avatarUrl }' })
  updateAvatar(
    @CurrentUser('userId') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: AVATAR_MAX_BYTES }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    this.validateImageMime(file);
    return this.usersService.updateAvatar(userId, file);
  }

  @Patch('me/cover')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: COVER_MAX_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload cover photo (JPEG / PNG / WebP, max 10 MB)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({ description: '{ userId, coverUrl }' })
  updateCover(
    @CurrentUser('userId') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: COVER_MAX_BYTES }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    this.validateImageMime(file);
    return this.usersService.updateCover(userId, file);
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

  private validateImageMime(file: Express.Multer.File) {
    if (!IMAGE_MIME_REGEX.test(file.mimetype)) {
      throw new BadRequestException('File must be JPEG, PNG, or WebP');
    }
  }
}
