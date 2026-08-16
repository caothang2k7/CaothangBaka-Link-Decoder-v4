/**
 * CaothangBaka Link Decoder - Background Service Worker (v4.0)
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// Lấy API key từ storage
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['groqApiKey'], (result) => {
      resolve(result.groqApiKey || "");
    });
  });
}

// Khởi tạo Context Menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "decodeText", title: "🔗 Giải mã Link từ Text", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "decodeImage", title: "📷 Quét mã QR từ Ảnh này", contexts: ["image"] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "decodeText") { 
    handleUniversalDecode(info.selectionText, tab.id); 
  } else if (info.menuItemId === "decodeImage") { 
    handleImageDecode(info.srcUrl, tab.id); 
  }
});

// Lắng nghe Message từ Content Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : null;

  if (message.action === "RE_DECODE_TEXT" && message.text) {
    if (tabId) handleUniversalDecode(message.text, tabId);
  } else if (message.action === "FETCH_RICH_PREVIEW" && message.url) {
    fetchRichMetadata(message.url).then(sendResponse);
    return true;
  } else if (message.action === "TRANSLATE_TEXT" && message.text) {
    handleTranslateText(message.text).then(sendResponse);
    return true;
  }
});

// NATIVE DECODERS GỐC (ROLLBACK)
const NativeDecoders = {
  base64(str) { try { return atob(str.trim()); } catch (e) { return null; } },
  urlEncode(str) { try { return decodeURIComponent(str); } catch (e) { return null; } },
  hex(str) {
    try {
      let cleanHex = str.replace(/[^0-9A-Fa-f]/g, '');
      let result = '';
      for (let i = 0; i < cleanHex.length; i += 2) { result += String.fromCharCode(parseInt(cleanHex.substr(i, 2), 16)); }
      return result || null;
    } catch (e) { return null; }
  },
  binary(str) {
    try {
      let cleanBin = str.replace(/[^0-1]/g, '');
      if (cleanBin.length < 8) return null;
      let result = '';
      for (let i = 0; i < cleanBin.length; i += 8) {
        let byteString = cleanBin.substr(i, 8);
        if (byteString.length === 8) { result += String.fromCharCode(parseInt(byteString, 2)); }
      }
      return result || null;
    } catch (e) { return null; }
  }
};

function isRealUrl(str) {
  if (!str) return false;
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function normalizeUrl(url) {
  if (!url || url === "ERROR") return null;
  let protocol = "";
  let rest = url;
  if (url.startsWith("https://")) { protocol = "https://"; rest = url.slice(8); }
  else if (url.startsWith("http://")) { protocol = "http://"; rest = url.slice(7); }

  const slashIdx = rest.indexOf('/');
  let hostname = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
  let path = slashIdx === -1 ? '' : rest.slice(slashIdx);

  hostname = hostname.replace(/\.{2,}/g, '.');
  const finalProtocol = protocol || "https://";
  const cleaned = finalProtocol + hostname + path;

  try {
    const parsed = new URL(cleaned);
    const h = parsed.hostname;
    if (h.includes('.') && h.split('.').pop().length >= 2) return cleaned;
  } catch (e) {}
  return null;
}

// Bắn giao diện về content script an toàn
async function sendToContentScript(tabId, payload) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, { action: "SHOW_UNIVERSAL_POPUP", data: payload });
  } catch (err) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ["content.js"] });
      await chrome.tabs.sendMessage(tabId, { action: "SHOW_UNIVERSAL_POPUP", data: payload });
    } catch (injectErr) {
      console.warn("[Decoder] Không thể inject popup:", injectErr);
    }
  }
}

// XỬ LÝ GIẢI MÃ VĂN BẢN (ROLLBACK VỀ LUỒNG GỐC HOÀN TOÀN)
async function handleUniversalDecode(rawText, tabId) {
  const apiKey = await getApiKey();
  let cleanedRaw = rawText.trim();

  if (!apiKey) {
    sendToContentScript(tabId, {
      source: "Text Selection",
      rawText: cleanedRaw,
      isUrl: isRealUrl(cleanedRaw),
      warning: "Chưa cấu hình Groq API Key!"
    });
    return;
  }

  let candidates = { "Original text input": cleanedRaw };
  let b64Res = NativeDecoders.base64(cleanedRaw); if (b64Res) candidates["Decoded Base64"] = b64Res;
  let urlRes = NativeDecoders.urlEncode(cleanedRaw); if (urlRes) candidates["Decoded URL Encode"] = urlRes;
  let hexRes = NativeDecoders.hex(cleanedRaw); if (hexRes) candidates["Decoded Hex"] = hexRes;
  let binRes = NativeDecoders.binary(cleanedRaw); if (binRes) candidates["Decoded Binary"] = binRes;

  const prompt = `You are a strict mechanical URL extraction tool. Analyze the following JSON object containing raw text candidates:
${JSON.stringify(candidates, null, 2)}
Your precise tasks are:
1. Identify the candidate that represents a website link structure.
2. Remove spaces, fix protocols (hxxp -> http), fix dot/slash substitutes.
3. NEVER delete digits.
Return ONLY a valid JSON object:
{"url": "the_final_mechanically_cleaned_url"}
If no link structure exists at all, return:
{"url": "ERROR"}`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    const resData = await response.json();
    if (resData.choices && resData.choices[0] && resData.choices[0].message) {
      const parsedData = JSON.parse(resData.choices[0].message.content.trim());
      const rawUrl = parsedData.url ? parsedData.url.trim() : "ERROR";
      const finalUrl = normalizeUrl(rawUrl);

      if (finalUrl) {
        sendToContentScript(tabId, { source: "AI Decoder", rawText: finalUrl, isUrl: true });
      } else {
        sendToContentScript(tabId, { source: "Decoded Text", rawText: cleanedRaw, isUrl: false });
      }
    }
  } catch (error) {
    console.error("[Groq Decoder] Lỗi:", error);
    sendToContentScript(tabId, { source: "Decoded Text", rawText: cleanedRaw, isUrl: false });
  }
}

// XỬ LÝ DỊCH VĂN BẢN TRÊN SERVICE WORKER (AN TOÀN KEY)
async function handleTranslateText(text) {
  const apiKey = await getApiKey();
  if (!apiKey) return { success: false, error: "Chưa cấu hình Groq API Key trong popup extension." };

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: "Dịch đoạn văn bản sau sang tiếng Việt mượt mà, tự nhiên. Chỉ xuất bản dịch." },
          { role: "user", content: text }
        ]
      })
    });

    const d = await response.json();
    if (d.choices && d.choices[0]) {
      return { success: true, text: d.choices[0].message.content.trim() };
    }
    return { success: false, error: d.error ? d.error.message : "Phản hồi API không hợp lệ." };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// BÓC TÁCH RICH PREVIEW
async function fetchRichMetadata(targetUrl) {
  try {
    const urlObj = new URL(targetUrl);
    const domain = urlObj.hostname;

    if (domain.includes("youtube.com") || domain.includes("youtu.be")) {
      try {
        const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`);
        if (res.ok) {
          const data = await res.json();
          return { title: data.title, image: data.thumbnail_url, domain: "youtube.com" };
        }
      } catch (e) {}
    }

    if (domain === "x.com" || domain === "twitter.com") {
      try {
        const vxUrl = targetUrl.replace("x.com", "api.vxtwitter.com").replace("twitter.com", "api.vxtwitter.com");
        const vxRes = await fetch(vxUrl);
        if (vxRes.ok) {
          const vxData = await vxRes.json();
          const img = (vxData.mediaURLs && vxData.mediaURLs.length > 0) ? vxData.mediaURLs[0] : (vxData.user_profile_image_url || "");
          return {
            title: `${vxData.user_name || 'Người dùng'} (@${vxData.user_screen_name || 'X'})`,
            image: img,
            domain: "x.com"
          };
        }
      } catch (e) {}
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(targetUrl, { signal: controller.signal, headers: { 'User-Agent': 'Twitterbot/1.0' } });
    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();

      const titleMatch = html.match(/<meta[^>]*(?:property|name)=["'](?:og:title|twitter:title)["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:title|twitter:title)["']/i) ||
                         html.match(/<title[^>]*>([^<]+)<\/title>/i);

      const imageMatch = html.match(/<meta[^>]*(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["']/i);

      let title = titleMatch ? titleMatch[1].trim() : "";
      let image = imageMatch ? imageMatch[1].trim() : "";

      if (image) {
        if (image.startsWith("//")) image = "https:" + image;
        else if (!image.startsWith("http")) image = new URL(image, targetUrl).href;
      }

      if (title) {
        title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
      }

      if (title || image) {
        return {
          title: title || domain,
          image: image || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
          domain: domain
        };
      }
    }
  } catch (e) {}

  return null;
}

// XỬ LÝ QR CODE
async function handleImageDecode(imageUrl, tabId) {
  try {
    const imgResponse = await fetch(imageUrl);
    const imageBlob = await imgResponse.blob();

    const formData = new FormData();
    formData.append('file', imageBlob, 'image.jpg');

    const apiResponse = await fetch('https://api.qrserver.com/v1/read-qr-code/', { method: 'POST', body: formData });
    const data = await apiResponse.json();

    if (data && data[0] && data[0].symbol && data[0].symbol[0].data) {
      const rawData = data[0].symbol[0].data;
      sendToContentScript(tabId, { source: "QR Code", rawText: rawData, isUrl: isRealUrl(rawData) });
    } else {
      sendToContentScript(tabId, { source: "QR Code", rawText: "Không quét được mã QR nào trong ảnh!", isUrl: false });
    }
  } catch (error) {
    console.error("[QR Scanner] Lỗi:", error);
  }
}