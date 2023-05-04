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

// const storeProducts = async (products) => {
//   await loginAnon();

//   const productsCollection = collection(db, "products");

//   products.forEach(async (product) => {
//     const { id, ...rest } = product;

//     setDoc(doc(productsCollection, id), rest);
//   });
// };

// const retrieveProducts = async () => {
//   const productsCollection = collection(db, "products");

//   const productsQuery = query(productsCollection);

//   const productsSnapshot = await getDocs(productsQuery);

//   const productsData = productsSnapshot.docs.map((doc) => {
//     return { id: doc.id };
//   });

//   return productsData;
// };

// const deleteOldProducts = async () => {
//   const productsCollection = collection(db, "products");

//   const productsQuery = query(productsCollection);

//   const productsSnapshot = await getDocs(productsQuery);

//   productsSnapshot.docs.forEach(async (doc) => {
//     const docRef = doc(db, "products", doc.id);

//     // If doc is more recent than 4 days, do not delete
//     if (doc.data().createdAt > Date.now() - 345600000) return;

//     await deleteDoc(doc);
//   });
// };

const retrieveSources = async () => {
  const sourcesCollection = collection(db, "sources");

  const sourcesQuery = query(sourcesCollection);

  const sourcesSnapshot = await getDocs(sourcesQuery);

  const sourcesData = sourcesSnapshot.docs.map((doc) => {
    return { id: doc.id, ...doc.data() };
  });

  return sourcesData;
};

const storeProductsInSources = async (products) => {
  await loginAnon();

  const sources = await retrieveSources();

  console.log("sources: ", sources);

  const sourcesNewProducts = sources.map(async (source) => {
    // Filter products by source
    const sourceProducts = products.filter((product) => {
      return product.site === source.label;
    });

    console.log("sourceProducts: ", sourceProducts);

    // If no products for source, return
    if (!sourceProducts.length) return [];

    // Add new products to sourceProducts
    const newProducts = sourceProducts
      .filter((product) => {
        if (!source.products.length) return true;

        // source.products is array of SKUs
        return !source.products.includes(product.sku);
      })
      .map((product) => product.sku);

    console.log("newProducts: ", newProducts);

    // If no new products, return
    if (!newProducts.length) return [];

    // Add new products to source
    const newSourceProducts = [...source.products, ...newProducts];

    console.log("newSourceProducts: ", newSourceProducts);

    // Store in Firestore
    const sourceDoc = doc(db, "sources", source.id);

    await setDoc(sourceDoc, {
      ...source,
      products: newSourceProducts,
    });

    return newSourceProducts;
  });

  // Resolve all promises
  const resolvedSourcesNewProducts = _.flatten(
    await Promise.all(sourcesNewProducts)
  );

  return products.filter((product) =>
    resolvedSourcesNewProducts.includes(product.sku)
  );
};

module.exports = { db, storeProductsInSources, retrieveSources, loginAnon };
