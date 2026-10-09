function getCookie(cookieHeader, name) {
  const cookies = String(cookieHeader || "")
    .split(";")
    .map(v => v.trim())
    .filter(Boolean);

  for (const item of cookies) {
    const idx = item.indexOf("=");
    if (idx < 0) continue;
    const key = item.slice(0, idx);
    const value = item.slice(idx + 1);
    if (key === name) return decodeURIComponent(value);
  }
  return "";
}

function redirectError(siteUrl, message) {
  const url =
    `${siteUrl}/?lineLogin=error&message=${encodeURIComponent(message || "LINE Login failed")}#/mypage`;

  return {
    statusCode: 302,
    headers: {
      Location: url,
      "Set-Cookie": "chinguu_line_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    },
    body: ""
  };
}

exports.handler = async function (event) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  const memberApiSecret = process.env.MEMBER_API_SECRET;
  const gasUrl = process.env.GAS_WEB_APP_URL;
  const siteUrl = (process.env.SITE_URL || "").replace(/\/+$/, "");

  if (!siteUrl) return { statusCode: 500, body: "Missing SITE_URL" };
  if (!channelId) return { statusCode: 500, body: "Missing LINE_LOGIN_CHANNEL_ID" };
  if (!channelSecret) return { statusCode: 500, body: "Missing LINE_LOGIN_CHANNEL_SECRET" };
  if (!memberApiSecret) return { statusCode: 500, body: "Missing MEMBER_API_SECRET" };
  if (!gasUrl) return { statusCode: 500, body: "Missing GAS_WEB_APP_URL" };

  const q = event.queryStringParameters || {};

  if (q.error) {
    return redirectError(siteUrl, q.error_description || q.error);
  }

  const code = q.code || "";
  const state = q.state || "";
  const savedState = getCookie(
    (event.headers && (event.headers.cookie || event.headers.Cookie)) || "",
    "chinguu_line_state"
  );

  if (!code) return redirectError(siteUrl, "沒有收到 LINE Login 授權碼");
  if (!state || !savedState || state !== savedState) {
    return redirectError(siteUrl, "LINE Login 驗證已失效，請重新登入");
  }

  const redirectUri = `${siteUrl}/.netlify/functions/line-callback`;

  try {
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: channelId,
      client_secret: channelSecret
    });

    const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString()
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("LINE token error:", tokenData);
      return redirectError(siteUrl, "LINE Login token 驗證失敗");
    }

    const profileResponse = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const profile = await profileResponse.json();

    if (!profileResponse.ok || !profile.userId) {
      console.error("LINE profile error:", profile);
      return redirectError(siteUrl, "無法取得 LINE 會員資料");
    }

    const gas = new URL(gasUrl);
    gas.searchParams.set("action", "memberNetlifyLogin");
    gas.searchParams.set("apiSecret", memberApiSecret);
    gas.searchParams.set("userId", profile.userId);
    gas.searchParams.set("displayName", profile.displayName || "");

    const gasResponse = await fetch(gas.toString(), {
      method: "GET",
      redirect: "follow"
    });

    const gasText = await gasResponse.text();

    let result;
    try {
      result = JSON.parse(gasText);
    } catch (e) {
      console.error("GAS non-JSON response:", gasText.slice(0, 500));
      return redirectError(siteUrl, "會員系統回應格式錯誤");
    }

    if (!result || !result.success || !result.session) {
      console.error("GAS login error:", result);
      return redirectError(siteUrl, (result && result.message) || "會員登入失敗");
    }

    const destination =
      `${siteUrl}/?lineLogin=success&memberSession=${encodeURIComponent(result.session)}#/mypage`;

    return {
      statusCode: 302,
      headers: {
        Location: destination,
        "Set-Cookie": "chinguu_line_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
      },
      body: ""
    };
  } catch (err) {
    console.error("LINE callback fatal error:", err);
    return redirectError(siteUrl, "LINE Login 發生錯誤，請稍後再試");
  }
};
