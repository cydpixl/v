import {initializeApp,getApp} from 'firebase/app';
import {getAuth,updateCurrentUser,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {auth} from './auth.js';
import {apiURL} from './config.js';
const key='vela.accounts';
const entries=()=>{try{return JSON.parse(localStorage.getItem(key)||'[]').filter(x=>x.uid&&x.app)}catch{return []}};
const save=list=>localStorage.setItem(key,JSON.stringify(list));
function accountAuth(name){let app;try{app=getApp(name)}catch{app=initializeApp(auth.app.options,name)}return getAuth(app)}
export async function rememberAccount(profile){const current=auth.currentUser;if(!current||profile.uid!==current.uid)return;const name='vela-account-'+current.uid,other=accountAuth(name);await other.authStateReady();await updateCurrentUser(other,current);save([...entries().filter(x=>x.uid!==profile.uid),{uid:profile.uid,app:name,name:profile.name,handle:profile.handle,avatar:profile.avatar}]);}
export function savedAccounts(profile){return [...entries().filter(x=>x.uid!==profile.uid),{...profile,app:'vela-account-'+profile.uid}];}
export async function switchAccount(uid){if(uid===auth.currentUser?.uid)return;const entry=entries().find(x=>x.uid===uid);if(!entry)throw Error('Sign in to this account again.');const other=accountAuth(entry.app);await other.authStateReady();if(!other.currentUser){save(entries().filter(x=>x.uid!==uid));throw Error('This session expired. Add the account again.')}await updateCurrentUser(auth,other.currentUser);}
export async function addAccount(handle,password){const name='vela-signin-'+crypto.randomUUID(),other=accountAuth(name);try{await signInWithEmailAndPassword(other,handle.includes('@')?handle:handle.toLowerCase()+'@users.connections.invalid',password);const token=await other.currentUser.getIdToken(),response=await fetch(apiURL('/me'),{headers:{Authorization:'Bearer '+token}}),data=await response.json();if(!response.ok||!data.user)throw Error('This account has no Vela profile. Sign in from the main page first.');const stable=accountAuth('vela-account-'+other.currentUser.uid);await stable.authStateReady();await updateCurrentUser(stable,other.currentUser);save([...entries().filter(x=>x.uid!==data.user.uid),{...data.user,app:stable.app.name}]);return data.user.uid;}finally{await signOut(other)}}
export async function forgetAccount(uid){const entry=entries().find(x=>x.uid===uid);if(entry){const other=accountAuth(entry.app);await other.authStateReady();await signOut(other)}save(entries().filter(x=>x.uid!==uid));}
