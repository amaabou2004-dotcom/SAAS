# Connexion Google avec Supabase OAuth

La connexion Google utilise le serveur d’autorisation de Google puis Supabase Auth. Elle ne demande pas de code OTP par e-mail. L’application ne doit jamais confirmer manuellement une adresse ni désactiver les contrôles de nonce ou de session.

## 1. Créer le client Google OAuth

Dans Google Auth Platform :

1. Configurer l’écran de consentement OAuth. En mode **Testing**, ajouter explicitement les comptes Google autorisés à tester.
2. Créer un client OAuth de type **Application Web**.
3. Ajouter l’URI de redirection exacte affichée par Supabase :

```text
https://<PROJECT_REF>.supabase.co/auth/v1/callback
```

Pour Supabase local :

```text
http://127.0.0.1:54321/auth/v1/callback
```

4. Limiter les scopes à `openid`, `email` et `profile`. Aucun accès à Gmail, Drive ou à une autre API Google n’est nécessaire.
5. Conserver le client secret hors du dépôt et hors de toute variable `VITE_`.

## 2. Activer Google dans Supabase

Dans **Authentication → Sign In / Providers → Google** :

- activer le fournisseur ;
- renseigner le client ID et le client secret dans les champs Supabase prévus à cet effet ;
- conserver `skip_nonce_check` désactivé ;
- ajouter l’URL applicative suivante aux redirections autorisées :

```text
https://<ORIGINE_APPLICATIVE>/auth/callback
```

Le client secret est stocké dans la configuration Auth de Supabase, pas dans React, NestJS ou Git.

## 3. Activer le bouton Web

Après activation effective du fournisseur distant :

```dotenv
VITE_GOOGLE_AUTH_ENABLED=true
```

Redémarrer ensuite le serveur Web. Cette variable ne contient aucun identifiant secret : elle empêche seulement d’afficher une action active lorsque le fournisseur n’est pas prêt.

## 4. Aperçu intégré dans une iframe

Google peut refuser d’afficher sa page de connexion dans une iframe et produire une page blanche. Dans un aperçu intégré, le bouton prépare l’URL PKCE puis utilise un vrai lien de navigation vers la fenêtre principale, sans `window.open`. Un lien de secours permet aussi d’ouvrir Google dans un nouvel onglet. Hors iframe, la redirection normale reste utilisée.

## 5. Test d’acceptation

Avec un compte autorisé par l’écran de consentement :

1. Cliquer sur **Continuer avec Google**.
2. Vérifier que Google gère seul l’authentification, sans OTP envoyé par l’application.
3. Vérifier le retour sur `/auth/callback` puis la redirection vers `/onboarding`.
4. Vérifier que Supabase renvoie une session avec `email_confirmed_at` renseigné par le parcours OAuth.
5. Vérifier la création du profil et l’accès uniquement aux tenants de l’utilisateur.
6. Vérifier qu’une session OAuth sans e-mail confirmé est déconnectée et refusée.

Le test ne doit pas être déclaré réussi tant que le fournisseur n’est pas activé et que le callback réel n’a pas été exécuté.
