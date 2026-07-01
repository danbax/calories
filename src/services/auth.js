import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
} from "../firebaseConfig";
import { migrateLocalDataToCloud, hasBeenMigrated } from "../migration";
import { setCurrentUser } from "../firestoreDb";

/**
 * Helper to build a user object and run migration.
 */
async function onUserSignedIn(firebaseUser) {
  const user = {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName || firebaseUser.email || "User",
    email: firebaseUser.email,
    phoneNumber: firebaseUser.phoneNumber,
    photoURL: firebaseUser.photoURL,
  };

  setCurrentUser(user.uid);

  // Run migration in background if not yet migrated
  if (!hasBeenMigrated(user.uid)) {
    migrateLocalDataToCloud(user.uid).catch((err) =>
      console.warn("Background migration failed, will retry:", err)
    );
  }

  return user;
}

/**
 * Subscribes to auth state changes.
 * When a user signs in, migration runs automatically.
 * Returns an unsubscribe function.
 */
export function subscribeToAuth(onUserChanged) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const user = await onUserSignedIn(firebaseUser);
      onUserChanged(user);
    } else {
      setCurrentUser(null);
      onUserChanged(null);
    }
  });
}

/**
 * Triggers Google sign-in and runs migration upon success.
 */
export async function handleGoogleLogin() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = await onUserSignedIn(result.user);
    return user;
  } catch (error) {
    if (error.code === "auth/popup-closed-by-user") {
      return null; // User cancelled, not an error
    }
    console.error("Google sign-in error:", error);
    throw error;
  }
}

/**
 * Signs in with email and password.
 */
export async function handleEmailLogin(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = await onUserSignedIn(result.user);
    return user;
  } catch (error) {
    console.error("Email sign-in error:", error);
    throw error;
  }
}

/**
 * Creates a new account with email and password.
 */
export async function handleEmailSignUp(email, password) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = await onUserSignedIn(result.user);
    return user;
  } catch (error) {
    console.error("Email sign-up error:", error);
    throw error;
  }
}

/**
 * Sends a phone verification code.
 * The `recaptchaContainerId` is the DOM element ID where the reCAPTCHA widget renders.
 * Returns a ConfirmationResult which has a `confirm(code)` method.
 */
export async function handlePhoneSignIn(phoneNumber, recaptchaContainerId) {
  try {
    const recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: "invisible",
    });
    const confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumber,
      recaptchaVerifier
    );
    return confirmationResult;
  } catch (error) {
    console.error("Phone sign-in error:", error);
    throw error;
  }
}

/**
 * Confirms the SMS code sent via handlePhoneSignIn.
 * Returns the signed-in user.
 */
export async function confirmPhoneCode(confirmationResult, code) {
  try {
    const result = await confirmationResult.confirm(code);
    const user = await onUserSignedIn(result.user);
    return user;
  } catch (error) {
    console.error("Phone code confirmation error:", error);
    throw error;
  }
}

/**
 * Signs the user out.
 */
export async function handleLogout() {
  setCurrentUser(null);
  await signOut(auth);
}