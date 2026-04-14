import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { appConfig } from 'config/configuration';
import { RmqModule, SERVICES, QUEUES } from '@app/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiKeyGuard } from './guards/api-key.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [
    RmqModule.register({ name: SERVICES.AUTH, queue: QUEUES[SERVICES.AUTH] }),
    JwtModule.register({
      // Gateway only verifies — no privateKey needed
      publicKey: appConfig.jwt.publicKey,
      verifyOptions: {
        algorithms: ['RS256'],
        issuer: appConfig.jwt.issuer,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, ApiKeyGuard, PermissionsGuard],
  // Export guards + JwtModule so other gateway modules can use them
  exports: [JwtAuthGuard, ApiKeyGuard, PermissionsGuard, JwtModule, RmqModule],
})
export class AuthModule {}
