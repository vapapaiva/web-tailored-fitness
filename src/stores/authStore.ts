import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  serverTimestamp,
  deleteField 
} from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';
import type { AuthState, UserData } from '@/types/profile';

interface AuthStore extends AuthState {
  // Actions
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (profile: Partial<UserData>) => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  markOnboardingComplete: () => Promise<void>;
  initialize: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>()(
  subscribeWithSelector((set, get) => ({
    user: null,
    loading: true,
    error: null,

    signInWithGoogle: async () => {
      try {
        set({ loading: true, error: null });
        const result = await signInWithPopup(auth, googleProvider);
        const firebaseUser = result.user;
        
        // Check if user document exists in Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          // Create new user document
          const newUser: UserData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email!,
            displayName: firebaseUser.displayName || undefined,
            photoURL: firebaseUser.photoURL || undefined,
            onboardingCompleted: false,
            theme: 'system',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          await setDoc(userDocRef, {
            ...newUser,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          
          set({ user: newUser, loading: false });
        }
        
      } catch (error) {
        console.error('Sign in error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to sign in',
          loading: false 
        });
      }
    },

    signOut: async () => {
      try {
        set({ loading: true, error: null });
        await firebaseSignOut(auth);
        set({ user: null, loading: false });
      } catch (error) {
        console.error('Sign out error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to sign out',
          loading: false 
        });
      }
    },

    updateProfile: async (profileUpdate: Partial<UserData>) => {
      const { user } = get();
      if (!user) return;

      try {
        set({ loading: true, error: null });
        const userDocRef = doc(db, 'users', user.uid);
        
        // Handle undefined values by converting them to deleteField()
        const updateData: Record<string, any> = {};
        
        Object.entries(profileUpdate).forEach(([key, value]) => {
          if (value === undefined) {
            updateData[key] = deleteField();
          } else {
            updateData[key] = value;
          }
        });
        
        updateData.updatedAt = serverTimestamp();
        
        await updateDoc(userDocRef, updateData);

        // The onSnapshot listener will update the state
        set({ loading: false });
      } catch (error) {
        console.error('Update profile error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to update profile',
          loading: false 
        });
      }
    },

    setTheme: async (theme: 'light' | 'dark' | 'system') => {
      const { user } = get();
      if (!user) return;

      try {
        await get().updateProfile({ theme });
      } catch (error) {
        console.error('Set theme error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to update theme'
        });
      }
    },

    markOnboardingComplete: async () => {
      const { user } = get();
      if (!user) return;

      try {
        await get().updateProfile({ onboardingCompleted: true });
      } catch (error) {
        console.error('Mark onboarding complete error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to complete onboarding'
        });
      }
    },

    initialize: () => {
      let unsubscribeFirestore: (() => void) | null = null;

      const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
        if (firebaseUser) {
          // User is signed in, set up Firestore listener
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          
          unsubscribeFirestore = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
              const userData = doc.data() as UserData;
              // Convert Firestore timestamps to Date objects
              const user: UserData = {
                ...userData,
                createdAt: userData.createdAt instanceof Date 
                  ? userData.createdAt 
                  : new Date(userData.createdAt),
                updatedAt: userData.updatedAt instanceof Date 
                  ? userData.updatedAt 
                  : new Date(userData.updatedAt),
              };
              set({ user, loading: false });
            } else {
              // Document doesn't exist, this shouldn't happen if we created it during sign in
              set({ user: null, loading: false });
            }
          }, (error) => {
            console.error('Firestore listener error:', error);
            set({ 
              error: error instanceof Error ? error.message : 'Failed to sync user data',
              loading: false 
            });
          });
        } else {
          // User is signed out
          if (unsubscribeFirestore) {
            unsubscribeFirestore();
            unsubscribeFirestore = null;
          }
          set({ user: null, loading: false });
        }
      });

      // Return cleanup function
      return () => {
        unsubscribeAuth();
        if (unsubscribeFirestore) {
          unsubscribeFirestore();
        }
      };
    },

    clearError: () => set({ error: null }),
  }))
);
