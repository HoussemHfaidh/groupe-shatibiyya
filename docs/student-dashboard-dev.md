# Accueil élève et actualisation DEV — 29 septembre 2026

Le portail DEV élève affiche « أسبوعي » dès la connexion, avant les sections.
Quatre cartes reprennent les activités et ouvrent la section correspondante.
Le résumé et la barre de progression utilisent uniquement la semaine courante
du groupe, à 06:00 Europe/Paris (samedi groupe 1, dimanche groupe 2).

- التسميع : `done` et `makeup` sont validés, le rattrapage est indiqué.
- واجب الجمع : confirmé pour cet élève dans la semaine active. Un devoir sans
  première validation reste en attente. L'activité actuellement désactivée
  pour le groupe 2 reste neutre ; cette fonctionnalité ne modifie pas ce réglage.
- المراجعة : complète, partielle ou non enregistrée. Une révision partielle
  n'est pas comptée comme activité complète.
- متابعة الختمات الفردية : au moins un suivi enregistré pour la semaine.
  C'est l'enregistrement du formulaire, pas une preuve de présence à la séance.

☀️ toutes les activités disponibles sont complètes ; 🌤️ progression partielle ;
☁️ activités à commencer. Les données indisponibles sont explicitement inconnues,
jamais transformées en manquements. La météo ne calcule pas de suspension.

`live-data-dev.js` écoute les événements REST Firebase `put` et `patch` sur les
quatre espaces DEV de la connexion (config, jam, review, khatma), puis relit les
sources. Référence : https://firebase.google.com/docs/database/rest/retrieve-data#section-rest-streaming
Une vérification toutes les 30 secondes couvre les indisponibilités du flux,
les données locales et les changements de semaine. Reprise au retour sur l'onglet,
au focus et au rétablissement du réseau ; arrêt des connexions à la déconnexion,
au changement d'élève et pendant que l'onglet est masqué. Les échecs HTTP ou délais
expirés affichent un état de récupération. Aucun nouveau chemin d'écriture.

La page professeur « حالة الطلاب » écoute les mêmes sources pendant son ouverture,
relit aussi les statuts de récitation et conserve les corrections prioritaires.
La saisie d'une cellule n'est pas remplacée par une actualisation en arrière-plan.
Les événements localStorage mettent à jour les autres onglets du même navigateur.
Les présences et les corrections de matrice restent locales au navigateur ;
elles ne sont pas synchronisées entre appareils. Les semaines clôturées restent
des instantanés, hors correction explicite du professeur.

## Recette

1. Connexion DEV avec un élève enregistré : voir la météo avant les sections.
2. Faire confirmer une activité depuis un autre onglet : la carte évolue sans
   rechargement et le tableau professeur ouvert reçoit la nouvelle donnée.
3. Confirmer une révision incomplète : elle reste partielle, pas verte.
4. Cliquer sur une carte puis revenir via « أسبوعي » ; l'actualisation ne doit
   pas ramener une autre section au premier plan.
5. Couper puis rétablir le réseau : vérifier l'état de connexion et la reprise.
6. Vérifier le groupe 2 et le prochain changement de semaine : aucun résultat
   de la semaine précédente n'est repris comme validation courante.

Tests : modèles (26 tests), règles métier (12), recettes navigateur dashboard
et matrice avec Firebase et événements temps réel simulés. Aucun message envoyé
et aucune donnée réelle modifiée par les tests.

## Données réelles et recette du 29 septembre

`scripts/prepare-real-dev.mjs --apply` enrichit les chemins `login-test-group1/2`
avec les listes, accès et historiques de production en lecture seule. Les essais
DEV existants restent prioritaires. Les semaines de récitation DEV sont prolongées
jusqu'à la semaine courante, sans valider de récitation automatiquement. Les chaînes
الجمع déjà commencées en DEV sont conservées pour éviter les collisions de versets.
Une sauvegarde privée est créée sous `data/`, ignoré par Git, avant toute écriture.
Une liste fermée de destinations DEV et les ETags protègent chaque écriture.

Préparation effectuée : 15 élèves groupe 1, 25 groupe 2 ; 4 semaines de récitation
par groupe, 16/23 enregistrements de révision et 6/8 suivis khatma, essais DEV inclus.
Le module review-dev reprend désormais les mêmes règles de roster/alias et les
mêmes protections de mutation que review.js de production, dans un fichier séparé.

Confirmer la révision d'un camarade valide **ce camarade**, pas le validateur.
L'accueil explique maintenant cette situation et se rafraîchit immédiatement
après une sauvegarde de révision et au retour via « أسبوعي ».

`node tests/dev-live-roundtrip.cjs --run-live` a vérifié le vrai flux EventSource Firebase DEV dans
Chrome : écriture d'une métadonnée unique sous une semaine DEV, événement reçu,
relecture immédiate, puis suppression vérifiée. Aucun résultat d'élève n'a changé.
Ce test est volontairement séparé des tests ordinaires : il écrit temporairement
uniquement dans `review/groups/login-test-group1/.../_devRealtimeChecks/<UUID>`.
