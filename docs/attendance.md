# Présence Zoom — professeur DEV

Ouvrir `prof-login-dev.html`, section « الحضور ». À chaque fin de séance,
importer le rapport brut détaillé Zoom en `.xlsx` ou `.csv`. Chaque séance
reste accessible dans le sélecteur. Un fichier correspond à une séance ; les
colonnes de résultat ajoutées dans l'exemple Excel sont ignorées.

Les connexions sont regroupées par nom (espaces et casse normalisés, sans
rapprochement approximatif entre noms). La durée est la somme de la colonne
Zoom « Duration (minutes) », comme dans le fichier de référence. Le premier
Join time et le dernier Leave time sont affichés. Les lignes de salle d'attente
sont exclues.

Gharbi est le professeur de référence : somme de ses durées comme dénominateur,
première entrée comme début. « دخول متأخر » est activé dès 5 minutes de retard
et colore le nom et l'indicateur en jaune. « حضور أقل من 70% » utilise le ratio
non arrondi strictement inférieur à 70%. Une somme supérieure à 100% n'est pas
plafonnée : les connexions qui se chevauchent sont additionnées comme dans
l'exemple (Houssem : 167 / 162). Un message explique ce cas dans l'interface.

Les motifs « خروج باستئذان », « خروج بدون استئذان » et
« إخراج لعدم الاستجابة » sont trois boutons indépendants. Un clic active la
couleur et la coche, un second désactive. Ils ne modifient pas les calculs.

Le tableau complet apparaît en aperçu ajusté à la largeur de l'écran, y compris
avec Gharbi sur la première ligne, ses heures, sa durée et 100% de présence.
Les compteurs de participants restent hors professeur. L'aperçu est disponible
sur téléphone. « تكبير الجدول » ouvre l'image en grand pour lire les détails.
« تعديل حالات الخروج » ouvre le tableau interactif ; chaque modification
met à jour immédiatement l'aperçu. « تصدير الجدول كاملا PNG » télécharge une
image de tous les participants et toutes les colonnes, avec date, groupe,
référence Gharbi et légende. L'export ne dépend pas du défilement à l'écran.
« مشاركة الجدول » ouvre le partage natif quand les fichiers sont pris en
charge, sinon télécharge la même image à joindre manuellement.

Les heures sources restent intactes pour les calculs. L'affichage demandé
« GMT−2 » soustrait deux heures aux heures du fichier Zoom, comme les colonnes
R/S de l'exemple (07:46:02 → 05:46:02). La date affichée de séance suit aussi
ce décalage en cas de passage à la veille. CSV : dates ISO ou dates Zoom mois/jour/année avec heures,
séparateur virgule, point-virgule ou tabulation. Fichiers limités à 10 Mo.
Les fichiers protégés, `.xls`, dates Excel 1904 et rapports sans heures
d'entrée/sortie ne sont pas pris en charge ; un message bloque l'import.

Stockage local au navigateur, séparé par groupe et mode DEV. Pas de
synchronisation Firebase ni de déploiement. L'import de la même séance
(mêmes premières/dernières heures du professeur) remplace ses calculs en
conservant les choix manuels par nom. Un échec de lecture, d'analyse ou de
stockage conserve les séances précédentes. Aucun fichier participant ni
adresse email n'est ajouté au dépôt ; le fichier source n'est pas modifié.

Tests : `node --test tests/attendance.test.cjs`. Recette navigateur : lancer
`node tests/khatma-preview.cjs`, puis `node tests/attendance-browser.cjs`
(Playwright disponible dans NODE_PATH), avec éventuellement le chemin d'un
exemple `.xlsx` comme argument. Le serveur simule Firebase localement.
