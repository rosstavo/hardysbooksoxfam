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

/**
 * Utils
 */
const normaliseString = require("./utils/normaliseString");

/**
 * Data
 */
const authorKeywords = require("./data/keywords");

const allKeywords = Object.keys(authorKeywords).reduce((acc, author) => {
  return [...acc, author, ...authorKeywords[author]];
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

const getProducts = async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto(process.env.OXFAM_URL);

  // Wait for the page to load
  await page.waitForSelector(".product-item-anchor");

  // Find all the '.product-item-anchor' elements
  const liveProducts = await page.$$eval(".product-item-anchor", (anchors) => {
    return anchors.map((anchor) => {
      // Go up one level to get the parent element
      // Then find the '.product-item-price' element
      const priceElement = anchor.parentElement.querySelector(".product-price");

      return {
        href: anchor.href,
        title: anchor.textContent,
        sku: anchor.href.split("?")[1].split("=")[1],
        id: anchor.href.split("?")[1].split("=")[1],
        price: priceElement.textContent.replace("\n", "").trim(),
      };
    });
  });

  const storedProducts = await retrieveProducts();

  const newProducts = liveProducts
    .filter((product) => {
      // Search product.title for any of the keywords
      return allKeywords.some((keyword) => {
        return normaliseString(product.title).includes(
          normaliseString(keyword)
        );
      });
    })
    .filter((product) => {
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
        `${product.title} ${product.price}`,
        product.href
      );
    });

    storeProducts(newProducts);
  }

  await browser.close();
};

getProducts();

cron.schedule("*/1 * * * *", getProducts).start();
