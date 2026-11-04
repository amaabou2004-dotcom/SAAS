/**
 * Traduit les erreurs techniques (base de données, réseau, session) en une
 * phrase compréhensible par un commerçant.
 *
 * Règle : un message interne ne doit jamais arriver tel quel à l'écran. Soit
 * il correspond à un cas connu et reçoit une phrase dédiée, soit il ressemble
 * à une phrase rédigée en français (message métier volontaire, par exemple
 * « Le code produit accepte lettres et chiffres ») et il est conservé, soit il
 * est remplacé par le message de secours.
 */
const defaultFallback = 'Une erreur est survenue. Réessayez dans un instant.';

const knownCases: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /permission denied|row[- ]level security|rls|42501|insufficient privilege/i,
    message: 'Vous n’avez pas les droits nécessaires pour cette action.',
  },
  {
    pattern: /duplicate key|unique constraint|23505|already exists/i,
    message: 'Cet élément existe déjà. Vérifiez le nom ou le code saisi.',
  },
  {
    pattern: /foreign key|23503|is still referenced/i,
    message: 'Impossible : cet élément est encore utilisé ailleurs (produit, dépôt ou vente).',
  },
  {
    pattern: /jwt|not authenticated|invalid claim|session|401|refresh token/i,
    message: 'Votre session a expiré. Reconnectez-vous pour continuer.',
  },
  {
    pattern: /failed to fetch|networkerror|network|timeout|econnrefused|load failed/i,
    message: 'Connexion impossible. Vérifiez votre réseau puis réessayez.',
  },
  {
    pattern: /invalid input syntax|22p02|invalid uuid|is not a valid/i,
    message: 'Une valeur saisie n’est pas valide. Corrigez-la puis réessayez.',
  },
  {
    pattern: /check constraint|23514|null value in column|23502/i,
    message: 'Certaines informations sont incomplètes ou non acceptées. Vérifiez le formulaire.',
  },
  {
    pattern: /schema cache|does not exist|could not find the function|42p01|42883|pgrst/i,
    message: 'Le service est momentanément indisponible. Réessayez dans un instant.',
  },
  {
    pattern: /quota|rate limit|too many requests|429/i,
    message: 'Trop de tentatives en peu de temps. Patientez quelques instants.',
  },
  {
    pattern: /payload too large|entity too large|413/i,
    message: 'Le fichier envoyé est trop volumineux. Choisissez une image plus légère.',
  },
];

/** Indices qui trahissent un message technique plutôt qu'une phrase rédigée. */
const technicalMarkers = /\b(error|exception|null|undefined|pgrst\d*|sqlstate|relation|column|table|function|syntax|violates|constraint)\b|::|\{|\}|<[a-z]/i;

function looksLikeBusinessMessage(message: string) {
  if (message.length > 180) return false;
  if (technicalMarkers.test(message)) return false;
  return /[a-zà-ÿ]/i.test(message) && /\s/.test(message);
}

export function friendlyError(error: unknown, fallback: string = defaultFallback): string {
  if (!error) return fallback;
  const message =
    error instanceof Error
      ? error.message.trim()
      : typeof error === 'string'
        ? error.trim()
        : '';
  if (!message) return fallback;

  const known = knownCases.find(({ pattern }) => pattern.test(message));
  if (known) return known.message;

  return looksLikeBusinessMessage(message) ? message : fallback;
}
