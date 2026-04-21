import { Model, QueryOptions, SortOrder } from 'mongoose';
import { PageQueryDto, PAGE_DEFAULT, LIMIT_DEFAULT, LIMIT_MAX } from './page-query.dto';
import { PageMetaDto } from './page-meta.dto';
import { PageDto } from './page.dto';

export type MongoSortOrder = { [key: string]: SortOrder };

export interface PaginateMongoOptions<T> {
  filter?: { [P in keyof T]?: T[P] };
  sort?: MongoSortOrder;
  /** Projection fields (mongoose select string or object) */
  select?: string | Record<string, 0 | 1>;
  /** Extra query options (e.g. lean) */
  queryOptions?: QueryOptions<T>;
}

/**
 * Offset-paginate any Mongoose model.
 *
 * Runs find + countDocuments in parallel — single round-trip cost.
 * Always returns a PageDto so TransformInterceptor picks up the meta.
 *
 * @example
 * return paginateMongo(this.msgModel, query, {
 *   filter: { roomId },
 *   sort:   { createdAt: -1 },
 * });
 */
export async function paginateMongo<T>(
  model: Model<T>,
  query: PageQueryDto | undefined,
  options: PaginateMongoOptions<T> = {},
): Promise<PageDto<T>> {
  const page  = Math.max(1, query?.page  ?? PAGE_DEFAULT);
  const limit = Math.min(query?.limit ?? LIMIT_DEFAULT, LIMIT_MAX);
  const skip  = (page - 1) * limit;

  const { filter = {}, sort = {}, select, queryOptions } = options;

  const [data, total] = await Promise.all([
    model
      .find(filter, select, queryOptions)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean() as Promise<T[]>,
    model.countDocuments(filter),
  ]);

  return new PageDto<T>(data, new PageMetaDto({ page, limit, total }));
}
