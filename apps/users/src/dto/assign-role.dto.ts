import { Role } from '@app/common';

export class AssignRoleDto {
  targetUserId: string;
  role: Role;
  requesterId: string;
}
