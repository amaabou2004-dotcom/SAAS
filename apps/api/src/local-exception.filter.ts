import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

/** Temporary local-only diagnostics for the browser journey; never enabled in production. */
@Catch()
export class LocalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(LocalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      response.status(exception.getStatus()).json(
        typeof payload === 'string' ? { statusCode: exception.getStatus(), message: payload } : payload,
      );
      return;
    }

    const detail = exception instanceof Error ? `${exception.name}: ${exception.message}` : String(exception);
    this.logger.error(`Unhandled local E2E exception: ${detail}`);
    response.status(500).json({
      statusCode: 500,
      message: process.env.E2E_DIAGNOSTICS === 'true'
        ? `Diagnostic local: ${detail.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')}`
        : 'Internal server error',
    });
  }
}
