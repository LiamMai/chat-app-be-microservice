import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const PAGE_DEFAULT = 1;
export const LIMIT_DEFAULT = 20;
export const LIMIT_MAX = 100;

export class PageQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: PAGE_DEFAULT, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = PAGE_DEFAULT;

  @ApiPropertyOptional({ description: 'Items per page', default: LIMIT_DEFAULT, minimum: 1, maximum: LIMIT_MAX })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMIT_MAX)
  limit?: number = LIMIT_DEFAULT;
}
