const crypto = require("crypto");

exports.handler = async function () {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const siteUrl = (process.env.SITE_URL || "").replace(/\/+$/, "");

  if (!channelId) {
    return { statusCode: 500, body: "Missing LINE_LOGIN_CHANNEL_ID" };
  }
  if (!siteUrl) {
    return { statusCode: 500, body: "Missing SITE_URL" };
  }

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = `${siteUrl}/.netlify/functions/line-callback`;

  const authorizeUrl =
    "https://access.line.me/oauth2/v2.1/authorize" +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(channelId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent("profile openid")}`;

  return {
    statusCode: 302,
    headers: {
      Location: authorizeUrl,
      "Set-Cookie": [
        `chinguu_line_state=${state}`,
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Max-Age=600"
      ].join("; ")
    },
    body: ""
  };
};
