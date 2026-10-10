const crypto = require("crypto");

module.exports = async function handler(req, res) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const siteUrl = (process.env.SITE_URL || "").replace(/\/+$/, "");

  if (!channelId) {
    return res.status(500).send("Missing LINE_LOGIN_CHANNEL_ID");
  }

  if (!siteUrl) {
    return res.status(500).send("Missing SITE_URL");
  }

  const state = crypto.randomBytes(24).toString("hex");

  const redirectUri = `${siteUrl}/api/line-callback`;

  const authorizeUrl =
    "https://access.line.me/oauth2/v2.1/authorize" +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(channelId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent("profile openid")}`;

  res.setHeader(
    "Set-Cookie",
    [
      `chinguu_line_state=${state}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Max-Age=600"
    ].join("; ")
  );

  return res.redirect(302, authorizeUrl);
};
