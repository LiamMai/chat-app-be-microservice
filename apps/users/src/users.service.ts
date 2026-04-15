import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException, paginate, PageQueryDto, Role } from '@app/common';
import { UserEntity } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  findAll(query: PageQueryDto) {
    return paginate(this.userRepo, query, {
      select: ['id', 'email', 'name', 'role', 'isActive', 'createdAt', 'updatedAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      select: ['id', 'email', 'name', 'role', 'isActive', 'createdAt', 'updatedAt'],
    });
    if (!user) throw AppException.notFound('User not found');
    return user;
  }

  async updateProfile(dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw AppException.notFound('User not found');

    if (dto.name) user.name = dto.name;

    await this.userRepo.save(user);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safe } = user as UserEntity & { password: string };
    return safe;
  }

  async banUser(dto: BanUserDto) {
    const target = await this.userRepo.findOne({ where: { id: dto.targetUserId } });
    if (!target) throw AppException.notFound('User not found');

    // Can't ban another SUPER_ADMIN or ADMIN (only SUPER_ADMIN can, handled at guard level)
    if (target.role === Role.SUPER_ADMIN) {
      throw AppException.forbidden('Cannot ban a super admin');
    }

    target.isActive = !dto.ban;
    await this.userRepo.save(target);

    return { userId: target.id, isActive: target.isActive };
  }

  async assignRole(dto: AssignRoleDto) {
    const target = await this.userRepo.findOne({ where: { id: dto.targetUserId } });
    if (!target) throw AppException.notFound('User not found');

    // Prevent demoting self
    if (dto.targetUserId === dto.requesterId) {
      throw AppException.badRequest('Cannot change your own role');
    }

    target.role = dto.role;
    await this.userRepo.save(target);

    return { userId: target.id, role: target.role };
  }
}
