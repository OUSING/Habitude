# Habitude — Habit Tracker

App mobile-first de suivi d'habitudes. React + Vite + TypeScript + Tailwind CSS,
stockage 100% local (IndexedDB via Dexie.js), prête à être packagée en app
iOS/Android avec Capacitor.

## Stack

- **UI** : React 18 + TypeScript, Tailwind CSS (mobile-first, sans `hover:`)
- **Icônes** : lucide-react
- **Données** : Dexie.js (IndexedDB) pour les habitudes et les logs — offline-first
- **Réglages** : `@capacitor/preferences` (thème) — fonctionne aussi bien en
  navigateur (fallback localStorage intégré au plugin) que sur device
- **Notifications** : `@capacitor/local-notifications` (rappels programmés,
  no-op silencieux hors app native)

## Connexion Google / sauvegarde Drive (web)

Le sign-in web utilise le flux OAuth "authorization code" de Google
Identity Services : le code est échangé contre un access token *et* un
refresh token par deux petites fonctions serverless (`api/google/token.js`,
`api/google/refresh.js`), ce qui permet à la session de rester valide
pendant des mois au lieu d'une heure, et évite de dépendre des cookies
tiers de Google (bloqués par défaut dans Brave, Safari, Firefox strict).

À configurer avant déploiement :

1. **Google Cloud Console** (le même client OAuth que `VITE_GOOGLE_CLIENT_ID`) :
   - *Authorized JavaScript origins* et *Authorized redirect URIs* :
     ajouter l'origine exacte de déploiement (ex. `https://habitude.vercel.app`).
   - *OAuth consent screen* : le statut doit être **"In production"**, pas
     "Testing" — en mode Testing, Google fait expirer les refresh tokens
     au bout de 7 jours quoi qu'il arrive dans le code.
2. **Variables d'environnement côté serveur** (ex. Vercel → Project
   Settings → Environment Variables, jamais dans `.env` commité) :
   - `GOOGLE_CLIENT_ID` (même valeur que `VITE_GOOGLE_CLIENT_ID`)
   - `GOOGLE_CLIENT_SECRET` (Google Cloud Console → le même client OAuth)
3. Un utilisateur qui s'est déjà connecté *avant* ce changement (ancien
   flux implicite, sans refresh token) doit se déconnecter, retirer
   l'accès de Habitude sur <https://myaccount.google.com/permissions>, puis
   se reconnecter une fois — cela force un nouvel écran de consentement
   qui inclut le refresh token.

## Démarrage

```bash
npm install
npm run dev
```

Ouvre l'app sur `http://localhost:5173`. Aucune configuration serveur n'est
nécessaire : tout tourne en local dans IndexedDB.

## Build web

```bash
npm run build   # sort dans /dist
npm run preview # sert le build de prod localement
```

## Packager avec Capacitor (iOS / Android)

1. Génère les projets natifs (une seule fois) :

   ```bash
   npx cap add android
   npx cap add ios      # nécessite macOS + Xcode
   ```

2. À chaque changement du code web, resynchronise avant d'ouvrir l'IDE natif :

   ```bash
   npm run cap:sync
   npm run cap:open:android   # ouvre Android Studio
   npm run cap:open:ios       # ouvre Xcode
   ```

3. Avant publication, pense à :
   - changer `appId` dans `capacitor.config.ts` (actuellement
     `com.example.habittracker`) ;
   - fournir une icône `ic_stat_habit` pour les notifications Android
     (`android/app/src/main/res/drawable*`) ;
   - vérifier les permissions de notifications dans
     `android/app/src/main/AndroidManifest.xml` (Capacitor les ajoute
     automatiquement pour `@capacitor/local-notifications`, mais ça vaut le
     coup de vérifier après `cap sync`).

## Structure du projet

```
src/
  types/habit.ts          Types Habit, HabitLog, Frequency
  services/
    db.ts                 Définition Dexie (IndexedDB)
    habitService.ts        CRUD habitudes/logs + calcul streak/taux
    notifications.ts       Intégration @capacitor/local-notifications
    settings.ts             Intégration @capacitor/preferences (thème)
  hooks/
    useHabits.ts            Hooks réactifs (dexie-react-hooks liveQuery)
    useTheme.ts              Dark mode
    useNotificationSetup.ts Demande de permission au démarrage
  utils/
    date.ts, palette.ts, streak.ts   Fonctions pures, sans dépendance UI
  components/
    ui/                     Button, Modal, ColorPicker, WeekdaySelector, TimePicker
    HabitCard.tsx, WeekStrip.tsx, FAB.tsx, BottomNav.tsx,
    Heatmap.tsx, WeekChart.tsx
  screens/
    Dashboard.tsx, AddEditHabit.tsx, Stats.tsx
  App.tsx                  État d'écran + shell mobile (max-w-app, centré)
```

## Choix mobile-first notables

- Aucune classe `hover:` — tout le feedback tactile passe par `active:`
  (changement de couleur/opacité + `scale-95` sur les boutons).
- Toutes les zones cliquables ont `min-w-[44px] min-h-[44px]` (`.tap-target`).
- `html, body, #root` sont `overflow: hidden` ; seuls les conteneurs
  `.scroll-area` défilent, avec `overscroll-behavior: contain` — ça évite le
  bug classique du fond blanc qui apparaît quand iOS "rebondit" en haut/bas
  de page dans une WebView Capacitor.
- `viewport-fit=cover` + les classes `pt-safe-top` / `pb-safe-bottom`
  (mappées sur `env(safe-area-inset-*)`) gèrent l'encoche et la barre de
  gestes sans configuration native supplémentaire.
