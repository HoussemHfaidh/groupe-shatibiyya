# Rattrapage — 13 octobre 2026

Section التدارك professeur et élève. Stockage isolé dans config/makeup et config/groups/group2/makeup, avec les permissions config déjà existantes. Dette unique par élève et cours, motifs fusionnés, historique de validation conservé sans expiration hebdomadaire. Les imports sont additifs et ne rouvrent pas les cours déjà validés. Écriture conditionnelle ETag, erreurs et conflits explicites.

Le professeur joint une image (3 Mo maximum), renseigne les cours dans les lignes nominatives, puis publie. Pas d'OCR automatique ni de liaison à حالة الطلاب pour cette première étape. L'élève connecté sans dette peut confirmer un autre élève. Le bandeau dans أسبوعي ouvre les dettes personnelles. Les autorisations serveur héritent du modèle existant des chemins config ; l'identité et l'éligibilité sont contrôlées dans l'application.

L'image actuelle est importée directement dans Firebase avec les dettes transcrites, sans ajouter de fichier nominatif au dépôt Git. 13 couples élève/cours pour 6 élèves ; deux motifs concernent le cours 109 d'une même élève et sont fusionnés. Les données avant import sont sauvegardées hors dépôt. Aucun état de validation n'est inventé.

Validation : 54 tests de modèles, test navigateur de rappel/éligibilité/confirmation/conflit, intégration des pages professeur et élève des deux groupes avec Firebase simulé.
