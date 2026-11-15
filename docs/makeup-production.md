# Rattrapage — règles simplifiées, 15 novembre 2026

## Validation élève

L'élève connecté peut confirmer le rattrapage d'un autre élève de son groupe
si lui-même n'a aucun rattrapage **en attente pour ce même cours**. Ses
rattrapages sur d'autres cours ne le bloquent pas. Une fois son propre cours
rattrapé, il peut confirmer un camarade sur ce cours.

Exemple : A doit rattraper le cours 115 et B les cours 115 et 116. A ne peut
pas confirmer B pour le 115, mais peut le confirmer pour le 116.

L'identité du validateur vient de la session connectée. Le formulaire demande
seulement le cours et le camarade. Le bouton est désactivé pour un cours que
le validateur doit encore rattraper, avec une explication et la possibilité de
choisir un autre cours. Le contrôle est répété sur les données relues avant
l'écriture. L'auto-validation, les élèves hors du groupe et les doubles
confirmations restent refusés. Aucune échéance hebdomadaire.

Avant cette correction, un seul rattrapage en attente bloquait le validateur
sur tous les cours et empêchait même son nom d'apparaître dans le formulaire.

## Liste professeur et imports

Les cours terminés restent visibles entre deux imports, y compris après un
rechargement ou un changement de semaine. Au prochain import **réussi**, tous
les cours déjà terminés quittent la liste et les compteurs affichés, y compris
lorsqu'ils figurent encore dans le fichier. Les cours en attente sont conservés,
les nouveaux sont ajoutés et les doublons ne sont pas créés.

Le retrait de la liste est matérialisé par `archivedAt` sur les dettes terminées.
Ces enregistrements internes préservent les présences déjà acquises dans le
registre et empêchent un ancien fichier de rouvrir un rattrapage terminé.
Une nouvelle confirmation reste visible jusqu'à l'import suivant.
Un import invalide, interrompu ou refusé pour conflit ne nettoie pas la liste.

Le professeur sélectionne une image JPG/PNG/WebP ou un tableau Excel XLSX/XLS
puis clique sur نشر التدارك. La lecture remplit automatiquement les dettes.
Les images doivent présenter les quatre colonnes (nom, test, présence, absence)
avec des bordures lisibles. Les fichiers Excel sont lus par leurs en-têtes.
Les traits d'union séparent des cours explicites : 108-111 signifie 108 et 111.
Les noms non reconnus, cellules illisibles et formats invalides bloquent l'import
entier. Les fichiers sont traités localement, sans service OCR externe.

Stockage : `config/makeup` et `config/groups/group2/makeup`. Les imports et les
confirmations utilisent les ETags Firebase pour éviter les écrasements concurrents.
Un changement de groupe annule une lecture en cours. Les permissions existantes
restent celles des chemins config. Aucune migration des données en production
n'est nécessaire : les anciennes validations seront retirées de la liste lors
du prochain import réussi. Recharger les anciennes pages ouvertes.

## Vérifications

- `node --test tests/makeup.test.cjs tests/makeup-import.test.cjs tests/presence-register.test.cjs`
- `node tests/makeup-browser.cjs` : exemple 115/116, changement de cours, annulation,
  relecture des droits avant écriture, conflit et affichage mobile.
- `TEST_PRODUCTION=1 node tests/makeup-integration.cjs` : pages de production des
  deux groupes avec backend simulé, imports XLSX/XLS, conservation entre imports,
  nettoyage au prochain import réussi, erreur sans mutation, changement de groupe.
