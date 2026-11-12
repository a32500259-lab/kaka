const SDK = 'https://www.gstatic.com/firebasejs/13.2.0';
const [appSdk, authSdk, storeSdk] = await Promise.all([
  import(`${SDK}/firebase-app.js`),
  import(`${SDK}/firebase-auth.js`),
  import(`${SDK}/firebase-firestore.js`)
]);

const config = {
  apiKey: 'AIzaSyABwTkSMSWjyM_mYJ3Izo_Yxcnho-1MaT0',
  authDomain: 'kaka-2dae9.firebaseapp.com',
  projectId: 'kaka-2dae9',
  storageBucket: 'kaka-2dae9.firebasestorage.app',
  messagingSenderId: '690376388022',
  appId: '1:690376388022:web:9011b849b7d422e0206517'
};

const allowedKinds = new Set(['productDrafts', 'dailyDrafts', 'collectedThreads']);
const app = appSdk.initializeApp(config);
const auth = authSdk.getAuth(app);
const db = storeSdk.getFirestore(app);

let userId = '';
const ready = (async () => {
  await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
  const credential = auth.currentUser
    ? { user: auth.currentUser }
    : await authSdk.signInAnonymously(auth);
  userId = credential.user.uid;
  return userId;
})();

function workspaceRef(kind) {
  if (!allowedKinds.has(kind)) throw new Error('허용되지 않은 저장 항목입니다.');
  if (!userId) throw new Error('클라우드 저장 연결이 아직 준비되지 않았어요.');
  return storeSdk.doc(db, 'users', userId, 'workspace', kind);
}

export async function initializeCloud() {
  await ready;
  return { ready: true };
}

export async function readSnapshot(kind) {
  await ready;
  const snapshot = await storeSdk.getDoc(workspaceRef(kind));
  const items = snapshot.exists() ? snapshot.data()?.items : [];
  return Array.isArray(items) ? items : [];
}

export async function writeSnapshot(kind, items) {
  await ready;
  if (!Array.isArray(items)) throw new TypeError('저장할 데이터 형식이 올바르지 않습니다.');
  if (items.length > 500) throw new Error('저장 항목이 너무 많아요. 오래된 항목을 정리해주세요.');
  const encoded = JSON.stringify(items);
  if (new TextEncoder().encode(encoded).length > 800_000) {
    throw new Error('저장할 데이터가 너무 커요. 사진 파일은 클라우드에 저장하지 않습니다.');
  }
  await storeSdk.setDoc(workspaceRef(kind), {
    items,
    updatedAt: storeSdk.serverTimestamp()
  });
  return true;
}
