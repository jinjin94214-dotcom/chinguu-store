const crypto = require("crypto");

const MYSHIP_URL =
  "https://myship.7-11.com.tw/cart/easy/GM2610107751017/";

const TUTORIAL_KEYWORD = "賣貨便操作教學";

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

function buildCodReply(orderNo, total) {
  return {
    type: "flex",
    altText: "已收到您的貨到付款訂單 ♡",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "已收到您的貨到付款訂單 ♡",
            weight: "bold",
            size: "md",
            color: "#465A63",
            wrap: true
          },
          {
            type: "text",
            text:
              "請至賣貨便自填賣場填寫：\n" +
              "商品名稱：" + orderNo + "\n" +
              "單價：" + total + "\n" +
              "數量：1",
            size: "sm",
            color: "#465A63",
            wrap: true
          },
          {
            type: "text",
            text:
              "完成後再選擇 7-ELEVEN 取貨門市並填寫收件人資料即可。",
            size: "xs",
            color: "#7F959E",
            wrap: true
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "message",
              label: "查看操作教學",
              text: TUTORIAL_KEYWORD
            }
          },
          {
            type: "button",
            style: "primary",
            color: "#9FB8C4",
            height: "sm",
            action: {
              type: "uri",
              label: "前往賣貨便自填賣場",
              uri: MYSHIP_URL
            }
          }
        ]
      }
    }
  };
}

async function replyLine(replyToken, messages, accessToken) {
  const response = await fetch(
    "https://api.line.me/v2/bot/message/reply",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken
      },
      body: JSON.stringify({
        replyToken,
        messages
      })
    }
  );

  const body = await response.text();

  if (!response.ok) {
    console.error(
      "LINE Reply API failed:",
      response.status,
      body
    );
  }

  return response.ok;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const channelSecret =
    process.env.LINE_MESSAGING_CHANNEL_SECRET;

  const accessToken =
    process.env.LINE_MESSAGING_ACCESS_TOKEN;

  if (!channelSecret) {
    console.error(
      "Missing LINE_MESSAGING_CHANNEL_SECRET"
    );
    return res
      .status(500)
      .send("Missing LINE_MESSAGING_CHANNEL_SECRET");
  }

  if (!accessToken) {
    console.error(
      "Missing LINE_MESSAGING_ACCESS_TOKEN"
    );
    return res
      .status(500)
      .send("Missing LINE_MESSAGING_ACCESS_TOKEN");
  }

  try {
    const rawBody =
      typeof req.body === "string"
        ? req.body
        : Buffer.isBuffer(req.body)
        ? req.body.toString("utf8")
        : JSON.stringify(req.body || {});

    const signature =
      req.headers["x-line-signature"] || "";

    if (
      !verifyLineSignature(
        rawBody,
        signature,
        channelSecret
      )
    ) {
      console.error("Invalid LINE signature");
      return res
        .status(401)
        .send("Invalid signature");
    }

    const payload = JSON.parse(rawBody);
    const events = payload.events || [];

    for (const event of events) {
      if (
        !event ||
        event.type !== "message" ||
        !event.message ||
        event.message.type !== "text" ||
        !event.replyToken
      ) {
        continue;
      }

      const messageText =
        String(event.message.text || "").trim();

      if (
        !/付款方式\s*[：:]\s*貨到付款/.test(
          messageText
        )
      ) {
        continue;
      }

      const orderMatch = messageText.match(
        /訂單編號\s*[：:]\s*([0-9]{6}-[0-9]{3})/
      );

      const totalMatch = messageText.match(
        /應付總額\s*[：:]\s*(?:NT\s*\$|\$)?\s*([0-9][0-9,]*)/i
      );

      if (!orderMatch || !totalMatch) {
        console.log(
          "COD message detected but data missing"
        );
        continue;
      }

      const orderNo = orderMatch[1];

      const total = totalMatch[1]
        .replace(/,/g, "");

      const flexMessage =
        buildCodReply(orderNo, total);

      await replyLine(
        event.replyToken,
        [flexMessage],
        accessToken
      );
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error(
      "LINE webhook error:",
      err
    );

    return res.status(200).send("OK");
  }
};
