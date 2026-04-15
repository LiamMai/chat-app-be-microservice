import { ApiProperty } from '@nestjs/swagger';
import { PAGE_DEFAULT, LIMIT_DEFAULT } from './page-query.dto';

export interface PageMetaParams {
  page: number;
  limit: number;
  total: number;
}

export class PageMetaDto {
  @ApiProperty({ description: 'Current page (1-based)', example: 1 })
  readonly page: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  readonly limit: number;

  @ApiProperty({ description: 'Total items across all pages', example: 100 })
  readonly total: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  readonly totalPages: number;

  @ApiProperty({ description: 'Whether a previous page exists', example: false })
  readonly hasPrevPage: boolean;

  @ApiProperty({ description: 'Whether a next page exists', example: true })
  readonly hasNextPage: boolean;

  constructor({ page, limit, total }: PageMetaParams) {
    this.page = page ?? PAGE_DEFAULT;
    this.limit = limit ?? LIMIT_DEFAULT;
    this.total = total;
    this.totalPages = Math.ceil(total / this.limit);
    this.hasPrevPage = this.page > 1;
    this.hasNextPage = this.page < this.totalPages;
  }
}
