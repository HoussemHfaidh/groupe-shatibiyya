# Publication des ختمات en production

La section est ajoutée aux espaces professeur et élève. Les deux groupes de production utilisent `khatma/groups/group1` et `khatma/groups/group2`. Les listes communes des cheikhs et lectures utilisent `khatma/catalogs/production`. Les chemins DEV restent séparés. Aucune donnée DEV n’est copiée en production.

Tests locaux avec Firebase simulé : enregistrement et rechargement dans les deux groupes, conflit sans perte du formulaire puis reprise, conservation de l’historique, catalogue commun de production, isolation du catalogue DEV, gestion transversale des élèves et non-régression des autres sections. Les sept tests du modèle ختمات passent également.

## Activation Firebase requise

Lors du contrôle avant publication, les trois chemins de production renvoient HTTP 401. Le code seul ne suffit donc pas pour utiliser les ختمات en production. Le bloc `docs/firebase-khatma-production-bloc.json` doit remplacer uniquement le bloc `khatma` des règles existantes. `firebase-rules-prod.json` et `docs/firebase-khatma-production-complet.json` donnent la configuration complète basée sur les dernières règles fournies par l’utilisateur ; conserver toute autre règle éventuellement ajoutée depuis.

Ces expressions autorisent lecture et écriture sans authentification sur les chemins nommés, conformément au fonctionnement DEV existant. Elles ne réservent pas les modifications au professeur. Aucune règle Firebase distante n’a été modifiée par la publication GitHub.
