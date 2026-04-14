import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { JwtPayload, Permission } from '@app/common';
import { appConfig } from 'config/configuration';

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  private parseExpiry(expiry: string): number {
    const [amount, unit] = [
      parseInt(expiry.slice(0, -1), 10),
      expiry.slice(-1),
    ];
    return unit === 'd' ? amount * 86_400_000 : unit === 'h' ? amount * 3_600_000 : amount * 60_000;
  }

  generateTokenPair(payload: {
    sub: string;
    email: string;
    permissions: Permission[];
  }): { accessToken: string; refreshToken: string } {
    const base = { sub: payload.sub, email: payload.email, permissions: payload.permissions };

    const accessToken = this.jwtService.sign(
      { ...base, type: 'access' } satisfies Omit<JwtPayload, 'iat' | 'exp'>,
      { expiresIn: this.parseExpiry(appConfig.jwt.accessExpiry) },
    );

    const refreshToken = this.jwtService.sign(
      { ...base, type: 'refresh' } satisfies Omit<JwtPayload, 'iat' | 'exp'>,
      { expiresIn: this.parseExpiry(appConfig.jwt.refreshExpiry) },
    );

    return { accessToken, refreshToken };
  }

  verify(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token);
  }

  decode(token: string): JwtPayload | null {
    return this.jwtService.decode<JwtPayload>(token);
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  refreshTokenExpiresAt(): Date {
    const ms = this.parseExpiry(appConfig.jwt.refreshExpiry);
    return new Date(Date.now() + ms);
  }
}
