import { Permission } from '@app/common';

export class CreateApiKeyDto {
  userId: string;
  name: string;
  permissions: Permission[];
  expiresAt?: string; // ISO date string, optional
}
