# Matrice professeur — DEV local

Entrée : `prof-login-dev.html`, onglet « حالة الطلاب ». Le code est chargé uniquement
par la page professeur DEV. Aucune page ni règle Firebase de production modifiée
pour cette fonctionnalité. Publication limitée aux points d’entrée DEV.

Deux tableaux suivent chaque élève du groupe pour la semaine sélectionnée.
Le calendrier reprend le samedi/dimanche et 06:00 Europe/Paris des activités.
Les données apparaissent en aperçu jusqu'à la clôture manuelle du professeur.

## Sources

- Retards et exclusions pour non-réponse : séances du module présence situées
  dans la semaine. Importer les séances et terminer les correspondances de noms.
- Révision partielle : confirmation `complete: false` dans la révision hebdomadaire.
- Absence de révision : aucun enregistrement pour un élève inscrit à cette semaine.
  Elle ne compte pas aussi comme révision partielle.
- Formulaire khatma manquant : aucun enregistrement de séance dans la semaine,
  pour un élève présent dans la liste hebdomadaire khatma.
- واجب الجمع : absence de confirmation dans le devoir de la semaine.
- Récitation : statut autre que `done` ou `makeup` dans les semaines de récitation
  comprises dans cette période.
- Saisie professeur : nombre de rattrapages non effectués, absences sans excuse
  en Shatibiyya, absences sans excuse en iqra individuel. Saisir explicitement 0
  lorsqu'il n'y en a aucune. Aucun rapprochement automatique entre rattrapage
  non effectué et récitation validée en retard.

Un module/semaine non disponible reste « — », sans inventer un manquement. Le professeur peut fournir une valeur manuelle.
La clôture est impossible tant qu'il manque des données ou avant la fin de semaine.
Une semaine de présence partiellement importée doit être complétée avant clôture :
l'application ne dispose pas d'un calendrier des séances attendues.

## Compteurs et historique

Le premier total inclut le solde antérieur ; chaque tranche complète de 3
ajoute un point à « تراكم 3 مرات ». Le reste (0, 1 ou 2) est reporté.
Le deuxième total inclut ses propres points et son solde antérieur. Dès 3,
la semaine suivante est marquée suspendue et son solde passe à 0.
Le total à l'origine de la suspension reste visible dans l'historique.
Le solde du premier tableau reste indépendant.

La clôture conserve un instantané des lignes, la période concernée et la date.
Le professeur peut ensuite corriger chaque manquement, le point de cumul, les
soldes antérieurs et la décision de suspension. Les totaux restent calculés.
Une croix ajoute ou retire le manquement ; le champ numérique précise le nombre.
Le bouton ↺ restaure la valeur source. Les corrections restent prioritaires lors
des actualisations. Une correction historique recalcule les semaines clôturées
suivantes ; le journal conserve chaque ancienne/nouvelle valeur et sa date.
Elle est unique pour une semaine ; une semaine antérieure à la dernière clôturée
ne peut plus être clôturée. Les compteurs démarrent à la première semaine clôturée,
sans sanction rétroactive des anciennes semaines non clôturées.
La suspension est un statut professeur, pas un blocage de la saisie élève.

Stockage : `shatibiyya-matrix-v1:<storageId>` dans localStorage, isolé par groupe
et environnement test/sandbox, comme les présences. Les instantanés et les saisies
ne sont pas synchronisés entre appareils. Effacer le stockage du navigateur les
supprime. Les autres activités sont lues depuis leurs sources DEV habituelles.

## Vérification

- `node --test tests/matrix.test.cjs`
- `node tests/matrix-browser.cjs` avec Playwright disponible dans NODE_PATH.
  Toutes les requêtes sont interceptées : aucune donnée réelle Firebase lue/écrite.
  Saisie, clôture, suspension, rechargement, groupes isolés, largeur mobile et
  intégration/navigation dans la page professeur complète sont vérifiés.

## Partage des deux tableaux

Les boutons « معاينة الصورة », « تصدير PNG » et « مشاركة الجدولين » produisent
une image unique de tous les élèves et colonnes, indépendamment du défilement.
Elle indique le groupe, la période, la semaine de khatma concernée et si le
résultat est provisoire ou clôturé. Les corrections professeur sont marquées
par un astérisque ; les champs de saisie et le journal ne sont pas exportés.
Le partage natif utilise un fichier PNG. S'il n'est pas disponible, le même PNG
est téléchargé pour être joint manuellement à WhatsApp ou une autre application.
Les tests couvrent le PNG, le partage natif simulé et 40 élèves hors écran.
