# المراجعة — DEV seulement

Données indépendantes dans review/groups/login-test-group1 (et group2),
ou login-sandbox-group1 (et group2). Aucun accès review PROD autorisé.
Aucun binôme imposé : chacun confirme un autre élève disponible.
Une participation individuelle par semaine, sans auto-validation.
X orange : première partie. X vert : seconde partie complète.
X bleu : seconde partie incomplète, participation néanmoins terminée.
La boîte de confirmation permet aussi d’annuler sans écriture.
Un participant validé quitte la liste disponible, mais peut encore valider un autre.
La partie individuelle s’inverse la semaine suivante, indépendamment du partenaire.
Clôture samedi (groupe 1) ou dimanche (groupe 2) à 06 h Europe/Paris.
Les absents sont rouges dans l’archive professeur. Les élèves voient la semaine courante.
Écritures conditionnelles pour détecter les conflits ; stockage local distinct en DEV localhost.
Pour les pages DEV hébergées, appliquer firebase-rules-prod.json dans Firebase,
qui conserve les règles existantes et ajoute uniquement les chemins review DEV.
