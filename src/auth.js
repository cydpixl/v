import {initializeApp} from 'firebase/app';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendPasswordResetEmail,signOut} from 'firebase/auth';
const app=initializeApp({projectId:'cnx-cf-20260930',appId:'1:552162516091:web:4c3a6063513cb5ce5656de',apiKey:'AIzaSyCOcLbVFoTcqE1y67wN4J19xHsJX7J7iok',authDomain:'cnx-cf-20260930.firebaseapp.com',messagingSenderId:'552162516091'});
export const auth=getAuth(app);
export {onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendPasswordResetEmail,signOut};
