# واجب الجمع — version élève DEV

Pages concernées : `student-login-dev.html` et `student-login-test.html`.
La page de production `student.html` reste inchangée. L'interface professeur DEV
est `prof-login-dev.html`.

Après connexion, l'élève choisit `التسميع` ou `واجب الجمع`.
Les validations de ces sections sont indépendantes : le module الجمع ne lit ni
`config/statuses`, ni `readyOrder`, ni les réponses de التسميع.

## Espace Firebase indépendant

Le projet utilise Firebase Realtime Database : l'espace dédié est un nœud `jam`,
à côté de `config` et `submissions`.

- DEV données : `jam/groups/login-test-group1` et `jam/groups/login-test-group2`.
- DEV tests : `jam/groups/login-sandbox-group1` et `jam/groups/login-sandbox-group2`.
- Aucun chemin الجمع de production n'est activé.

Les règles correspondantes sont préparées dans `firebase-rules-dev.json`.
Elles doivent être appliquées sur Firebase avant une utilisation distante ; cette
modification locale ne déploie pas les règles et ne crée pas de données distantes.
Pour le groupe 1, le portail crée le devoir de la semaine à sa première ouverture,
avec une écriture conditionnelle, sans toucher aux devoirs précédents. La liste
numérotée s'affiche aussi en attente de synchronisation ; une erreur Firebase
reste signalée et aucune validation n'est considérée comme sauvegardée en échec.

Chaque clé du groupe identifie un devoir, avec :

- `id`, `title`, `createdAt` ;
- `students` : liste des élèves de ce devoir ;
- `verses` : une référence ou un texte de verset par élève ;
- `confirmations` : élève, index du verset, validateur, date.

`JamModel.create` prépare un devoir ; `JamModel.confirm` enregistre une validation.
Ces fonctions sont partagées pour permettre la future interface professeur.
La première validation devra être enregistrée par cette interface professeur.

Pour chaque devoir, les élèves non validés sont rouges et les versets disponibles
verts. Une confirmation rend l'élève vert et le verset rouge. Chaque élève vert
peut valider plusieurs autres élèves, chacun avec un verset disponible distinct.
Un élève ne peut se valider lui-même, être validé deux fois, ou réutiliser un verset.

Le changement élève/verset est une seule écriture conditionnelle Firebase
(`ETag` / `if-match`). Si quelqu'un a modifié les données entre lecture et écriture,
le portail refuse l'écriture et demande de rafraîchir. Le serveur local utilise une
révision pour le même contrôle. Aucun envoi de message ou fichier audio n'est ajouté.

## Vérification

- `node tests/business-rules.test.mjs`
- `node tests/jam.test.cjs`
- `node tests/jam-browser.cjs` (Playwright et Chrome nécessaires)

Le test navigateur utilise exclusivement des données simulées : aucune requête
Firebase réelle. Il vérifie les couleurs, l'indépendance avec التسميع, une
confirmation atomique, le conflit d'écriture, la navigation et la déconnexion.

## Semaines automatiques — groupe 1

- Le devoir 45 commence le 5 septembre 2026.
- Passage au 46 le samedi 12 septembre à 00 h, heure de Paris, puis incrément
  hebdomadaire chaque samedi à 00 h, y compris lors des changements d'heure.
- L'élève voit uniquement le devoir courant, sans sélecteur d'historique.
- La clôture bloque les confirmations du devoir précédent : pas de rattrapage.
- Les devoirs passés et leurs confirmations sont conservés pour le futur tableau professeur.
- Chaque nouveau devoir génère `الآية 1` à `الآية N`, N étant le nombre d'élèves
  du groupe à la création. Les élèves commencent rouges, les versets verts.
- Une liste déjà utilisée reste intacte. Les devoirs vides de la première version
  sont complétés automatiquement s'ils n'ont aucune confirmation.
- Le groupe 2 commence également au devoir 45, le dimanche 6 septembre, puis
  incrémente chaque dimanche selon son jour de groupe.

## Tableau professeur DEV

Le choix du groupe reste visible au-dessus des boutons التسميع et واجب الجمع.
Le tableau الجمع affiche les élèves, leur pourcentage de réussite et une colonne
par devoir enregistré, initialement 45. Les cellules sont rouges ou vertes.
Le professeur sélectionne un élève non validé et une آية disponible puis confirme.
Cette opération est partagée avec le portail élève et amorce la chaîne de validation.
Les archives restent visibles au professeur ; seules les validations du devoir
courant sont autorisées.

Sur localhost, الجمع utilise `/api/jam/<groupe DEV>` et le stockage `jam` de
`data/store.json`, avec contrôle de révision. Un libellé DEV local est visible.
Les deux portails doivent utiliser le même `devMode` et le même groupe.
Sur un hébergement distant, le transport Firebase reste actif. Vérification du
11 septembre : Firebase refuse actuellement la lecture du nouvel espace `jam`.
Les règles doivent donc être activées avant la synchronisation distante.

Les pages DEV chargent `app-dev.js` et `styles-dev.css`. Les fichiers
`app.js`, `styles.css`, `index.html` et `student.html` de production restent inchangés.
