import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorResponse } from '../dto/response.dto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const isProd = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const errorObj = exceptionResponse as any;
        message = errorObj.message || message;
        code = errorObj.code || code || exception.name;
      } else {
        message = exceptionResponse as string;
        code = exception.name;
      }
    }

    // 记录错误日志：生产仅记录必要信息，非生产附带 stack
    const baseLog = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      status,
      code,
      message,
    };
    console.error(
      isProd
        ? baseLog
        : {
            ...baseLog,
            stack: exception instanceof Error ? exception.stack : undefined,
          },
    );

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(!isProd && {
          stack: exception instanceof Error ? exception.stack : undefined,
        }),
      },
    };

    response.status(status).json(errorResponse);
  }
}
