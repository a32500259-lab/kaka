# 선물노트 Firebase 저장

- Firebase project: `kaka-2dae9` (display name: `kaka`)
- Firestore: `(default)`, Seoul region (`asia-northeast3`), Spark plan
- Web app: `선물노트 웹`
- Auth: anonymous authentication is enabled; the site has no login screen yet.
- Firestore documents are scoped to `users/{anonymousUid}/workspace/{productDrafts|dailyDrafts|collectedThreads}`.
- `firestore.rules` contains the owner-only rules deployed in Firebase Console.

The app keeps the existing local browser copy and also writes product drafts, daily drafts, and collected Threads posts to Firestore. Firebase anonymous identity persists in the same browser profile, but a different browser/device receives a different identity. Cross-device access must wait for a sign-in method and account-link flow; do not make these rules public to simulate shared access.

The Firebase web config in `web/firebase-store.js` is client configuration, not a service-account credential. Data access is protected by Firebase Authentication and Firestore Security Rules. Never place a service-account key in this static site.
