import { BadRequestException, ConflictException, ForbiddenException, HttpException, InternalServerErrorException } from '@nestjs/common';

export interface DatabaseError {
  code?: string;
  message?: string;
}

export function toDatabaseHttpException(error: DatabaseError, fallback: string): HttpException {
  if (error.code === '42501') {
    return new ForbiddenException('Votre session ne permet pas cette opération pour cette entreprise.');
  }
  if (error.code === '23505') {
    return new ConflictException('Une donnée avec cet identifiant ou cette valeur existe déjà.');
  }
  if (error.code === 'P0001' && error.message?.includes('Insufficient available stock')) {
    return new ConflictException('Le stock disponible est insuffisant pour cette opération.');
  }
  if (error.code === '22023' && error.message?.includes('Idempotency key payload mismatch')) {
    return new ConflictException('Cette clé d’idempotence a déjà été utilisée pour une autre opération.');
  }
  if (error.code === 'P0001' || error.code === '22023' || error.code === '23503' || error.code === '23514') {
    return new BadRequestException('Les informations de l’opération ne sont pas valides.');
  }
  return new InternalServerErrorException(fallback);
}
