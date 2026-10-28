import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly'
];

// Initialize Firebase App safely (singleton)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const createProvider = (forceConsent: boolean = false) => {
  const p = new GoogleAuthProvider();
  SCOPES.forEach(scope => p.addScope(scope));
  p.setCustomParameters({
    prompt: forceConsent ? 'consent select_account' : 'select_account'
  });
  return p;
};

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory (never localStorage / sessionStorage)
let cachedAccessToken: string | null = null;
let cachedGoogleUser: User | null = null;

// Initialize auth state listener. Call this on app load or hook.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      cachedGoogleUser = user;
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedGoogleUser = null;
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (forceConsent: boolean = false): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const provider = createProvider(forceConsent);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan access token dari Google Auth.');
    }

    cachedAccessToken = credential.accessToken;
    cachedGoogleUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.warn('Google Sheets Sign in notice:', error?.message || error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const clearCachedToken = (): void => {
  cachedAccessToken = null;
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCachedGoogleUser = (): User | null => {
  return cachedGoogleUser;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  cachedGoogleUser = null;
};
