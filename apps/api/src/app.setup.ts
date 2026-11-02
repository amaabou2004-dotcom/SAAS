import { BadRequestException, ValidationPipe, type INestApplication } from '@nestjs/common';

export function configureApplication(app: INestApplication) {
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => new BadRequestException(errors),
    }),
  );
}
