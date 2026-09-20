# متابعة الختمات الفردية

Nouvelle activité indépendante, disponible dans les pages élève et professeur,
DEV uniquement, pour les deux groupes. Pages : `student-login-dev.html` et
`prof-login-dev.html` (également `student-login-test.html`). Aucune activation
dans `index.html` ni `student.html`. Le module refuse tout identifiant de
groupe hors `login-test-*` et `login-sandbox-*`.

## Formulaire et suivi

- Identité de l’élève issue du compte connecté, non modifiable.
- Cheikh : les 14 noms de la deuxième capture, avec liste modifiable par le
  professeur dans « إدارة الشيوخ والقراءات — مشتركة للمجموعتين ». Les listes des cheikhs et des lectures sont communes aux deux groupes.
- Date de séance, présence (présent, excusé, absent sans excuse, report du cheikh).
- Les 16 choix initiaux de lecture/riwāya des deux dernières captures, modifiables
  par le professeur, comme les cheikhs : ajouter, renommer ou supprimer une ligne.
- Aucun choix, nom ou état de khatma demandé à l’élève. Les séances sont
  regroupées automatiquement par élève, cheikh et lecture.
- Début et fin de lecture obligatoires pour une présence, désactivés sinon.
- Après la lecture/riwāya : début, fin de lecture et remarques facultatives du cheikh.
- Nombre de khatmas et de saisies hebdomadaires non limité par l’application.
- Chaque saisie est ajoutée à l’historique ; les anciennes ne sont pas remplacées.
- Le tableau professeur affiche tous les élèves, les saisies et présences de la
  semaine, chaque khatma et son dernier passage connu. Une absence ne supprime
  pas la dernière position lue. Le récapitulatif individuel couvre tout l’historique.
- Les dates de séances déterminent leur semaine (samedi pour groupe 1, dimanche
  pour groupe 2, ou jour configuré). La date ne comportant pas d’heure, une séance
  du jour de début est rattachée à cette nouvelle semaine. L’affichage de la semaine
  courante bascule à 06:00 Paris comme les autres activités.
- Les semaines intermédiaires sans saisie sont consultables depuis la première
  semaine enregistrée. « لم يسجل » signifie aucune déclaration, pas forcément absence.

## Données et mise en ligne

Stockage indépendant : `khatma/groups/{storageId}` avec `khatmas`, `entries`,
`weeks`. Les listes partagées résident dans
`khatma/catalogs/login-test/settings` (ou `login-sandbox`) avec `teachers` et
`readings`. Les groupes restent indépendants pour les séances. Les noms des cheikhs et lectures sont conservés
sur chaque séance même si la liste des cheikhs change ensuite.

Firebase utilise ETag/if-match contre l’écrasement concurrent. Les conflits et
échecs gardent le formulaire. Un identifiant stable évite un doublon lors d’une
nouvelle tentative après une réponse perdue, tant que le formulaire est inchangé.
Le serveur DEV local possède une route `/api/khatma/{login-test|login-sandbox-group}`
avec contrôle de révision et persistance dans son store habituel.

Les fichiers `firebase-rules-dev.json` et `firebase-rules.json` sont préparés avec le même périmètre de groupes
que `review`. Ils reprennent l’architecture existante : les autorisations élève /
professeur sont contrôlées dans l’application, pas garanties par ces règles
publiques face à une requête directe. Ne pas confondre les tests applicatifs avec
une validation d’autorisation serveur. Aucune règle khatma n’est ajoutée à `firebase-rules-prod.json`.
Les règles n’ont pas été appliquées à
Firebase et aucun déploiement n’a été effectué pour cette fonctionnalité.

## Vérifications

- `node --test tests/khatma.test.cjs` : saisies multiples, plusieurs khatmas,
  identité et appartenance, validation des champs et dates, états d’absence,
  liste professeur, préservation des anciens noms, historique et clôture.
- Suites métier existantes : business-rules, jam, review, recitation-order,
  weekly-clock exécutées avec succès.
- Recette navigateur locale avec serveur `node tests/khatma-preview.cjs` :
  les requêtes Firebase sont redirigées vers des données fictives en mémoire.
  Trois saisies / deux khatmas, mise à jour du tableau professeur, récapitulatif,
  modification des cheikhs visible côté élève, historique intact, navigation,
  rechargement et déconnexion vérifiés. Tableau professeur à 390 px sans
  débordement de page. Aucun enregistrement de test dans Firebase.

La recette navigateur précédente utilisait les pages candidates de production avec
Firebase simulé. Après la décision « DEV d’abord », les points d’entrée khatma
de production ont été retirés et le serveur de recette cible les pages DEV.

Recette des listes communes : ajout depuis groupe 1, lecture depuis groupe 2
et depuis la page élève, puis suppression des lignes de test vérifiés dans
le navigateur. Liens de démonstration locale sur le port 4190 ; données fictives
en mémoire, perdues au redémarrage du serveur.

## Publication DEV du 20 septembre

Le chemin Firebase khatma renvoie HTTP 401 avant publication. Ajouter le bloc
`docs/khatma-firebase-dev.json` sous `rules` dans les règles existantes, en
conservant toutes les autres règles. Ce bloc autorise uniquement les groupes
DEV et leurs listes communes, pas les groupes de production. Ne pas remplacer
l’ensemble des règles par le fichier DEV : cela modifierait les autres activités.
