// Firebase Configuration
//
// KURULUM ADIMLARI:
// 1. https://console.firebase.google.com adresine git
// 2. "Add project" veya "Proje Ekle" tıkla
// 3. Proje adı: "30gunfit" (veya istediğin isim)
// 4. Google Analytics: İsteğe bağlı (kapatabilirsin)
// 5. Proje oluştuktan sonra:
//    - Sol menüden "Build" > "Authentication" tıkla
//    - "Get Started" tıkla
//    - "Email/Password" aktif et
//    - "Google" provider'ı da aktif et (isteğe bağlı)
// 6. Sol menüden "Build" > "Firestore Database" tıkla
//    - "Create database" tıkla
//    - "Start in test mode" seç (şimdilik)
//    - Location: europe-west (veya yakın bölge)
// 7. Sol menüden "Project Settings" (⚙️ ikonu)
//    - "Your apps" bölümünde "</>" (Web) tıkla
//    - App nickname: "30gunfit-web"
//    - "Register app" tıkla
//    - Aşağıdaki config değerlerini KOPYALA ve buraya yapıştır

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase Console'dan alınan config bilgileri
const firebaseConfig = {
  apiKey: "AIzaSyA2f4OCswzESYB0MOD04A3758RcPYnv2eY",
  authDomain: "gunfit-c0243.firebaseapp.com",
  projectId: "gunfit-c0243",
  storageBucket: "gunfit-c0243.firebasestorage.app",
  messagingSenderId: "3475527927",
  appId: "1:3475527927:web:497f98a9035570f9b1dbf2",
  measurementId: "G-QPMDTK7NJB"
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);

// Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore Database
export const db = getFirestore(app);

export default app;
