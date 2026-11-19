# Nisome

*Nisome* is Swahili for "let me read". It's an AI study companion for **medical students, residents and practitioners**, on Android and iOS.

## What it does

**Study your own material (Library tab)**
- Upload a **PDF** (lecture slides, a paper, a whole textbook), a **Word** file, a **text** file, or a **photo** of notes or a page. Files can be up to 200 MB and 2,000 pages.
- Nisome reads it and writes a **summary**: an overview, key points, a section-by-section breakdown with page numbers, and a glossary.
- **Questions from the file** appear as soon as they're written: multiple choice and short written answers, each tied to a page or section.
- **Instant marking and corrections.** Multiple choice is marked the moment you tap. Written answers are graded by Nisome, which says what you got right, and corrects what you got wrong with the right answer and an explanation.
- **It learns what you don't know.** Every answer updates your score for each concept. Questions you miss come back after 10 minutes; ones you get right come back after 1, 3, 7, 16 and then 35 days (spaced repetition). "Practice my weak spots" writes new questions aimed at the concepts you keep missing.
- **Ask about the file.** Chat answers come from your material and cite page numbers. If you explain something in your own words and get it wrong, Nisome tells you and corrects it.
- **Videos for the file.** Each summary suggests tutorial video searches for its main topics.

**Videos tab.** Search tutorial videos and watch them **inside the app**. Channels from known medical educators, such as Osmosis, Ninja Nerd and Armando Hasudungan, are listed first. Learning websites (Khan Academy, Radiopaedia, Geeky Medics, TeachMeAnatomy, StatPearls, PubMed, MedlinePlus, WHO) open in an in-app browser and can search for the current topic.

**Tutor and Practice tabs.** A general tutor chat (with a Socratic mode) plus exam-style questions, simulated patient cases and flashcards, all tuned to the person's role and level.

**Accounts.** Sign in with Google, Apple (iOS) or email. Profiles are by role: students and residents choose or type their university; students add their year and target exam; residents add specialty and postgraduate year; practitioners add specialty. People can delete their account inside the app.

```
nisome/
├── mobile/              Expo (React Native) app for Android and iOS
│   └── src/app/         Screens: (tabs)/library, tutor, practice, videos, profile; doc/[id]; video/[id]; browser
├── functions/src/
│   ├── docs.ts          Uploads, splitting, summaries, questions, grading, spaced review, document chat
│   ├── videos.ts        YouTube search with a 7-day cache
│   ├── index.ts         Tutor, practice questions, cases, flashcards, account deletion
│   └── prompts.ts       Role-specific instructions
├── firestore.rules      Each person reads only their own profile, library and questions
├── storage.rules        Uploads only into a slot the server reserved
└── firebase.json
```

## How uploads work

```
Phone ──1. createUpload──────────► reserves a slot, checks daily limits
      ──2. upload file────────────► Firebase Storage
                                     │ 3. onUploadFinalized
                                     ▼
                        split PDFs into 50-page parts (Word/text into ~30k-token parts)
                        upload each part to Anthropic's Files API once
                        summarize each part, then the whole work
                        write 5 starter questions → status "ready"
Phone ◄── live updates (Firestore) ── summary, progress, questions
```

Claude reads at most about 600 PDF pages per request, and a whole textbook wouldn't fit in one conversation anyway. So long works are split into parts. When you ask a question about a book, Nisome first picks the one or two parts most likely to hold the answer and reads only those. Parts are cached between messages to cut costs.

**Costs to expect.** The app uses Claude Opus 5.5 ($4 per million input tokens, $20 per million output). A PDF page is roughly 1,500–3,000 tokens.

| Action | Rough cost |
|---|---|
| Summarize a 30-page lecture | $0.20–0.40 |
| Summarize a 1,000-page textbook (one time) | $6–12 |
| First chat message about a book (reads two 50-page parts) | $0.75–1.50 |
| Follow-up messages within 5 minutes (parts are cached) | about $0.05 |
| Chat about a short lecture (under 50 pages) | $0.10–0.40, then a few cents |
| 5 new questions from a book (reads one part) | $0.30–0.60 |
| Grading a written answer | under $0.01 |

Book chats are the main cost. To lower it, set `PARTS_PER_REQUEST` to 1 in `functions/src/docs.ts`.

Each person can upload 10 files and make 150 requests a day (an upload counts as 5 requests). Change these in `functions/.env` (see `functions/.env.example`).

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
3. **Firestore Database**: create a database in production mode. **Storage**: create the default bucket.
4. **Project settings → Your apps**: add a **Web app**. Copy its config values into `mobile/.env` (see step 3).
5. Google Cloud console → **APIs & Services → Credentials**:
   - Copy the **Web client** OAuth ID that Firebase created. This becomes `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
   - Create an **iOS** OAuth client with your bundle ID. Copy its client ID, and its *reversed* client ID as `GOOGLE_IOS_URL_SCHEME`.
   - Create an **Android** OAuth client with your package name and the **SHA-1** of your signing key. Get the SHA-1 from `npx eas-cli credentials` once EAS has made a keystore, and add the Play Store's app-signing SHA-1 too after your first upload.

## 2. Deploy the backend

```bash
npm install -g firebase-tools
firebase login
cd nisome
cp .firebaserc.example .firebaserc        # put your project ID in it
cd functions && npm install && cd ..
firebase functions:secrets:set ANTHROPIC_API_KEY   # paste your key when prompted
firebase deploy --only functions,firestore:rules,storage
```

To change limits, or to turn on in-app YouTube search results, copy `functions/.env.example` to `functions/.env`, edit it, and deploy again.

**YouTube results (optional).** In Google Cloud console, enable **YouTube Data API v3**, create an API key restricted to that API, and set `YOUTUBE_API_KEY` in `functions/.env`. The free quota covers about 100 searches a day, and results are cached for a week. Without a key, the Videos tab opens YouTube's own search page inside the app, and videos still play in the app.

The functions use the `claude-opus-5-5` model. Chat and questions run at medium effort and flashcards at low effort, to keep costs down. If Claude declines a request on safety grounds, the API automatically retries it on a fallback model.

## 3. Configure and run the app

```bash
cd nisome/mobile
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

To test without touching your live Firebase project, run `firebase emulators:start` from `nisome/` and set `EXPO_PUBLIC_USE_EMULATORS=1`.

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

- **Privacy policy.** Host one that says what you store (name, email, role, university, specialty, country, uploaded files, answers and scores) and that files and questions are processed by Anthropic's Claude API. Uploaded files are deleted from Firebase and Anthropic when a person deletes the document or their account. Set its address as `EXPO_PUBLIC_PRIVACY_URL` so it appears on the Profile screen, and enter it in both store listings.
- **Reviewer account.** Create an email and password account with a finished profile and give it to Apple and Google in the review notes.
- **Apple.** The app already includes Sign in with Apple (required when an app offers Google sign-in) and in-app account deletion. Describe the app as educational and decision-support. Apple's guideline 1.4.1 applies to medical apps.
- **Google Play.** Fill in the **Health apps** declaration and the **Data safety** form: account information and user files are collected, they aren't sold, and users can delete them in the app.
- **Copyright.** People upload their own study material. Your terms should say they must have the right to use what they upload.
- **Bundle ID.** Set `APP_BUNDLE_ID` to your own reverse-domain ID, such as `com.yourname.nisome`, before your first build. It can't change after you publish.
- **Icon and splash.** Replace the placeholder images in `mobile/assets/`.

## Development commands

| Where | Command | What it does |
|---|---|---|
| `mobile/` | `npm run typecheck` | TypeScript check |
| `mobile/` | `npm start` | Dev server for the development build |
| `functions/` | `npm run build` | Compile the functions |
| `nisome/` | `firebase emulators:start` | Local Auth, Firestore and Functions |

## Limits and next steps

- Practitioner status is self-reported. If you need to verify licences, add a manual or registry-based check before unlocking the practitioner mode.
- Chats aren't saved between app launches. Questions, answers and progress are saved.
- Scanned PDFs work (Claude reads page images), but very large scans hit the 28 MB per-part limit sooner and are split into smaller parts.
- EPUB books aren't supported yet. Export them to PDF first.
- If someone deletes a document while it's still processing, its parts at Anthropic may be left behind. They don't cost anything to store, but you can clear them from the Anthropic Console.
- Answers arrive all at once rather than streaming word by word, because React Native's networking doesn't support streamed responses out of the box.
- The university list holds about 140 schools. Anyone can type a school that isn't listed, and you can add more in `mobile/src/lib/catalog.ts`.
