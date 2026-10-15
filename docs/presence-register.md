# سجل الحضور — 15 octobre 2026

Section professeur indépendante du rapport Zoom détaillé, sur la page de production.
Données partagées via `config/presenceRegister` pour le groupe 1 et
`config/groups/group2/presenceRegister` pour le groupe 2. Les écritures utilisent
les ETag Firebase pour refuser un écrasement concurrent. Aucun changement de règles.

L'import demande date, numéro du cours et plage d'ayat. Le professeur vérifie tous
les noms (y compris les correspondances proposées), associe plusieurs connexions
au même élève ou ignore explicitement professeur/visiteurs. Aucun absent n'est
confirmé avant cette étape. La liste courante du groupe 1 exclut محمد الصادق الكشباطي
(variantes orthographiques normalisées). Les élèves non présents deviennent غائب.

Valeurs: x, غائب, لا, اعتذرت, متأخرة, تدارك, vide. x/retard/rattrapage comptent
comme présence, اعتذرت comme excuse et غائب/لا comme absence. Vide est exclu du
dénominateur. Chaque case est corrigeable; la correction reste prioritaire lors
d'un réimport ou changement de rattrapage. « استعادة القيمة التلقائية » rétablit
la valeur issue de l'import/du rattrapage. Le numéro du cours dans l'en-tête permet
de modifier les métadonnées. Les modifications sont journalisées dans `audit`.

Le rattrapage est une lecture dynamique de `makeup/debts`, même élève, même cours,
dette liée à حضور, غياب ou تدارك, confirmée. Les dettes d'examen seules ne modifient
pas la présence. Révocation d'une confirmation: retour à la valeur importée, sauf
correction manuelle. Actualisation en direct avec LiveData et repli toutes les 30 s.
Les renommages officiels de la liste sont projetés dans le registre.

Historique fourni: 14 élèves, cours 106–111, du 05/09 au 10/10/2026. Transcription
cellule par cellule, 76 présences / 7 excuses / 1 absence sur 84 valeurs. La reprise
proposée exige une association unique pour les 14 noms et refuse tout écrasement
d'un cours existant. Le groupe 2 reste sans historique jusqu'à réception de sa source.
Partage PNG du tableau complet via l'outil existant TableShare.

Tests: `node --test tests/presence-register.test.cjs tests/attendance.test.cjs tests/makeup.test.cjs`
et `node tests/presence-register-browser.cjs` (Playwright).

Correction 15 octobre: le registre s'affiche sans attendre le rattrapage. Lecture
de `makeup/debts` uniquement (sans image source). Réutilisation de l'abonnement
config partagé pour ne pas ajouter de connexions SSE au domaine Firebase.

Isolation après retour arrière: le registre ne crée aucune connexion EventSource.
Il lit les données uniquement quand sa section est ouverte, avec actualisation
à l'ouverture, au retour de focus, après une modification et toutes les 30 secondes.

Octobre 15 production regression fix: no permanent Firebase streams are opened
for this feature. The current student's app streams continue to run unchanged.
The register reads only when opened and polls locally every 30s while visible.

Groupe 2 image history: lessons 32–36, 6 September to 11 October 2026, 25 participants.
The original image-rate row is preserved; its group totals treat the two dash cells
as applicable attendance, matching the screenshot. Names are linked to the live roster
before the ETag-protected save; existing lessons block the operation.
