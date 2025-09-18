// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getRemoteConfig } from "firebase/remote-config";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDSap4BdMdfqs5uSwUjgpBX9Dmw5QqUkW8",
  authDomain: "tailored-fitness-web.firebaseapp.com",
  projectId: "tailored-fitness-web",
  storageBucket: "tailored-fitness-web.firebasestorage.app",
  messagingSenderId: "429207757898",
  appId: "1:429207757898:web:98c13438e4a5d0a8daf2b3",
  measurementId: "G-M7R9JFGL1B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const remoteConfig = getRemoteConfig(app);
export const analytics = getAnalytics(app);

// Configure Remote Config
remoteConfig.settings = {
  minimumFetchIntervalMillis: 3600000, // 1 hour
  fetchTimeoutMillis: 60000, // 1 minute
};

// Set default values for Remote Config
remoteConfig.defaultConfig = {
  profile_config: '{"version":"1.0","sections":[]}',
  openai_api_key: '',
  prompts_fitness_plan_generation: '{"system_prompt":"","user_prompt_template":"","version":"1.0"}'
};

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

export default app;
