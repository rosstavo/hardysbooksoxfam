/**
 * Node packages
 */
const puppeteer = require("puppeteer");
const cron = require("node-cron");
const express = require("express");
const bodyParser = require("body-parser");

/**
 * Config
 */
require("dotenv").config();

/**
 * Controllers
 */
const { retrieveProducts, storeProducts } = require("./controllers/firebase");
const { sendNotification } = require("./controllers/ntfy");
const { evaluatePages } = require("./controllers/puppeteer");

/**
 * Utils
 */
const normaliseString = require("./utils/normaliseString");

/**
 * Data
 */
const authorKeywords = require("./data/authors");
const attributeKeywords = require("./data/attributes");

const mergedKeywords = {
  ...authorKeywords,
  ...attributeKeywords,
};

const allKeywords = Object.keys(mergedKeywords).reduce((acc, key) => {
  return [...acc, key, ...mergedKeywords[key]];
}, []);

const PORT = process.env.PORT || 4000;

// Express is our web server
const app = express();
const server = require("http").createServer(app);

// Parse requests of content-type - application/json
const rawBodyBuffer = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
};

app.use(bodyParser.urlencoded({ verify: rawBodyBuffer, extended: true }));
app.use(bodyParser.json({ verify: rawBodyBuffer }));

// Import routes
const homeRoutes = require("./routes/home");

// Use routes
app.get("*", homeRoutes);

// Start the server
server.listen(PORT, function () {
  console.log("listening on port 4000");
});

const pages = [
  {
    url: process.env.OXFAM_URL,
    rootUrl: process.env.OXFAM_ROOT_URL,
    suffix: "",
    selector: ".g-product-cards",
    dataModel: {
      href: {
        type: "attribute",
        value: "href",
        selector: ".product-item-anchor",
      },
      title: {
        type: "textContent",
        selector: ".product-item-anchor",
      },
      sku: {
        type: "attribute",
        value: "href",
        transform: (value) => value.split("?")[1].split("=")[1],
        selector: ".product-item-anchor",
      },
      id: {
        type: "attribute",
        value: "href",
        transform: (value) => value.split("?")[1].split("=")[1],
        selector: ".product-item-anchor",
      },
      price: {
        type: "textContent",
        transform: (value) => value.replace("\n", "").trim(),
        selector: ".product-price",
      },
      img: {
        type: "attribute",
        value: "src",
        selector: ".bg-product-image",
      },
    },
    filter: (product) => {
      // Search product.title for any of the keywords
      return allKeywords.some((keyword) => {
        return normaliseString(product.title).includes(
          normaliseString(keyword)
        );
      });
    },
  },
  {
    url: process.env.ABEBOOKS_URL,
    rootUrl: process.env.ABEBOOKS_ROOT_URL,
    suffix: encodeURIComponent(
      Object.keys(authorKeywords).join(" OR ")
    ).replace(/%20/g, "+"),
    selector: ".result-item",
    dataModel: {
      href: {
        type: "attribute",
        value: "href",
        selector: "a[itemprop=url]",
      },
      title: {
        type: "textContent",
        selector: "a[itemprop=url]",
      },
      sku: {
        type: "attribute",
        value: "data-csa-c-item-id",
      },
      id: {
        type: "attribute",
        value: "data-csa-c-item-id",
      },
      price: {
        type: "textContent",
        selector: ".item-price",
        transform: (value) => value.replace("\n", "").replace(" ", "").trim(),
      },
      author: {
        type: "textContent",
        selector: ".author",
      },
      img: {
        type: "attribute",
        value: "src",
        selector: ".srp-item-image",
      },
    },
  },
];

const getProducts = async () => {
  const liveProducts = await evaluatePages(pages);

  const storedProducts = await retrieveProducts();

  const newProducts = liveProducts.filter((product) => {
    if (!storedProducts.length) return true;

    return !storedProducts.find((storedProduct) => {
      return storedProduct.id === product.sku;
    });
  });

  console.log("New products: ", newProducts);

  if (newProducts.length > 0) {
    newProducts.forEach((product) => {
      sendNotification(
        "New book found!",
        `${product.title} ${product.author && "(" + product.author + ")"} ${
          product.price
        }`,
        product.href,
        product.img || ""
      );
    });

    storeProducts(newProducts);
  }
};

getProducts();

// Run the function every minute
cron.schedule("*/1 * * * *", getProducts).start();
