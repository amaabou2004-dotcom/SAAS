import {
  BadRequestException,
  RequestMethod,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';

export function configureApplication(app: INestApplication) {
  // La racine reste hors du préfixe : elle sert de page de découverte du service.
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: 'api/v1', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => new BadRequestException(errors),
    }),
  );
}
