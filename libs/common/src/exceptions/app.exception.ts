import { HttpException, HttpStatus } from '@nestjs/common';

export interface AppExceptionBody {
  message: string | string[];
  error: string;
  statusCode: HttpStatus;
}

export class AppException extends HttpException {
  constructor(message: string | string[], statusCode: HttpStatus, error: string) {
    const body: AppExceptionBody = { message, error, statusCode };
    super(body, statusCode);
  }

  // 4xx
  static badRequest(message: string | string[], error = 'Bad Request'): AppException {
    return new AppException(message, HttpStatus.BAD_REQUEST, error);
  }

  static unauthorized(message: string | string[] = 'Unauthorized', error = 'Unauthorized'): AppException {
    return new AppException(message, HttpStatus.UNAUTHORIZED, error);
  }

  static forbidden(message: string | string[] = 'Forbidden', error = 'Forbidden'): AppException {
    return new AppException(message, HttpStatus.FORBIDDEN, error);
  }

  static notFound(message: string | string[], error = 'Not Found'): AppException {
    return new AppException(message, HttpStatus.NOT_FOUND, error);
  }

  static conflict(message: string | string[], error = 'Conflict'): AppException {
    return new AppException(message, HttpStatus.CONFLICT, error);
  }

  static unprocessable(message: string | string[], error = 'Unprocessable Entity'): AppException {
    return new AppException(message, HttpStatus.UNPROCESSABLE_ENTITY, error);
  }

  static tooManyRequests(message: string | string[] = 'Too Many Requests', error = 'Too Many Requests'): AppException {
    return new AppException(message, HttpStatus.TOO_MANY_REQUESTS, error);
  }

  // 5xx
  static internal(message: string | string[] = 'Internal server error', error = 'Internal Server Error'): AppException {
    return new AppException(message, HttpStatus.INTERNAL_SERVER_ERROR, error);
  }

  static serviceUnavailable(message: string | string[] = 'Service unavailable', error = 'Service Unavailable'): AppException {
    return new AppException(message, HttpStatus.SERVICE_UNAVAILABLE, error);
  }

  // Generic factory by status code
  static fromStatus(statusCode: HttpStatus, message: string | string[], error?: string): AppException {
    const defaultError = HttpStatus[statusCode] ?? 'Error';
    return new AppException(message, statusCode, error ?? defaultError);
  }
}
