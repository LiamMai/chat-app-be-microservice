import { FindManyOptions, Repository, ObjectLiteral } from 'typeorm';
import { PageQueryDto, PAGE_DEFAULT, LIMIT_DEFAULT, LIMIT_MAX } from './page-query.dto';
import { PageMetaDto } from './page-meta.dto';
import { PageDto } from './page.dto';

/**
 * Run offset pagination on any TypeORM repository.
 *
 * @example
 * return paginate(this.userRepo, query, {
 *   select: ['id', 'email', 'name'],
 *   order: { createdAt: 'DESC' },
 * });
 */
export async function paginate<T extends ObjectLiteral>(
  repo: Repository<T>,
  query: PageQueryDto,
  options: Omit<FindManyOptions<T>, 'skip' | 'take'> = {},
): Promise<PageDto<T>> {
  const page = Math.max(1, query.page ?? PAGE_DEFAULT);
  const limit = Math.min(query.limit ?? LIMIT_DEFAULT, LIMIT_MAX);

  const [data, total] = await repo.findAndCount({
    ...options,
    skip: (page - 1) * limit,
    take: limit,
  });

  return new PageDto(data, new PageMetaDto({ page, limit, total }));
}
