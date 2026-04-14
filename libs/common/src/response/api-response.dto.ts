import { HttpStatus } from '@nestjs/common';


export class ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly statusCode: number;
  readonly message: string;
  readonly data: T | null;
  readonly error: string | null;
  readonly timestamp: string;

  private constructor(partial: Omit<ApiResponse<T>, 'timestamp'>) {
    this.success = partial.success;
    this.statusCode = partial.statusCode;
    this.message = partial.message;
    this.data = partial.data ?? null;
  this.error = partial.error ?? null;
    this.timestamp = new Date().toISOString();
  }

  static success<T>({
    data,
    message: message = 'Success',
    statusCode: statusCode = HttpStatus.OK,
  }: { data: T; message?: string; statusCode?: HttpStatus }): ApiResponse<T> {
    return new ApiResponse<T>({
      success: true,
      statusCode,
      message,
      data,
      error: null,
    });
  }

  static error({
    message = 'Error',
    statusCode: statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    error = 'Error',
  }: { message?: string | string[]; statusCode?: HttpStatus; error: string }): ApiResponse<null> {
    const normalizedMessage = Array.isArray(message)
      ? message.join('; ')
      : message;
    return new ApiResponse<null>({
      success: false,
      statusCode,
      message: normalizedMessage,
      data: null,
      error,
    });
  }
}
