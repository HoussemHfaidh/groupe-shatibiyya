# Gestion des étudiants — 11 octobre 2026

Le menu professeur `إدارة الطلاب` utilise le sélecteur de groupe existant.
Ajout : nom et email obligatoires. Modification : nom et/ou email. Suppression :
confirmation, retrait du groupe et suppression de ses entrées loginEmails dans ce groupe.
La liste générale, les activités et les historiques continuent à utiliser RosterModel.
Les anciennes adresses dont seul le hash est stocké ne peuvent pas être affichées :
l'interface indique un accès existant et permet de remplacer l'adresse.

Les changements de liste et d'accès sont enregistrés dans le même PUT conditionnel
ETag du config du groupe. Un conflit ne produit aucune sauvegarde partielle.
Le mode de connexion existant par email est conservé. Aucun email n'est envoyé.
Les accès supprimés ou remplacés sont revérifiés au chargement/rafraîchissement
du portail étudiant. Un email présent dans plusieurs groupes privilégie le groupe
choisi dans le lien du portail.

Validation : tests/student-admin.test.cjs, tests/student-admin-browser.cjs
(backend simulé, vrais écrans professeur/étudiant, conflit ETag, ajout, connexion,
renommage, remplacement d'email, révocation et suppression), tests/roster.test.cjs.
