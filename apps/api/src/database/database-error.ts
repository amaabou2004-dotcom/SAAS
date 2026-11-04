import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

export interface DatabaseError {
  code?: string;
  message?: string;
}

export function toDatabaseHttpException(error: DatabaseError, fallback: string): HttpException {
  if (error.code === '42501') {
    if (error.message?.includes('Inventory management permission required')) {
      return new ForbiddenException('L’annulation d’une vente exige aussi le droit de gérer le stock.');
    }
    return new ForbiddenException('Votre session ne permet pas cette opération pour cette entreprise.');
  }
  if (error.code === 'P0002') {
    return new NotFoundException('Cette vente est introuvable.');
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
  if (error.code === '22023' && error.message?.includes('A payment reference is required')) {
    return new BadRequestException('Une référence Mobile Money est requise pour ce paiement.');
  }
  if (error.code === '22023' && error.message?.includes('Sale is already voided')) {
    return new ConflictException('Cette vente est déjà annulée.');
  }
  if (error.code === '22023' && error.message?.includes('Unknown or inactive sale item')) {
    return new BadRequestException('Un produit de la vente n’existe plus ou a été désactivé.');
  }
  if (error.code === '22023' && error.message?.includes('A sale requires at least one item')) {
    return new BadRequestException('Une vente doit contenir au moins un produit.');
  }
  if (error.code === 'P0001' || error.code === '22023' || error.code === '23503' || error.code === '23514') {
    return new BadRequestException('Les informations de l’opération ne sont pas valides.');
  }
  return new InternalServerErrorException(fallback);
}
