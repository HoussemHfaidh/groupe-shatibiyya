# Présence Zoom — professeur DEV

Ouvrir `prof-login-dev.html`, section « الحضور ». À chaque fin de séance,
importer le rapport brut détaillé Zoom en `.xlsx` ou `.csv`. Chaque séance
reste accessible dans le sélecteur. Un fichier correspond à une séance ; les
colonnes de résultat ajoutées dans l'exemple Excel sont ignorées.

Les noms sont rapprochés de la liste courante du groupe sélectionné : espaces,
ponctuation, accents, variantes arabes et transcriptions latines sont normalisés.
Les correspondances exactes ou nettement distinctes sont automatiques ; les cas
ambigus restent à revoir dans « مطابقة قائمة المجموعة ». Chaque nom Zoom est
visible avec le nom officiel associé, modifiable par le professeur. Les corrections
sont mémorisées pour ce groupe et les prochains imports dans ce navigateur. Un
élève retiré de la liste ne conserve pas une ancienne association silencieuse.

Les connexions du même élève sont fusionnées. La durée est désormais calculée
depuis Join time / Leave time : union des intervalles, limitée aux périodes où
Gharbi est connecté, sans double comptage des appareils simultanés. La colonne
Zoom arrondie reste conservée à titre de source mais ne détermine plus le ratio.
Les minutes affichées ont deux décimales au maximum. Les seuils utilisent les
durées exactes : retard dès 5 minutes après la première arrivée de Gharbi,
présence faible strictement sous 70%. Les durées ne dépassent plus celle de Gharbi.

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
synchronisation Firebase des présences ou des correspondances. L'import de la même séance
(mêmes premières/dernières heures du professeur) remplace ses calculs en
conservant les choix manuels par nom. Un échec de lecture, d'analyse ou de
stockage conserve les séances précédentes. Aucun fichier participant ni
adresse email n'est ajouté au dépôt ; le fichier source n'est pas modifié.

Tests : `node --test tests/attendance.test.cjs`. Recette navigateur : lancer
`node tests/khatma-preview.cjs`, puis `node tests/attendance-browser.cjs`
(Playwright disponible dans NODE_PATH), avec éventuellement le chemin d'un
exemple `.xlsx` comme argument. Le serveur simule Firebase localement.

Version 2 : les enregistrements bruts sont conservés pour recalculer une séance
après une correction. Les anciennes séances restent lisibles sans être réécrites ;
réimporter leur CSV pour bénéficier du nouveau calcul. Les statuts manuels sont
conservés lors du réimport et de la fusion. Les noms non rattachés restent visibles
dans le rapport avec une note de vérification ; aucune absence n’est déduite tant
que les identités ne sont pas résolues. Le stockage v1 (tableau de séances) est
converti en v2 (sessions et aliases) uniquement à la prochaine sauvegarde.
