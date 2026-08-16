/**
 * CaothangBaka Link Decoder - Popup Script (v4.0)
 */

const apiKeyInput    = document.getElementById('apiKeyInput');
const saveBtn        = document.getElementById('saveBtn');
const toggleVis      = document.getElementById('toggleVis');
const eyeIcon        = document.getElementById('eyeIcon');
const statusChip     = document.getElementById('statusChip');
const keyPreview     = document.getElementById('keyPreview');
const keyPreviewVal  = document.getElementById('keyPreviewVal');
const copyKeyBtn     = document.getElementById('copyKeyBtn');
const deleteBtn      = document.getElementById('deleteBtn');
const toast          = document.getElementById('toast');
const groqLink       = document.getElementById('groqLink');
const clearCacheLink = document.getElementById('clearCacheLink');

let currentApiKey = '';

// Toast notification
let toastTimer = null;
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 2500);
}

// Mask key cho an toàn
function maskKey(key) {
  if (!key || key.length < 10) return key;
  return key.slice(0, 6) + '••••••••••••' + key.slice(-4);
}

// Render trạng thái
function renderSaved(key) {
  currentApiKey = key;
  statusChip.textContent = '✓ Đã lưu';
  statusChip.className = 'status-chip saved';
  keyPreviewVal.textContent = maskKey(key);
  keyPreview.classList.add('visible');
  apiKeyInput.value = '';
  apiKeyInput.placeholder = maskKey(key);
}

function renderEmpty() {
  currentApiKey = '';
  statusChip.textContent = '✕ Chưa có key';
  statusChip.className = 'status-chip empty';
  keyPreview.classList.remove('visible');
  apiKeyInput.placeholder = 'gsk_••••••••••••••••••••••';
  apiKeyInput.value = '';
}

// Load key khi mở popup
chrome.storage.local.get(['groqApiKey'], (result) => {
  if (result.groqApiKey) {
    renderSaved(result.groqApiKey);
  } else {
    renderEmpty();
  }
});

// Lưu API Key
saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();

  if (!key) {
    showToast('⚠️ Nhập API Key trước đã nha!', 'error');
    apiKeyInput.focus();
    return;
  }
  if (!key.startsWith('gsk_')) {
    showToast('⚠️ Key Groq phải bắt đầu bằng gsk_', 'error');
    return;
  }

  saveBtn.textContent = 'Đang lưu...';
  saveBtn.classList.add('loading');

  chrome.storage.local.set({ groqApiKey: key }, () => {
    saveBtn.textContent = 'Lưu API Key';
    saveBtn.classList.remove('loading');
    renderSaved(key);
    showToast('✅ Đã lưu API Key!', 'success');
  });
});

// Copy Key trực tiếp vào clipboard (Không cần show ra màn hình)
copyKeyBtn.addEventListener('click', () => {
  if (!currentApiKey) return;
  navigator.clipboard.writeText(currentApiKey).then(() => {
    showToast('📋 Đã copy API Key!', 'success');
  }).catch(() => {
    showToast('⚠️ Không thể sao chép', 'error');
  });
});

// Xóa Key có xác nhận (Confirm modal)
deleteBtn.addEventListener('click', () => {
  const confirmDelete = window.confirm('Bạn có chắc chắn muốn xóa Groq API Key này không?');
  if (confirmDelete) {
    chrome.storage.local.remove('groqApiKey', () => {
      renderEmpty();
      showToast('🗑️ Đã xóa API Key', '');
    });
  }
});

// Ẩn/Hiện text trong input
let isVisible = false;
toggleVis.addEventListener('click', () => {
  isVisible = !isVisible;
  apiKeyInput.type = isVisible ? 'text' : 'password';
  eyeIcon.innerHTML = isVisible
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

// Link Groq Console
groqLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://console.groq.com/keys' });
});

// Xóa cache có xác nhận
clearCacheLink.addEventListener('click', (e) => {
  e.preventDefault();
  const confirmClear = window.confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu lưu tạm?');
  if (confirmClear) {
    chrome.storage.local.clear(() => {
      renderEmpty();
      showToast('🧹 Đã xóa toàn bộ cache', '');
    });
  }
});

// Enter để lưu
apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});