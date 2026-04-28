import { Gender } from '@app/common';

export class UpdateProfileDto {
  userId: string;       // from JWT — set by gateway
  firstName?: string;
  lastName?: string;
  username?: string;
  bio?: string;
  gender?: Gender;
  birthdate?: string;   // ISO date string e.g. "2000-01-15"
  location?: string;
  website?: string;
}
