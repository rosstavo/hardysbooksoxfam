const express = require("express"),
  router = express.Router();

router.get("/", async (req, res) => {
  // Show a welcome message
  res.send("Nothing to see here");
});

module.exports = router;
