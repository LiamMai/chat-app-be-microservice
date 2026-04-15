export class UpdateProfileDto {
  userId: string;    // from JWT — passed by gateway
  name?: string;
}
