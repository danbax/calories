import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC7ij64pX_YSXXqexIu3FPnMlcw4G1q1GI",
  authDomain: "calorie-tracker-fddb0.firebaseapp.com",
  projectId: "calorie-tracker-fddb0",
  storageBucket: "calorie-tracker-fddb0.firebasestorage.app",
  messagingSenderId: "231480301088",
  appId: "1:231480301088:web:bb896d5bc57bb895b38e45",
  measurementId: "G-LLR5KPWJXR",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Set persistence so the user stays signed in across sessions
setPersistence(auth, browserLocalPersistence).catch(console.warn);

// Initialize Firestore with multi-tab offline persistence enabled
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export {
  db,
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
};
