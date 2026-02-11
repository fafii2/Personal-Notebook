// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// User provided config
const firebaseConfig = {
    apiKey: "AIzaSyCH6Gbv0RsdgthkaT1JSuK7sAyD87Ks6MI",
    authDomain: "calendar-app-dcd14.firebaseapp.com",
    projectId: "calendar-app-dcd14",
    storageBucket: "calendar-app-dcd14.firebasestorage.app",
    messagingSenderId: "725013370529",
    appId: "1:725013370529:web:e204e249b116f12fb2c2e0",
    measurementId: "G-XBMW9X2EXX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Database Reference (Single document for simplicity)
// Using 'global' collection and 'data' doc since we don't have auth yet
export const DATA_REF = doc(db, "app", "shared-data");

export { db, onSnapshot, setDoc, getDoc };
