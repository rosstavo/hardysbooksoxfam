const puppeteer = require("puppeteer");

const evaluatePages = async (pages) => {
  // New browser instance
  const browser = await puppeteer.launch({
    args: [...process.env.PUPPETEER_ARGS.split(",")],
  });

  const liveProducts = [];

  for (const page of pages) {
    console.log(page.url + page.suffix);

    // New page instance
    const browserPage = await browser.newPage();

    if (process.env.NODE_ENV === "development") {
      browserPage.on("console", (msg) => console.log(msg.text()));
    }

    await browserPage.goto(page.url + page.suffix);

    // Wait for the page to load
    await browserPage.waitForSelector(page.selector);

    // Find all the elements
    let elements = await browserPage.$$eval(
      page.selector,
      async (els, dataModel) => {
        return Promise.all(
          els.map(async (el) => {
            return Object.keys(dataModel).reduce((acc, key) => {
              const { type, value, location, selector } = dataModel[key];

              if (selector) {
                let root = el[location] || el;

                return {
                  ...acc,
                  [key]:
                    type === "attribute" && value
                      ? root.querySelector(selector).getAttribute(value)
                      : root.querySelector(selector).textContent,
                };
              }

              return {
                ...acc,
                [key]:
                  type === "attribute" && value
                    ? el.getAttribute(value)
                    : el.textContent,
              };
            }, {});
          })
        );
      },
      page.dataModel
    );

    if (page.filter) {
      elements = elements.filter(page.filter);
    }

    const sourceLiveProducts = elements.map((el) =>
      Object.keys(el).reduce((acc, key) => {
        if (key === "href" || key === "img") {
          // if el[key] is a relative path, add the page url to it
          const urlSuffix =
            el[key].startsWith("/") || el[key].startsWith("./")
              ? page.rootUrl
              : "";

          return {
            ...acc,
            [key]: urlSuffix + el[key],
          };
        }

        if (page.dataModel[key].transform) {
          return {
            ...acc,
            [key]: page.dataModel[key].transform(el[key]),
          };
        }

        return {
          ...acc,
          [key]: el[key],
        };
      }, {})
    );

    // Add site to the products
    sourceLiveProducts.forEach((product) => {
      product.site = page.label;
    });

    liveProducts.push(...sourceLiveProducts);

    // Close the page
    await browserPage.close();
  }

  // Log the elements

  // Close the browser
  await browser.close();

  return liveProducts.map((product) => ({
    ...product,
    createdAt: new Date(),
  }));
};

module.exports = { evaluatePages };
