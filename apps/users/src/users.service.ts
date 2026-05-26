import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { AppException, Gender, paginate, PageQueryDto, Role } from '@app/common';
import { UserEntity } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { SearchUsersDto } from './dto/search-users.dto';

const PROFILE_SELECT: (keyof UserEntity)[] = [
  'id', 'email', 'firstName', 'lastName', 'role', 'isActive',
  'username', 'bio', 'gender', 'birthdate', 'location', 'website',
  'avatarUrl', 'coverUrl',
  'createdAt', 'updatedAt',
];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  findAll(query: PageQueryDto) {
    return paginate(this.userRepo, query, {
      select: PROFILE_SELECT,
      order: { createdAt: 'DESC' },
    });
  }

  searchUsers(dto: SearchUsersDto) {
    const term = `%${dto.q}%`;
    return paginate(this.userRepo, dto, {
      select: ['id', 'email', 'firstName', 'lastName', 'username', 'avatarUrl', 'role', 'createdAt'],
      where: [
        { firstName: ILike(term), isActive: true },
        { lastName: ILike(term), isActive: true },
        { email: ILike(term), isActive: true },
        { username: ILike(term), isActive: true },
      ],
      order: { firstName: 'ASC' },
    });
  }

  findByIds(ids: string[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.userRepo.find({
      where: { id: In(ids) },
      select: ['id', 'email', 'firstName', 'lastName', 'username', 'avatarUrl'],
    });
  }

  async findById(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      select: PROFILE_SELECT,
    });
    if (!user) throw AppException.notFound('User not found');
    return user;
  }

  async updateProfile(dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw AppException.notFound('User not found');

    if (dto.username !== undefined) {
      if (dto.username) {
        const taken = await this.userRepo.findOne({
          where: { username: dto.username },
          select: ['id'],
        });
        if (taken && taken.id !== dto.userId) throw AppException.conflict('Username already taken');
      }
      user.username = dto.username || null;
    }

    if (dto.firstName !== undefined && dto.firstName) user.firstName = dto.firstName;
    if (dto.lastName !== undefined)                    user.lastName  = dto.lastName ?? '';
    if (dto.bio !== undefined)        user.bio       = dto.bio || null;
    if (dto.gender !== undefined)     user.gender    = (dto.gender as Gender) || null;
    if (dto.birthdate !== undefined)  user.birthdate = dto.birthdate ? new Date(dto.birthdate) : null;
    if (dto.location !== undefined)   user.location  = dto.location || null;
    if (dto.website !== undefined)    user.website   = dto.website || null;

    await this.userRepo.save(user);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safe } = user as UserEntity & { password: string };
    return safe;
  }

  async updateAvatar(dto: { userId: string; avatarUrl: string }) {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw AppException.notFound('User not found');
    user.avatarUrl = dto.avatarUrl;
    await this.userRepo.save(user);
    return { userId: user.id, avatarUrl: user.avatarUrl };
  }

  async updateCover(dto: { userId: string; coverUrl: string }) {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw AppException.notFound('User not found');
    user.coverUrl = dto.coverUrl;
    await this.userRepo.save(user);
    return { userId: user.id, coverUrl: user.coverUrl };
  }

  async banUser(dto: BanUserDto) {
    const target = await this.userRepo.findOne({ where: { id: dto.targetUserId } });
    if (!target) throw AppException.notFound('User not found');

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

    if (dto.targetUserId === dto.requesterId) {
      throw AppException.badRequest('Cannot change your own role');
    }

    target.role = dto.role;
    await this.userRepo.save(target);

    return { userId: target.id, role: target.role };
  }
}
