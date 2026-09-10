# Règles métier Shatibiyya

Ce document résume les règles validées ensemble pour éviter les régressions.

## Groupes

- Le professeur a une page avec une entrée par groupe.
- Le groupe 1 commence le samedi et se clôture le samedi suivant.
- Le groupe 2 commence le dimanche et se clôture le dimanche suivant.
- La page élève reçoit le groupe via l'URL ou via le login de l'élève.

## Semaines

- La liste des semaines se base sur la configuration du groupe.
- Par défaut, la dernière semaine est sélectionnée.
- Le bouton `Créer la semaine prochaine` ajoute 7 jours à la dernière semaine.
- La nouvelle plage ajoute toujours 10 au début et 10 à la fin.
- Exemple: après `de 1061 à 1080`, la semaine suivante devient `de 1071 à 1090`.

## États du tableau professeur

- Une cellule peut être vide.
- `تم` est l'état vert: récitation validée.
- `استدراك` est l'état jaune: récitation acceptée en rattrapage ou en retard.
- `لم يتم` est l'état rouge: non fait.
- Au clic manuel côté professeur, l'ordre est:
  vide, `تم`, `استدراك`, `لم يتم`, vide.
- Les pourcentages de récitation comptent `تم` et `استدراك`.
- Les pourcentages de non-récitation comptent seulement `لم يتم`.

## Retard

- Une réponse envoyée après la limite de la semaine devient automatiquement `استدراك`.
- Pour le groupe 1, une semaine du samedi est en retard après le samedi suivant à 23:59:59.
- Pour le groupe 2, une semaine du dimanche est en retard après le dimanche suivant à 23:59:59.

## Page élève

- L'élève choisit d'abord la semaine.
- La liste `الطلاب المتاحون` est dynamique selon la semaine choisie.
- Les élèves validés apparaissent en premier.
- Les élèves non disponibles apparaissent ensuite.
- Les élèves validés gardent l'ordre d'approbation enregistré dans `readyOrder`.
- L'élève connecté peut confirmer uniquement s'il est lui-même validé pour cette semaine.
- L'élève connecté ne peut pas se confirmer lui-même.
- L'élève connecté ne peut pas choisir un élève déjà validé.
- Après confirmation élève, le statut est appliqué immédiatement dans la configuration du groupe de test.

## Réponses et application professeur

- Une réponse contient l'élève confirmé, la semaine, le validateur, la date, la note optionnelle et le statut appliqué.
- Quand le professeur applique les réponses, les réponses valides changent le tableau.
- Les réponses en retard sont appliquées en `استدراك`.
- Les élèves sans réponse et sans statut sont marqués `لم يتم`.
- L'ordre des élèves validés est conservé dans `readyOrder`.

## Login de test

- La version de test utilise un login par email uniquement.
- Les emails sont associés aux élèves par hash dans Firebase.
- Aucun mot de passe n'est demandé dans la version de test actuelle.
- Si `إبقاء الجلسة مفتوحة` est coché, la session dure 180 jours.
- Sinon, la session dure 4 heures.

## Séparation dev/prod

- La page dev ne doit pas écrire dans les chemins prod.
- La page professeur en mode test est `prof-login-dev.html`.
- Cette page utilise la même interface professeur, mais écrit seulement dans les chemins de test.
- Le mode données utilise `devMode=data`.
- Le mode test utilise `devMode=test`.
- Groupe 1 en mode données:
  `config/groups/login-test-group1`
  et
  `submissions/groups/login-test-group1`.
- Groupe 2 en mode données:
  `config/groups/login-test-group2`
  et
  `submissions/groups/login-test-group2`.
- Groupe 1 en mode test:
  `config/groups/login-sandbox-group1`
  et
  `submissions/groups/login-sandbox-group1`.
- Groupe 2 en mode test:
  `config/groups/login-sandbox-group2`
  et
  `submissions/groups/login-sandbox-group2`.
- Les chemins prod restent séparés:
  `config`,
  `submissions`,
  `config/groups/group2`,
  `submissions/groups/group2`.

## Test de non-régression

Lancer:

```bash
node tests/business-rules.test.mjs
```

Si `node` n'est pas installé globalement sur ce Mac, Codex peut le lancer avec son runtime embarqué.

## Données de test

- On peut préparer des données de test uniquement pour le mode DEV.
- Le script de données de test est `scripts/seed-dev-data.mjs`.
- Ce script écrit seulement dans les chemins `login-sandbox-group1` et `login-sandbox-group2`.
- Le script de refresh des données DEV est `scripts/refresh-dev-data.mjs`.
- Le script de refresh écrit seulement dans les chemins `login-test-group1` et `login-test-group2`.
- Il n'écrit pas dans les chemins prod.
- Il ne supprime pas `loginEmails`.
