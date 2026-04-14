import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appConfig } from 'config/configuration';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token/token.service';
import { ApiKeyService } from './api-key/api-key.service';
import { UserEntity } from './entities/user.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { ApiKeyEntity } from './entities/api-key.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: appConfig.postgres.host,
      port: appConfig.postgres.port,
      username: appConfig.postgres.username,
      password: appConfig.postgres.password,
      database: appConfig.postgres.database,
      entities: [UserEntity, RefreshTokenEntity, ApiKeyEntity],
      synchronize: appConfig.nodeEnv !== 'production', // never in prod — use migrations
    }),
    TypeOrmModule.forFeature([UserEntity, RefreshTokenEntity, ApiKeyEntity]),
    JwtModule.register({
      privateKey: appConfig.jwt.privateKey,
      publicKey: appConfig.jwt.publicKey,
      signOptions: {
        algorithm: 'RS256',
        issuer: appConfig.jwt.issuer,
      },
      verifyOptions: {
        algorithms: ['RS256'],
        issuer: appConfig.jwt.issuer,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, ApiKeyService],
})
export class AuthModule {}
