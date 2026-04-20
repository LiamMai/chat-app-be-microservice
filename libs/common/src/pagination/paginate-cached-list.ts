import { CacheService } from '../redis/cache.service';
import { PageQueryDto, PAGE_DEFAULT, LIMIT_DEFAULT, LIMIT_MAX } from './page-query.dto';
import { PageMetaDto } from './page-meta.dto';
import { PageDto } from './page.dto';

export interface PaginateCachedListOptions<T> {
  /** Redis key for the ordered ID list */
  cacheKey: string;
  /** TTL in seconds for the cached list */
  ttl: number;
  /** Called on cache miss — must return ALL IDs in desired order */
  fetchIds: () => Promise<string[]>;
  /** Called with the page slice of IDs — resolve to full objects */
  fetchItems: (ids: string[]) => Promise<T[]>;
  /** Preserve the order returned by fetchIds (default true) */
  preserveOrder?: boolean;
}

/**
 * Paginate a large ordered list using Redis as the index.
 *
 * On cache miss → fetchIds() runs once, full list stored in Redis.
 * On cache hit  → LRANGE slices IDs, fetchItems() loads only that page.
 *
 * Invalidate by DEL cacheKey (e.g. on friend accept/unfriend/block).
 *
 * @example
 * return paginateCachedList(this.cache, query, {
 *   cacheKey: CacheKey.friendSuggestions(userId),
 *   ttl: 3600,
 *   fetchIds: () => this.buildSuggestionIds(userId),
 *   fetchItems: (ids) => this.userRepo.find({ where: { id: In(ids) } }),
 * });
 */
export async function paginateCachedList<T>(
  cache: CacheService,
  query: PageQueryDto,
  options: PaginateCachedListOptions<T>,
): Promise<PageDto<T>> {
  const { cacheKey, ttl, fetchIds, fetchItems, preserveOrder = true } = options;

  const page  = Math.max(1, query?.page  ?? PAGE_DEFAULT);
  const limit = Math.min(query?.limit ?? LIMIT_DEFAULT, LIMIT_MAX);

  // ── Warm cache if needed ─────────────────────────────────────────────────
  let total: number;
  try {
    total = await cache.lLen({ key: cacheKey });
  } catch (err: any) {
    // Stale key of wrong type — delete and treat as cache miss
    if (err?.message?.includes('WRONGTYPE')) {
      await cache.del(cacheKey);
      total = 0;
    } else {
      throw err;
    }
  }

  if (total === 0) {
    const ids = await fetchIds();
    if (ids.length) {
      await cache.rPush({ key: cacheKey, values: ids });
      await cache.expire(cacheKey, ttl);
      total = ids.length;
    }
  }

  if (total === 0) {
    return new PageDto<T>([], new PageMetaDto({ page, limit, total: 0 }));
  }

  // ── Slice from Redis ─────────────────────────────────────────────────────
  const offset = (page - 1) * limit;
  const ids = await cache.lRange({ key: cacheKey, start: offset, stop: offset + limit - 1 });

  if (!ids.length) {
    return new PageDto<T>([], new PageMetaDto({ page, limit, total }));
  }

  // ── Resolve objects ──────────────────────────────────────────────────────
  const items = await fetchItems(ids);

  // Restore Redis order (DB queries don't guarantee order)
  const data = preserveOrder
    ? ids.map((id) => items.find((item: any) => item.id === id)!).filter(Boolean)
    : items;

  return new PageDto<T>(data, new PageMetaDto({ page, limit, total }));
}
