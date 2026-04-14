import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Mark route as public — skips JwtAuthGuard when used as global guard */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
