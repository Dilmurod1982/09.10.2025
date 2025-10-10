// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCSXf1YYiUzstIUALD-68e3VqwkgOSXL6g",
  authDomain: "metan-8cedd.firebaseapp.com",
  projectId: "metan-8cedd",
  storageBucket: "metan-8cedd.firebasestorage.app",
  messagingSenderId: "155753198323",
  appId: "1:155753198323:web:1c862ce64180d544483d86",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
