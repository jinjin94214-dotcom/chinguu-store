const crypto = require("crypto");

function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) return false;

  const digest = crypto
    .createHmac("sha256", channelSecret)
    .update(rawBody)
    .digest("base64");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(signature)
    );
  } catch (e) {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  const gasUrl = process.env.GAS_WEB_APP_URL;

  if (!channelSecret) {
    console.error("Missing LINE_LOGIN_CHANNEL_SECRET");
    return res.status(500).send("Missing LINE_LOGIN_CHANNEL_SECRET");
  }

  if (!gasUrl) {
    console.error("Missing GAS_WEB_APP_URL");
    return res.status(500).send("Missing GAS_WEB_APP_URL");
  }

  try {
    const rawBody =
      typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body || {});

    const signature = req.headers["x-line-signature"] || "";

    if (!verifyLineSignature(rawBody, signature, channelSecret)) {
      console.error("Invalid LINE signature");
      return res.status(401).send("Invalid signature");
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      return res.status(400).send("Invalid JSON");
    }

    const gasResponse = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: rawBody,
      redirect: "follow"
    });

    const gasText = await gasResponse.text();

    if (!gasResponse.ok) {
      console.error(
        "GAS webhook forward failed:",
        gasResponse.status,
        gasText.slice(0, 500)
      );
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(200).send("OK");
  }
};
