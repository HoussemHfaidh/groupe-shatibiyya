# Livraison du 27 septembre 2026

## Périmètre

Gestion centrale des élèves par groupe : ajout, renommage avec alias des anciens noms, retrait des listes actives avec conservation des résultats historiques. Synchronisation des semaines ouvertes de جمع et de révision. Protection des écritures de liste par ETag, conservation des profils loginEmails, des autres champs et des autres groupes. Une liste vide reste vide après rechargement. Les sauvegardes différées conservent leur groupe d’origine.

Présence disponible sur la page professeur de production : import CSV/XLSX, correspondance avec la liste du groupe, corrections et retraits/restaurations par séance, export intégral. Le pourcentage utilise l’union des intervalles de connexion de l’élève intersectée avec celle de Gharbi. Le seuil de 70 % utilise les durées sans arrondi. L’affichage conserve assez de précision pour ne pas afficher 70 % lorsqu’une présence est inférieure au seuil. Les présences restent enregistrées dans le navigateur, séparées par groupe et par environnement.

Les corrections de noms Zoom propres à une séance restent distinctes du renommage central d’un élève. Les anciens résultats des élèves retirés restent dans l’historique. Ajouter un nom à la liste ne crée pas un nouveau compte de connexion par e-mail.

Les ختمات restent en DEV : leurs chemins Firebase de production sont encore fermés. Aucun changement des règles Firebase ni des comptes n’a été publié. Les permissions Firebase existantes ne constituent pas une authentification du professeur.

## Validation

- 39 tests automatisés : présence, seuils, calculs, identité, groupes, horloges, جمع, révisions et ختمات.
- Navigateur : ajout/renommage/retrait dans les deux groupes, historique et ancien profil de connexion, dernier élève retiré, conflit, panne réseau, doublon, sauvegarde suivie d’un changement immédiat de groupe.
- Non-régression : تسميع, confirmation/annulation, révisions avec conflit et reprise, exports CSV/PNG, partage du tableau complet.
- Présence : fichier Excel fourni, conservation des états, changement de groupe, affichage mobile, export et navigation entre sections.
- Tous les tests navigateur utilisent des données Firebase simulées ; aucune donnée réelle n’a été modifiée pour les tests.

Base de livraison : 1f87d02. Les fichiers du dossier de travail historique n’ont pas été publiés en bloc. La copie de livraison se trouve dans `.releases/production-20260927` du dossier de travail.
