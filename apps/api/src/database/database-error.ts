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

/**
 * Messages déjà rédigés en français par les fonctions de la boutique publique :
 * on les transmet tels quels au client, avec le bon statut HTTP.
 */
const STOREFRONT_MESSAGE =
  /^(Boutique|Indiquez|Note trop longue|Ajoutez au moins un produit|Trop de produits|Ligne de commande|Quantité invalide|Produit présent deux fois|La boutique ne prend plus|Cette commande|Un produit de la commande|Stock insuffisant|Commande introuvable|Clé d’envoi|Seul un administrateur|Adresse de boutique|Cette adresse de boutique|Nom affiché|Numéro WhatsApp|Emplacement inconnu|Choisissez l’emplacement|Votre compte n’a pas le droit|Vous n’avez pas accès|Seule une commande)/;

function storefrontException(error: DatabaseError): HttpException | null {
  if (!error.message || !STOREFRONT_MESSAGE.test(error.message)) return null;
  if (error.code === '42501') return new ForbiddenException(error.message);
  if (error.code === 'P0002') return new NotFoundException(error.message);
  if (error.code === '23505') return new ConflictException(error.message);
  if (error.code === 'P0001') return new ConflictException(error.message);
  if (error.code === '22023') {
    return error.message.includes('déjà') ? new ConflictException(error.message) : new BadRequestException(error.message);
  }
  return null;
}

export function toDatabaseHttpException(error: DatabaseError, fallback: string): HttpException {
  const storefront = storefrontException(error);
  if (storefront) return storefront;

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
  if (error.code === '22023' && error.message?.includes('La date de début doit précéder la date de fin')) {
    return new BadRequestException('La date de début doit précéder la date de fin.');
  }
  if (error.code === '22023' && error.message?.includes('La période ne peut pas dépasser')) {
    return new BadRequestException('La période ne peut pas dépasser 400 jours.');
  }
  if (error.code === '22023' && error.message?.includes('A sale requires at least one item')) {
    return new BadRequestException('Une vente doit contenir au moins un produit.');
  }
  if (error.code === 'P0001' || error.code === '22023' || error.code === '23503' || error.code === '23514') {
    return new BadRequestException('Les informations de l’opération ne sont pas valides.');
  }
  return new InternalServerErrorException(fallback);
}
