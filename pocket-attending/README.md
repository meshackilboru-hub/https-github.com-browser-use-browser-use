# Pocket Attending

An AI study and clinical-reference app for **medical students, residents and practitioners**, for Android and iOS.

- **Sign in** with Google, Apple (iOS), or email and password.
- **Profile by role.** Students and residents must pick their university or training institution from a searchable list, or type it in if it isn't listed. Students add their year of study and target exam; residents add their specialty and postgraduate year; practitioners add their specialty.
- **Four modes**, all tuned to the profile:
  - **Tutor** (practitioners see **Ask**): chat explanations, with an optional Socratic mode for students and residents. Practitioners get a guideline-based clinical reference with a warning not to enter identifying patient details.
  - **Questions** (practitioners: **Self-test**): exam-style multiple-choice questions with explanations for every choice and a running score.
  - **Cases**: a simulated patient. You take a history, examine, order tests and submit a diagnosis for feedback.
  - **Flashcards**: 8-card decks on any topic.
- **Account deletion** inside the app, which both app stores require.

```
pocket-attending/
├── mobile/            Expo (React Native) app: the Android and iOS client
│   └── src/app/       Screens (Expo Router): sign-in, onboarding, tabs
├── functions/         Firebase Cloud Functions: calls Claude, enforces daily limits, deletes accounts
├── firestore.rules    Security rules: people can only read and write their own profile
└── firebase.json
```

## How it works

```
Phone app ──(Firebase Auth: Google / Apple / email)──► Firebase
    │
    └── callable functions: chat · quiz · flashcards · deleteAccount
              │  checks sign-in, reads the profile from Firestore,
              │  counts usage (150 requests per user per day by default)
              ▼
          Claude API  (the API key lives only on the server, as a secret)
```

The app never holds the Claude API key. Every request goes through a Cloud Function that confirms who is signed in and reads their role from Firestore, so nobody can claim a different role or skip the daily limit.

## Before you start: accounts you need

| Account | Cost | Used for |
|---|---|---|
| [Firebase](https://console.firebase.google.com) (Blaze plan) | Pay as you go, small at low traffic | Sign-in, profiles, Cloud Functions. Functions that call outside APIs need the Blaze plan. |
| [Anthropic Console](https://console.anthropic.com) | Pay per use | The Claude API key |
| [Expo](https://expo.dev) | Free tier available | Cloud builds (EAS) for both platforms, so you don't need a Mac to build for iOS |
| [Google Play Console](https://play.google.com/console) | US$25 once | Publishing on Android |
| [Apple Developer Program](https://developer.apple.com/programs/) | US$99 per year | Publishing on iOS, and Sign in with Apple |

## 1. Set up Firebase

1. Create a Firebase project and upgrade it to the **Blaze** plan.
2. **Authentication → Sign-in method**: enable **Google**, **Apple** and **Email/Password**.
   - Apple needs a Services ID and key from your Apple Developer account. Firebase's Apple provider page walks through it.
3. **Firestore Database**: create a database in production mode.
4. **Project settings → Your apps**: add a **Web app**. Copy its config values into `mobile/.env` (see step 3).
5. Google Cloud console → **APIs & Services → Credentials**:
   - Copy the **Web client** OAuth ID that Firebase created. This becomes `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
   - Create an **iOS** OAuth client with your bundle ID. Copy its client ID, and its *reversed* client ID as `GOOGLE_IOS_URL_SCHEME`.
   - Create an **Android** OAuth client with your package name and the **SHA-1** of your signing key. Get the SHA-1 from `npx eas-cli credentials` once EAS has made a keystore, and add the Play Store's app-signing SHA-1 too after your first upload.

## 2. Deploy the backend

```bash
npm install -g firebase-tools
firebase login
cd pocket-attending
cp .firebaserc.example .firebaserc        # put your project ID in it
cd functions && npm install && cd ..
firebase functions:secrets:set ANTHROPIC_API_KEY   # paste your key when prompted
firebase deploy --only functions,firestore:rules
```

To change the daily limit, create `functions/.env` containing `DAILY_LIMIT=200` and deploy again.

The functions use the `claude-opus-5-5` model. Chat and questions run at medium effort and flashcards at low effort, to keep costs down. If Claude declines a request on safety grounds, the API automatically retries it on a fallback model.

## 3. Configure and run the app

```bash
cd pocket-attending/mobile
cp .env.example .env     # fill in the values from step 1
npm install
```

The app uses native sign-in libraries, so it does not run in Expo Go. Make a **development build** once, install it on your phone, and then run the dev server:

```bash
npx eas-cli@latest login
npx eas-cli@latest init                      # creates the Expo project; copy its ID into EAS_PROJECT_ID
npx eas-cli@latest build --profile development --platform android   # or ios
npm start                                    # then open the installed development build
```

To test without touching your live Firebase project, run `firebase emulators:start` from `pocket-attending/` and set `EXPO_PUBLIC_USE_EMULATORS=1`.

EAS cloud builds don't read your local `.env`. Add the same variables to your Expo project with `npx eas-cli env:create`, or on expo.dev under Project → Environment variables, for the `development`, `preview` and `production` environments.

## 4. Build and publish

```bash
npm run build:preview     # installable test builds: an APK for Android, ad-hoc for registered iPhones
npm run build:android     # Play Store bundle (.aab)
npm run build:ios         # App Store build
npx eas-cli@latest submit -p android
npx eas-cli@latest submit -p ios
```

### Store checklist

Both stores review medical apps closely. Before you submit:

- **Privacy policy.** Host one that says what you store (name, email, role, university, specialty, country) and that questions are processed by Anthropic's Claude API. Set its address as `EXPO_PUBLIC_PRIVACY_URL` so it appears on the Profile screen, and enter it in both store listings.
- **Reviewer account.** Create an email and password account with a finished profile and give it to Apple and Google in the review notes.
- **Apple.** The app already includes Sign in with Apple (required when an app offers Google sign-in) and in-app account deletion. Describe the app as educational and decision-support. Apple's guideline 1.4.1 applies to medical apps.
- **Google Play.** Fill in the **Health apps** declaration and the **Data safety** form: account information is collected, it isn't sold, and users can delete it in the app.
- **Bundle ID.** Set `APP_BUNDLE_ID` to your own reverse-domain ID, such as `com.yourname.pocketattending`, before your first build. It can't change after you publish.
- **Icon and splash.** Replace the placeholder images in `mobile/assets/`.

## Development commands

| Where | Command | What it does |
|---|---|---|
| `mobile/` | `npm run typecheck` | TypeScript check |
| `mobile/` | `npm start` | Dev server for the development build |
| `functions/` | `npm run build` | Compile the functions |
| `pocket-attending/` | `firebase emulators:start` | Local Auth, Firestore and Functions |

## Limits and next steps

- Practitioner status is self-reported. If you need to verify licences, add a manual or registry-based check before unlocking the practitioner mode.
- Chats aren't saved between app launches. Saving history would mean storing users' questions, which the privacy policy would then need to cover.
- Answers arrive all at once rather than streaming word by word, because React Native's networking doesn't support streamed responses out of the box.
- The university list holds about 140 schools. Anyone can type a school that isn't listed, and you can add more in `mobile/src/lib/catalog.ts`.
