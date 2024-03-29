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
const { storeProductsInSources } = require("./controllers/firebase");
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
    label: "Oxfam",
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
    label: "AbeBooks",
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

  const newProducts = await storeProductsInSources(liveProducts);

  console.log("newProducts", newProducts);

  if (newProducts.length > 0) {
    newProducts.forEach((product) => {
      const author = product.author ? `(${product.author}) –` : "–";

      sendNotification(
        "New book found!",
        `${product.title} ${author} ${product.price} (${product.site})`,
        product.href,
        product.img || ""
      );
    });
  }
};

/**
 *
 */
const runCron = async () => {
  // If time is not between 9am and 9pm UTC, return
  const now = new Date();

  if (now.getHours() < 8 || now.getHours() > 21) return;

  getProducts();
};

if (process.env.NODE_ENV === "development") {
  getProducts();
}

// Run the function every minute
cron.schedule("*/1 * * * *", runCron).start();
