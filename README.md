# Suivi Shaṭibiyya

Web app gratuite pour suivre la mémorisation hebdomadaire de La Shaṭibiyya.

## Ce que c'est

C'est un site web, utilisable comme une app depuis téléphone ou ordinateur.

- Le professeur ouvre `index.html`.
- Les élèves ouvrent `student.html`.
- Les élèves envoient leur état : fait, rattrapage ou non fait.
- Le professeur récupère les réponses, applique au tableau, exporte une image PNG.
- WhatsApp sert seulement à partager l'image finale.

## Où sont sauvegardées les données ?

En mode gratuit en ligne, les données sont sauvegardées dans **Firebase Realtime Database**.

Firebase garde :

- la liste des élèves ;
- la liste des semaines ;
- les réponses envoyées par les élèves ;
- l'état "déjà appliqué" ou non pour chaque réponse.

Le tableau final reste aussi dans le navigateur du professeur avec `localStorage`, pour continuer à travailler même après un rechargement.

## Mode gratuit en ligne

1. Créer un projet Firebase avec le plan gratuit Spark.
2. Activer **Realtime Database**.
3. Copier l'URL de la base, par exemple :

```text
https://votre-projet-default-rtdb.europe-west1.firebasedatabase.app
```

4. Coller cette URL dans `config.js` :

```js
window.SHATIBIYYA_FIREBASE_DB_URL = "https://votre-projet-default-rtdb.europe-west1.firebasedatabase.app";
```

5. Mettre les règles de test depuis `firebase-rules.json`.
6. Héberger les fichiers gratuitement sur GitHub Pages ou Netlify.

Après ça :

- lien professeur : `https://votre-site.../index.html`
- lien élève : `https://votre-site.../student.html`

Le professeur peut aussi coller l'URL Firebase dans l'interface, puis cliquer sur **Copier le lien élève**. Le lien copié contient l'URL de la base.

## Publier gratuitement avec GitHub Pages

Le dossier peut être publié directement comme site statique.

Fichiers nécessaires en ligne :

- `index.html`
- `student.html`
- `styles.css`
- `app.js`
- `student.js`
- `config.js`
- `firebase-rules.json`
- `README.md`

Fichiers uniquement pour tester en local :

- `server.js`
- `data/store.json`

Le dossier `data/` est ignoré par Git pour ne pas publier les réponses de test.

Étapes GitHub Pages :

1. Créer un repository GitHub, par exemple `groupe-shatibiyya`.
2. Envoyer les fichiers du projet dans ce repository.
3. Aller dans **Settings > Pages**.
4. Dans **Build and deployment**, choisir **Deploy from a branch**.
5. Choisir la branche `main` et le dossier `/root`.
6. GitHub donnera un lien du type :

```text
https://votre-nom.github.io/groupe-shatibiyya/
```

Liens à utiliser :

```text
https://votre-nom.github.io/groupe-shatibiyya/
https://votre-nom.github.io/groupe-shatibiyya/student.html
```

## Voir le tableau

Le tableau est dans la page professeur :

```text
index.html
```

En local :

```text
http://127.0.0.1:4173/
```

À la fin de la semaine :

1. Cliquer sur **Récupérer les réponses**.
2. Cliquer sur **Appliquer au tableau**.
3. Les réponses reçues sont appliquées, et les élèves qui n'ont rien envoyé sont automatiquement mis en rouge.
4. Cliquer sur **Exporter l'image** et partager le PNG sur WhatsApp.

## Lancer en local pour tester

```bash
node server.js
```

Puis ouvrir :

```text
http://127.0.0.1:4173/
http://127.0.0.1:4173/student.html
```

En local, les réponses sont sauvegardées dans :

```text
data/store.json
```

## Ancien import manuel

L'import WhatsApp reste disponible comme secours, mais ce n'est plus le flux principal.

Formats reconnus :

```text
[23/05/2026, 18:10] أنيس عمار: تم التسميع
23/05/2026, 18:22 - أسماء شلبي: استدراك تم
حمزة الوزتي: لا، لم أتمكن هذا الأسبوع
```
