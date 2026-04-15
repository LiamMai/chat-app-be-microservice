import { DynamicModule, Global, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { appConfig } from 'config/configuration';
import { CacheService } from './cache.service';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({})
export class RedisModule implements OnApplicationShutdown {
  private static redis: Redis;
  private readonly logger = new Logger(RedisModule.name);

  async onApplicationShutdown() {
    if (RedisModule.redis) {
      await RedisModule.redis.quit();
    }
  }

  static forRoot(): DynamicModule {
    const redisProvider = {
      provide: REDIS_CLIENT,
      useFactory: (): Redis => {
        const logger = new Logger('Redis');

        const client = new Redis({
          host: appConfig.redis.host,
          port: appConfig.redis.port,
          password: appConfig.redis.password || undefined,
          db: appConfig.redis.db,
          lazyConnect: false,
          retryStrategy: (times) => Math.min(times * 100, 3000), // exponential backoff capped at 3s
        });

        client.on('connect', () => logger.log(`Connected → ${appConfig.redis.host}:${appConfig.redis.port}`));
        client.on('error', (err) => logger.error('Redis error', err.message));
        client.on('reconnecting', () => logger.warn('Reconnecting...'));

        RedisModule.redis = client;
        return client;
      },
    };

    return {
      module: RedisModule,
      providers: [redisProvider, CacheService],
      exports: [CacheService, REDIS_CLIENT],
    };
  }
}
