// Content script (isolated world) for notebooklm.google.com
// Communicates with injector.js (main world) via window.postMessage

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "uploadBatch") {
    uploadBatch(msg.files)
      .then(() => sendResponse({ success: true }))
      .catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (msg.action === "ping") {
    sendResponse({ ready: true });
    return;
  }
});

async function uploadBatch(files) {
  if (!files || files.length === 0) {
    throw new Error("No files to upload");
  }

  // Step 1: Ensure the add-sources dialog is open
  await ensureAddSourcesDialog();

  // Step 2: Arm the injector with files via postMessage
  window.postMessage(
    { type: "__zotero_to_injector", command: "arm", files: files },
    "*",
  );

  // Small delay to let the message land
  await sleep(200);

  // Step 3: Set up result listener
  const uploadPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Upload timed out — the file input interceptor may not have fired."));
    }, 10000);

    function handler(e) {
      if (e.source !== window) return;
      if (!e.data || e.data.type !== "__zotero_from_injector") return;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      if (e.data.success) {
        resolve();
      } else {
        reject(new Error(e.data.error || "Upload failed"));
      }
    }

    window.addEventListener("message", handler);
  });

  // Step 4: Click "Upload files" — injector will intercept the file input click
  const btn = findButtonByText("upload files");
  if (!btn) {
    throw new Error("Could not find 'Upload files' button.");
  }
  btn.click();

  // Step 5: Wait for result
  await uploadPromise;

  // Give NotebookLM time to process
  await sleep(3000);
}

async function ensureAddSourcesDialog() {
  if (document.querySelector("add-sources-dialog")) return;

  const addBtn =
    document.querySelector('[aria-label*="Add source" i]') ||
    findButtonByText("add sources");

  if (addBtn) {
    addBtn.click();
    await waitForElement("add-sources-dialog", 3000);
    await sleep(500);
  }
}

function findButtonByText(text) {
  const buttons = document.querySelectorAll("button");
  for (const btn of buttons) {
    if (btn.textContent?.toLowerCase().trim().includes(text)) {
      return btn;
    }
  }
  return null;
}

function waitForElement(selector, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
