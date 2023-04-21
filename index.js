const puppeteer = require("puppeteer");
const cron = require("node-cron");

const { retrieveProducts, storeProducts } = require("./controllers/firebase");
const { sendNotification } = require("./controllers/ntfy");
const normaliseString = require("./utils/normaliseString");

const authorKeywords = require("./data/keywords");

const allKeywords = Object.keys(authorKeywords).reduce((acc, author) => {
  return [...acc, author, ...authorKeywords[author]];
}, []);

require("dotenv").config();

const getProducts = async () => {
  const browser = await puppeteer.launch();
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

cron.schedule("*/1 * * * *", getProducts).start();
