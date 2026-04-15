import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../response/api-response.dto';
import { PageMetaDto } from '../pagination/page-meta.dto';

interface PageShape {
  data: unknown[];
  meta: PageMetaDto;
}

function isPageDto(value: unknown): value is PageShape {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as PageShape).data) &&
    typeof (value as PageShape).meta === 'object' &&
    (value as PageShape).meta !== null &&
    typeof (value as PageShape).meta.total === 'number'
  );
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (isPageDto(data)) {
          return ApiResponse.success({
            data: data.data as unknown as T,
            meta: data.meta,
            statusCode: response.statusCode,
          });
        }

        return ApiResponse.success({ data, statusCode: response.statusCode });
      }),
    );
  }
}
