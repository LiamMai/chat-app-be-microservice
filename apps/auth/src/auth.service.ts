import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AppException } from '@app/common';
import { UserEntity } from './entities/user.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { TokenService } from './token/token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepo: Repository<RefreshTokenEntity>,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto) {
    return this.dataSource.transaction(async (manager) => {
      const exists = await manager.findOne(UserEntity, { where: { email: dto.email } });
      if (exists) throw AppException.conflict('Email already registered');

      const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      const user = await manager.save(
        manager.create(UserEntity, { email: dto.email, name: dto.name, password }),
      );

      // If token generation throws (e.g. bad JWT keys), transaction rolls back → user deleted
      const tokens = this.tokenService.generateTokenPair({
        sub: user.id,
        email: user.email,
        permissions: user.permissions,
      });

      const tokenHash = this.tokenService.hashToken(tokens.refreshToken);
      const expiresAt = this.tokenService.refreshTokenExpiresAt();
      await manager.save(
        manager.create(RefreshTokenEntity, { userId: user.id, tokenHash, expiresAt }),
      );

      return { ...tokens, user: this.sanitize(user) };
    });
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email, isActive: true },
      select: [
        'id',
        'email',
        'name',
        'password',
        'permissions',
        'isActive',
        'createdAt',
        'updatedAt',
      ],
    });
    console.log("🚀 ~ AuthService ~ login ~ user:", user)

    if (!user) throw AppException.unauthorized('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw AppException.unauthorized('Invalid credentials');

    const tokens = this.tokenService.generateTokenPair({
      sub: user.id,
      email: user.email,
      permissions: user.permissions,
    });

    await this.storeRefreshToken(user.id, tokens.refreshToken);
    return { ...tokens, user: this.sanitize(user) };
  }

  async refresh(refreshToken: string) {
    let payload: ReturnType<TokenService['verify']>;
    try {
      payload = this.tokenService.verify(refreshToken);
    } catch {
      throw AppException.unauthorized('Invalid refresh token');
    }

    if (payload.type !== 'refresh')
      throw AppException.unauthorized('Invalid token type');

    const hash = this.tokenService.hashToken(refreshToken);
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash: hash, userId: payload.sub, isRevoked: false },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw AppException.unauthorized('Refresh token expired or revoked');
    }

    // Rotate: revoke old, issue new
    await this.refreshTokenRepo.update(stored.id, { isRevoked: true });

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive)
      throw AppException.unauthorized('User not found or inactive');

    const tokens = this.tokenService.generateTokenPair({
      sub: user.id,
      email: user.email,
      permissions: user.permissions,
    });

    await this.storeRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.tokenService.hashToken(refreshToken);
    await this.refreshTokenRepo.update(
      { tokenHash: hash },
      { isRevoked: true },
    );
  }

  private async storeRefreshToken(
    userId: string,
    token: string,
  ): Promise<void> {
    const tokenHash = this.tokenService.hashToken(token);
    const expiresAt = this.tokenService.refreshTokenExpiresAt();
    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({ userId, tokenHash, expiresAt }),
    );
  }

  private sanitize(user: UserEntity) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safe } = user as UserEntity & { password: string };
    return safe;
  }
}
