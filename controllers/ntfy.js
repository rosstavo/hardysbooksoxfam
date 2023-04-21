const axios = require("axios");

const sendNotification = async (title, body, url) => {
  try {
    const response = await axios.post(
      "https://ntfy.sh",
      JSON.stringify({
        topic: process.env.NTFY_TOPIC,
        title: title,
        message: body,
        click: url,
        tags: ["books"],
      })
    );

    console.log(response.data);
  } catch (error) {
    console.log(error);
  }
};

module.exports = { sendNotification };
