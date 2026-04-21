import { DynamicModule, Global, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { appConfig } from 'config/configuration';
import { CacheService } from './cache.service';

export const REDIS_CLIENT     = 'REDIS_CLIENT';
export const REDIS_SUB_CLIENT = 'REDIS_SUB_CLIENT'; // dedicated subscriber connection

function createRedisClient(name: string): Redis {
  const logger = new Logger(name);
  const client = new Redis({
    host:     appConfig.redis.host,
    port:     appConfig.redis.port,
    password: appConfig.redis.password || undefined,
    db:       appConfig.redis.db,
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });
  client.on('connect',     () => logger.log(`Connected → ${appConfig.redis.host}:${appConfig.redis.port}`));
  client.on('error',       (err) => logger.error('Redis error', err.message));
  client.on('reconnecting', () => logger.warn('Reconnecting...'));
  return client;
}

@Global()
@Module({})
export class RedisModule implements OnApplicationShutdown {
  private static clients: Redis[] = [];
  private readonly logger = new Logger(RedisModule.name);

  async onApplicationShutdown() {
    await Promise.all(RedisModule.clients.map((c) => c.quit()));
  }

  static forRoot(): DynamicModule {
    const commandsProvider = {
      provide: REDIS_CLIENT,
      useFactory: (): Redis => {
        const client = createRedisClient('Redis');
        RedisModule.clients.push(client);
        return client;
      },
    };

    const subscriberProvider = {
      provide: REDIS_SUB_CLIENT,
      useFactory: (): Redis => {
        const client = createRedisClient('RedisSub');
        RedisModule.clients.push(client);
        return client;
      },
    };

    return {
      module: RedisModule,
      providers: [commandsProvider, subscriberProvider, CacheService],
      exports: [CacheService, REDIS_CLIENT, REDIS_SUB_CLIENT],
    };
  }
}
