import { HttpStatus } from '@nestjs/common';
import { PageMetaDto } from '../pagination/page-meta.dto';

export class ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly statusCode: number;
  readonly message: string;
  readonly data: T | null;
  readonly meta: PageMetaDto | null;
  readonly error: string | null;
  readonly timestamp: string;

  private constructor(partial: Omit<ApiResponse<T>, 'timestamp'>) {
    this.success = partial.success;
    this.statusCode = partial.statusCode;
    this.message = partial.message;
    this.data = partial.data ?? null;
    this.meta = partial.meta ?? null;
    this.error = partial.error ?? null;
    this.timestamp = new Date().toISOString();
  }

  static success<T>({
    data,
    meta,
    message = 'Success',
    statusCode = HttpStatus.OK,
  }: { data: T; meta?: PageMetaDto; message?: string; statusCode?: HttpStatus }): ApiResponse<T> {
    return new ApiResponse<T>({
      success: true,
      statusCode,
      message,
      data,
      meta: meta ?? null,
      error: null,
    });
  }

  static error({
    message = 'Error',
    statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    error = 'Error',
  }: { message?: string | string[]; statusCode?: HttpStatus; error: string }): ApiResponse<null> {
    return new ApiResponse<null>({
      success: false,
      statusCode,
      message: Array.isArray(message) ? message.join('; ') : message,
      data: null,
      meta: null,
      error,
    });
  }
}
