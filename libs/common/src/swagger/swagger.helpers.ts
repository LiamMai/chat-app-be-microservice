/**
 * Reusable Swagger response schema builders.
 *
 * All API responses go through TransformInterceptor and are wrapped in the
 * standard ApiResponse envelope:
 *   { success, statusCode, message, data, meta, error, timestamp }
 *
 * Use these helpers instead of writing raw schema objects in every controller.
 *
 * @example
 * // Single object
 * @ApiOkResponse(apiOkSchema({ $ref: getSchemaPath(UserDto) }))
 *
 * // Paginated array
 * @ApiOkResponse(apiPaginatedSchema({ $ref: getSchemaPath(UserDto) }))
 *
 * // Plain array (no pagination)
 * @ApiOkResponse(apiArraySchema({ $ref: getSchemaPath(ApiKeyDto) }))
 */

const BASE_ENVELOPE = {
  success:    { type: 'boolean', example: true },
  statusCode: { type: 'number',  example: 200 },
  message:    { type: 'string',  example: 'Success' },
  error:      { type: 'string',  nullable: true, example: null },
  timestamp:  { type: 'string',  example: '2026-01-01T00:00:00.000Z' },
};

const PAGE_META_SCHEMA = {
  type: 'object',
  properties: {
    total:       { type: 'number',  example: 100 },
    page:        { type: 'number',  example: 1 },
    limit:       { type: 'number',  example: 20 },
    totalPages:  { type: 'number',  example: 5 },
    hasPrevPage: { type: 'boolean', example: false },
    hasNextPage: { type: 'boolean', example: true },
  },
};

/** Wrap a single-object data schema in the ApiResponse envelope. */
export function apiOkSchema(dataSchema: object) {
  return {
    schema: {
      properties: {
        ...BASE_ENVELOPE,
        data: dataSchema,
        meta: { nullable: true, example: null },
      },
    },
  };
}

/** Wrap a plain array (no pagination) in the ApiResponse envelope. */
export function apiArraySchema(itemSchema: object) {
  return {
    schema: {
      properties: {
        ...BASE_ENVELOPE,
        data: { type: 'array', items: itemSchema },
        meta: { nullable: true, example: null },
      },
    },
  };
}

/** Wrap a paginated array in the ApiResponse envelope (data + meta). */
export function apiPaginatedSchema(itemSchema: object) {
  return {
    schema: {
      properties: {
        ...BASE_ENVELOPE,
        data: { type: 'array', items: itemSchema },
        meta: PAGE_META_SCHEMA,
      },
    },
  };
}

/** Wrap a created resource (201) in the ApiResponse envelope. */
export function apiCreatedSchema(dataSchema: object) {
  return {
    schema: {
      properties: {
        ...BASE_ENVELOPE,
        statusCode: { type: 'number', example: 201 },
        data: dataSchema,
        meta: { nullable: true, example: null },
      },
    },
  };
}
