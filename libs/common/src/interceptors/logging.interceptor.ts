import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, url, body, headers } = req;
    const start = Date.now();

    this.logger.debug(
      `→ ${method} ${url} | body: ${JSON.stringify(body)} | agent: ${headers['user-agent'] ?? '-'}`,
    );

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        this.logger.log(`← ${method} ${url} ${res.statusCode} +${ms}ms`);
      }),
      catchError((err: unknown) => {
        const ms = Date.now() - start;
        this.logger.error(
          `← ${method} ${url} ERROR +${ms}ms`,
          err instanceof Error ? err.stack : String(err),
        );
        return throwError(() => err);
      }),
    );
  }
}
