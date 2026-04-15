import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { USERS_PATTERNS } from '@app/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern(USERS_PATTERNS.FIND_ALL)
  findAll(@Payload() dto: { page?: number; limit?: number }) {
    return this.usersService.findAll(dto);
  }

  @MessagePattern(USERS_PATTERNS.FIND_BY_ID)
  findById(@Payload() { id }: { id: string }) {
    return this.usersService.findById(id);
  }

  @MessagePattern(USERS_PATTERNS.UPDATE_PROFILE)
  updateProfile(@Payload() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(dto);
  }

  @MessagePattern(USERS_PATTERNS.BAN_USER)
  banUser(@Payload() dto: BanUserDto) {
    return this.usersService.banUser(dto);
  }

  @MessagePattern(USERS_PATTERNS.ASSIGN_ROLE)
  assignRole(@Payload() dto: AssignRoleDto) {
    return this.usersService.assignRole(dto);
  }
}
