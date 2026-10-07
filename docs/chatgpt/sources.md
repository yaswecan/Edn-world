# Contrat consulté le 6 octobre 2026

Les références ont été ouvertes pendant l’implémentation. Cette note décrit le contrat observé à cette date, pas une garantie d’accès pour un compte ou pour Tween Teach hébergé.

| Source officielle | Conséquence dans le projet |
| --- | --- |
| [D1 — Quickstart](https://developers.openai.com/siwc/quickstart) | Identité et autorisation d’utiliser le forfait sont séparées. Les droits Tween Teach ne viennent pas d’OpenAI. |
| [D2 — Exemple d’intégration](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt) | Parcours personnel local admissible ; pas de généralisation aux applications hébergées. Exemple Electron non transplanté dans Express. |
| [D3 — Enregistrement](https://developers.openai.com/siwc/token-sharing-open-source/sign-in) | Hôte persistant, client dynamique initial, client délivré conservé, OAuth public avec PKCE S256/state/nonce ; loopback 127.0.0.1 et vérification cryptographique. Permissions effectives issues du token endpoint. |
| [D4 — Modèles et inférence](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference) | Catalogue `models`, visibilité `list`, `slug` ; OAuth sur les endpoints publics `/v1/models` et `/v1/responses`. Validation uniquement après événement terminal réussi. |
| [D5 — Limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) | Corps SIWC distinct avec allowlist ; streaming obligatoire, pas de stockage distant ni des paramètres API incompatibles. Entrées texte/images conservées, outils non supportés absents. |
| [D6 — Comptes et sessions](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions) | Enregistrements distincts même si email identique ; refresh sérialisé, remplacement atomique, révocation via discovery, conservation de l’identité/client après déconnexion. |
| [D7 — Erreurs](https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery) | Quota, inéligibilité, indisponibilités, paramètres non supportés, scopes et refresh ont des récupérations différentes. Aucun secours API implicite. |
| [D8 — UI/UX](https://developers.openai.com/siwc/ui-ux-guidelines) | Bouton `Continue with ChatGPT`, confirmation initiale, accès aux réglages, état actif et lien exact [gestion d’usage](https://chatgpt.com/settings/usage). Pas de logo redessiné. |
| [D9 — Demande de client](https://developers.openai.com/siwc/request-client-id) | Accès partenaire requis ; aucun accès présumé ou formulaire envoyé dans cette mission. |
| [D10 — Erreurs API](https://developers.openai.com/api/docs/guides/error-codes) | Les codes structurés distinguent crédits, dépenses, quota et débit. `Retry-After` est un minimum ; aucun retry de facturation. |
| [Token reference](https://developers.openai.com/siwc/token-sharing-open-source/token-reference) | Expiration tirée de `expires_in`, permissions `scope`, remplacement du refresh et prise en compte de `earliest_refresh_at`. |
| [OIDC discovery](https://auth.openai.com/.well-known/openid-configuration) | Issuer et endpoints d’autorisation/token conformes aux constantes vérifiées ; JWKS et révocation découverts à l’exécution, limités à l’origine de confiance. |
| [Connexion web](https://developers.openai.com/siwc/website) | Le contrat partenaire dépend du client enregistré : callback exact et authentification du token endpoint provisionnée. Ne pas réutiliser automatiquement le flux local. |
| [Durées Vercel](https://vercel.com/docs/functions/configuring-functions/duration) | Limites dépendantes du plan et du runtime ; un consommateur durable reste nécessaire. `background` OpenAI n’est pas un substitut. |

## DevKit et bibliothèques

Le [dépôt officiel DevKit](https://github.com/openai/sign-in-with-chatgpt-devkit) est disponible. Son [manifeste local](https://raw.githubusercontent.com/openai/sign-in-with-chatgpt-devkit/main/packages/local/package.json) marque `@siwc/local` comme **private**. Sa [licence](https://raw.githubusercontent.com/openai/sign-in-with-chatgpt-devkit/main/LICENSE) limite sa réutilisation à des finalités non commerciales définies précisément et exclut les droits de marque. Le projet n’importe ni ce paquet, ni son code, ni ses assets. Aucune permission commerciale n’est présumée.

L’implémentation est propre à Tween Teach, à partir du protocole publié, avec **oauth4webapi 3.8.2** et **proper-lockfile 4.1.2**, paquets installés et licences MIT vérifiées. [Documentation oauth4webapi](https://github.com/panva/oauth4webapi) ; [documentation proper-lockfile](https://github.com/moxystudio/node-proper-lockfile). La vérification de signature est explicitement appelée en plus du traitement OAuth/OIDC des claims : on ne se contente pas de décoder le JWT.

Aucun token d’un autre outil, cookie ChatGPT, endpoint privé, scraping ou automatisation de l’interface ChatGPT n’est utilisé. Le navigateur de recette intercepte une navigation OAuth **simulée** ; il ne se connecte pas à ChatGPT.
