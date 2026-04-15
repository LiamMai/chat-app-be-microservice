export class BanUserDto {
  targetUserId: string;
  ban: boolean;       // true = ban, false = unban
  requesterId: string;
}
