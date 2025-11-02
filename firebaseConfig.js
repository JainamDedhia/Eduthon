// firebaseConfig.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import {
    getAuth,
    getReactNativePersistence,
    initializeAuth
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAkRR3hEW9ZG---AF2sTBZHfoXiAFtAMjo",
  authDomain: "medical-9530c.firebaseapp.com",
  projectId: "medical-9530c",
  storageBucket: "medical-9530c.firebasestorage.app",
  messagingSenderId: "829045368261",
  appId: "1:829045368261:android:3a1418d1599554a41997ac"
};

const app = initializeApp(firebaseConfig);

// ✅ Use initializeAuth() instead of getAuth() for React Native
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  auth = getAuth(app); // fallback for web
}

export { auth };
export const db = getFirestore(app);
