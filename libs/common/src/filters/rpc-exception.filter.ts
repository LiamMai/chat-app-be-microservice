import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { throwError } from 'rxjs';

export interface RpcErrorPayload {
  statusCode: number;
  message: string;
  error: string;
}

/**
 * Global filter for microservice apps.
 * Converts ALL exceptions (HttpException, RpcException, Error, unknown)
 * into a structured RpcErrorPayload so the gateway can read statusCode.
 */
@Catch()
export class RpcExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RpcExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        error = HttpStatus[statusCode] ?? error;
      } else {
        const body = res as { message?: string | string[]; error?: string };
        message = Array.isArray(body.message)
          ? body.message.join('; ')
          : (body.message ?? exception.message);
        error = body.error ?? HttpStatus[statusCode] ?? error;
      }
    } else if (exception instanceof RpcException) {
      const rpcError = exception.getError() as Partial<RpcErrorPayload>;
      statusCode = rpcError.statusCode ?? statusCode;
      message = rpcError.message ?? message;
      error = rpcError.error ?? error;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    this.logger.error(`${statusCode} ${error}: ${message}`);

    return throwError(() => ({ statusCode, message, error } satisfies RpcErrorPayload));
  }
}
