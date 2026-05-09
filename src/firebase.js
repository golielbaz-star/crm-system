import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// הדבק כאן את ה-config מ-Firebase Console → Project Settings → Your apps
const firebaseConfig = {
  apiKey: "AIzaSyAxIBw5nEA1_eFoDihV09eDpXsMCYdmlSo",
  authDomain: "crm-jsport.firebaseapp.com",
  projectId: "crm-jsport",
  storageBucket: "crm-jsport.firebasestorage.app",
  messagingSenderId: "9540685659",
  appId: "1:9540685659:web:74397087f1a7a032ad147e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
