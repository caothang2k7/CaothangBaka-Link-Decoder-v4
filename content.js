/**
 * CaothangBaka Link Decoder - Content Script (v4.0)
 */

let activePopupHost = null;

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "SHOW_UNIVERSAL_POPUP") {
    renderUniversalPopup(message.data);
  }
});

function closeUniversalPopup() {
  if (activePopupHost) {
    activePopupHost.remove();
    activePopupHost = null;
  }
}

function renderUniversalPopup(data) {
  closeUniversalPopup();

  activePopupHost = document.createElement("div");
  activePopupHost.id = "caothang-decoder-root";
  document.documentElement.appendChild(activePopupHost);

  const shadow = activePopupHost.attachShadow({ mode: "open" });
  const { source, rawText, isUrl } = data;

  let domain = "Văn bản";
  let isHttps = false;

  if (isUrl) {
    try {
      const u = new URL(rawText);
      domain = u.hostname;
      isHttps = u.protocol === "https:";
    } catch (e) {
      domain = "Link";
    }
  }

  const wrapper = document.createElement("div");
  wrapper.className = "decoder-card animate-slide";

  wrapper.innerHTML = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      .decoder-card {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 360px;
        max-height: 520px;
        background: #11141d;
        color: #e2e8f0;
        border: 1px solid #28334e;
        border-radius: 14px;
        box-shadow: 0 16px 36px rgba(0,0,0,0.7), 0 0 20px rgba(0, 229, 255, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .animate-slide { animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 9px 12px;
        background: #171d2b;
        border-bottom: 1px solid #242d42;
      }
      .header-left { display: flex; align-items: center; gap: 8px; overflow: hidden; }
      .badge {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 4px;
        white-space: nowrap;
        background: ${isUrl ? (isHttps ? '#00e676' : '#ffd166') : '#38bdf8'};
        color: #0b0f19;
      }
      .title-text {
        font-weight: 600;
        font-size: 12px;
        color: #94a3b8;
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
        max-width: 140px;
      }
      .header-actions { display: flex; align-items: center; gap: 6px; }
      .icon-btn {
        background: #1e2638;
        border: 1px solid #2d3b59;
        color: #cbd5e1;
        border-radius: 5px;
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
        padding: 0;
      }
      .icon-btn:hover { background: #2d3b59; color: #ffffff; border-color: #38bdf8; }
      .icon-btn.re-decode:hover { color: #00e5ff; }
      .btn-close {
        background: none;
        border: none;
        color: #64748b;
        font-size: 15px;
        font-weight: bold;
        cursor: pointer;
        padding: 0 4px;
        margin-left: 4px;
        line-height: 1;
        transition: color 0.15s;
      }
      .btn-close:hover { color: #ff4d6d; }
      .body {
        padding: 12px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .content-box {
        background: #090b10;
        border: 1px solid #1e2638;
        border-radius: 8px;
        padding: 10px;
        max-height: 110px;
        overflow-y: auto;
        word-break: break-all;
        font-family: Consolas, Monaco, monospace;
        font-size: 12px;
        line-height: 1.4;
        color: #cbd5e1;
        user-select: text;
      }
      .url-link { color: #38bdf8; text-decoration: none; }
      .url-link:hover { text-decoration: underline; }
      
      .keep-preview-card {
        display: none;
        background: #181f2f;
        border: 1px solid #283654;
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: border-color 0.2s, transform 0.15s;
        text-decoration: none;
        align-items: stretch;
      }
      .keep-preview-card.show { display: flex; }
      .keep-preview-card:hover { border-color: #00e5ff; transform: translateY(-1px); }
      .preview-thumb-wrap {
        width: 72px;
        min-width: 72px;
        background: #0b0f19;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .preview-thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
      .preview-info {
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-width: 0;
        flex: 1;
      }
      .preview-title {
        font-size: 12px;
        font-weight: 600;
        color: #f1f5f9;
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .preview-domain { font-size: 11px; color: #64748b; margin-top: 4px; }

      .translation-box {
        background: #141b2d;
        border: 1px solid #2d3e66;
        border-radius: 8px;
        padding: 10px;
        max-height: 120px;
        overflow-y: auto;
        font-size: 12px;
        line-height: 1.4;
        color: #a7f3d0;
        display: none;
        user-select: text;
      }
      .translation-box.show { display: block; }

      .bottom-actions { display: flex; }
      .btn {
        width: 100%;
        padding: 9px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
        text-align: center;
      }
      .btn-primary { background: #00e5ff; color: #050b14; }
      .btn-primary:hover { background: #33ebff; }
      .btn-groq { background: #89b4fa; color: #11111b; }
      .btn-groq:hover { background: #7aa2e0; }
    </style>

    <div class="header">
      <div class="header-left">
        <span class="badge">${isUrl ? (isHttps ? 'HTTPS' : 'HTTP') : 'VĂN BẢN'}</span>
        <span class="title-text" id="headerTitle"></span>
      </div>
      <div class="header-actions">
        <button class="icon-btn re-decode" id="reDecodeBtn" title="Giải mã lại">🔄</button>
        <button class="icon-btn" id="headerCopyBtn" title="Sao chép">📋</button>
        <button class="btn-close" id="closeBtn" title="Đóng (Esc)">✕</button>
      </div>
    </div>

    <div class="body">
      <div class="content-box" id="mainContent"></div>

      <a class="keep-preview-card" id="keepPreviewCard" target="_blank" rel="noopener noreferrer">
        <div class="preview-thumb-wrap" id="thumbWrap">
          <img class="preview-thumb" id="previewThumb" alt="preview">
        </div>
        <div class="preview-info">
          <div class="preview-title" id="previewTitle"></div>
          <div class="preview-domain" id="previewDomain"></div>
        </div>
      </a>

      <div class="translation-box" id="transBox"></div>

      <div class="bottom-actions" id="bottomActions"></div>
    </div>
  `;

  shadow.appendChild(wrapper);

  // 1. Set textContent chống XSS
  shadow.getElementById("headerTitle").textContent = isUrl ? domain : source;

  // 2. DOM API an toàn tuyệt đối
  const mainContent = shadow.getElementById("mainContent");
  if (isUrl) {
    const link = document.createElement("a");
    link.href = rawText;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "url-link";
    link.textContent = rawText;
    mainContent.appendChild(link);
  } else {
    mainContent.textContent = rawText;
  }

  // 3. Action Buttons
  const bottomActions = shadow.getElementById("bottomActions");
  if (isUrl) {
    const openBtn = document.createElement("button");
    openBtn.className = "btn btn-primary";
    openBtn.textContent = "🚀 Mở Link";
    openBtn.onclick = () => {
      window.open(rawText, "_blank", "noopener,noreferrer");
      closeUniversalPopup();
    };
    bottomActions.appendChild(openBtn);
  } else {
    const transBtn = document.createElement("button");
    transBtn.className = "btn btn-groq";
    transBtn.textContent = "🌐 Dịch AI (Groq)";
    transBtn.onclick = () => {
      const transBox = shadow.getElementById("transBox");
      transBtn.textContent = "⏳ Đang dịch...";
      transBtn.disabled = true;

      chrome.runtime.sendMessage({ action: "TRANSLATE_TEXT", text: rawText }, (res) => {
        transBtn.textContent = "🌐 Dịch AI (Groq)";
        transBtn.disabled = false;
        if (res && res.success) {
          transBox.textContent = res.text;
          transBox.classList.add("show");
        } else {
          transBox.textContent = `⚠️ Lỗi: ${res ? res.error : "Không có phản hồi"}`;
          transBox.classList.add("show");
        }
      });
    };
    bottomActions.appendChild(transBtn);
  }

  // 4. Header buttons
  shadow.getElementById("closeBtn").onclick = closeUniversalPopup;

  const headerCopyBtn = shadow.getElementById("headerCopyBtn");
  headerCopyBtn.onclick = () => {
    navigator.clipboard.writeText(rawText).then(() => {
      headerCopyBtn.textContent = "✅";
      setTimeout(() => { headerCopyBtn.textContent = "📋"; }, 1500);
    });
  };

  const reDecodeBtn = shadow.getElementById("reDecodeBtn");
  reDecodeBtn.onclick = () => {
    reDecodeBtn.textContent = "⏳";
    reDecodeBtn.disabled = true;
    chrome.runtime.sendMessage({ action: "RE_DECODE_TEXT", text: rawText });
  };

  // 5. Rich Preview
  if (isUrl) {
    const keepPreviewCard = shadow.getElementById("keepPreviewCard");
    const previewThumb = shadow.getElementById("previewThumb");
    const previewTitle = shadow.getElementById("previewTitle");
    const previewDomain = shadow.getElementById("previewDomain");
    const thumbWrap = shadow.getElementById("thumbWrap");

    keepPreviewCard.href = rawText;

    chrome.runtime.sendMessage({ action: "FETCH_RICH_PREVIEW", url: rawText }, (meta) => {
      if (meta && (meta.title || meta.image)) {
        if (meta.image) {
          previewThumb.src = meta.image;
          thumbWrap.style.display = "flex";
          previewThumb.onerror = () => { thumbWrap.style.display = "none"; };
        } else {
          thumbWrap.style.display = "none";
        }
        previewTitle.textContent = meta.title || meta.domain;
        previewDomain.textContent = meta.domain || domain;
        keepPreviewCard.classList.add("show");
      }
    });
  }

  const onKey = (e) => {
    if (e.key === "Escape") {
      closeUniversalPopup();
      window.removeEventListener("keydown", onKey);
    }
  };
  window.addEventListener("keydown", onKey);
}