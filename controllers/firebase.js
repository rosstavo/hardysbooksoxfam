/**
 * Lodash
 */
const _ = require("lodash");

/**
 *
 */
require("dotenv").config();

/**
 * Firestore controller
 *
 * This controller is used to handle all interactions with the Firestore database.
 */
const { initializeApp } = require("firebase/app");

const { getAuth, signInAnonymously } = require("firebase/auth");

const {
  getFirestore,
  collection,
  query,
  getDocs,
  setDoc,
  doc,
} = require("firebase/firestore");

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_APIKEY,
  authDomain: process.env.FIREBASE_AUTHDOMAIN,
  projectId: process.env.FIREBASE_PROJECTID,
  storageBucket: process.env.FIREBASE_STORAGEBUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGINGSENDERID,
  appId: process.env.FIREBASE_APPID,
};

// Initialize Firebase
const firebase = initializeApp(firebaseConfig);

const auth = getAuth();

const db = getFirestore(firebase);

const loginAnon = async () => {
  try {
    const { user } = await signInAnonymously(auth);
    console.log("Logged in as: ", user.uid);
  } catch (error) {
    console.log("Error logging in: ", error);
  }
};

const storeProducts = async (products) => {
  await loginAnon();

  const productsCollection = collection(db, "products");

  products.forEach(async (product) => {
    const { id, ...rest } = product;

    setDoc(doc(productsCollection, id), rest);
  });
};

const retrieveProducts = async () => {
  const productsCollection = collection(db, "products");

  const productsQuery = query(productsCollection);

  const productsSnapshot = await getDocs(productsQuery);

  const productsData = productsSnapshot.docs.map((doc) => {
    return { id: doc.id, ...doc.data() };
  });

  return productsData;
};

module.exports = { db, storeProducts, retrieveProducts, loginAnon };
