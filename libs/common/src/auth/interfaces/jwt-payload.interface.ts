import { Permission } from '../enums/permission.enum';
import { Role } from '../enums/role.enum';

export interface JwtPayload {
  /** user id */
  sub: string;
  email: string;
  role: Role;
  permissions: Permission[];
  /** 'access' | 'refresh' — guards reject wrong type */
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface RequestUser {
  userId: string;
  email: string;
  role: Role;
  permissions: Permission[];
}
