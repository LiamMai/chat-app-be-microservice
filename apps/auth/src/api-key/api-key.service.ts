import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { AppException, Permission, Role } from '@app/common';
import { ApiKeyEntity } from '../entities/api-key.entity';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepo: Repository<ApiKeyEntity>,
  ) {}

  /** Generate cryptographically secure API key */
  private generate(): { key: string; keyHash: string; prefix: string } {
    const raw = crypto.randomBytes(32).toString('hex'); // 64 hex chars
    const key = `chat_${raw}`; // e.g. chat_a3f9...
    const prefix = key.substring(0, 12); // "chat_a3f9xx"
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    return { key, keyHash, prefix };
  }

  async create(dto: CreateApiKeyDto): Promise<{ apiKey: ApiKeyEntity; rawKey: string }> {
    const { key, keyHash, prefix } = this.generate();

    const entity = this.apiKeyRepo.create({
      userId: dto.userId,
      name: dto.name,
      keyHash,
      prefix,
      permissions: dto.permissions,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    const apiKey = await this.apiKeyRepo.save(entity);
    return { apiKey, rawKey: key }; // rawKey shown ONCE — never stored plain
  }

  async validate(rawKey: string): Promise<{ userId: string; role: Role; permissions: Permission[] } | null> {
    if (!rawKey?.startsWith('chat_')) return null;

    const prefix = rawKey.substring(0, 12);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const entity = await this.apiKeyRepo.findOne({
      where: { prefix, keyHash, isRevoked: false },
    });

    if (!entity) return null;
    if (entity.expiresAt && entity.expiresAt < new Date()) return null;

    // Fire-and-forget lastUsedAt update
    void this.apiKeyRepo.update(entity.id, { lastUsedAt: new Date() });

    // API keys carry explicit permissions only — no role elevation.
    // Role.USER is used as a sentinel so RequestUser.role is always defined.
    return { userId: entity.userId, role: Role.USER, permissions: entity.permissions };
  }

  async listByUser(userId: string): Promise<ApiKeyEntity[]> {
    return this.apiKeyRepo.find({
      where: { userId, isRevoked: false },
      select: ['id', 'name', 'prefix', 'permissions', 'expiresAt', 'lastUsedAt', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(keyId: string, userId: string): Promise<void> {
    const entity = await this.apiKeyRepo.findOne({ where: { id: keyId, userId } });
    if (!entity) throw AppException.notFound('API key not found');
    await this.apiKeyRepo.update(keyId, { isRevoked: true });
  }
}
