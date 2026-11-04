import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * Point d'entrée racine du service.
 *
 * L'API est consommée via `/api/v1` ; cette route existe pour que l'URL racine
 * ne renvoie pas une erreur 404 (utile en aperçu / vérification de déploiement).
 */
@ApiTags('index')
@Controller()
export class AppController {
  @Get()
  @ApiExcludeEndpoint()
  index() {
    return {
      service: 'saas-commerce-api',
      version: '0.1.0',
      status: 'ok',
      documentation: '/api/docs',
      endpoints: {
        health: '/api/v1/health',
        tenants: '/api/v1/tenants',
        catalog: '/api/v1/tenants/:tenantId/catalog',
        inventory: '/api/v1/tenants/:tenantId/inventory',
      },
    };
  }

  @Get('api/v1')
  @ApiOperation({ summary: 'Découverte de l’API' })
  discovery() {
    return this.index();
  }
}
