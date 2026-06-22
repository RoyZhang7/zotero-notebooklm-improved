// Content script (isolated world) for notebooklm.google.com
// Communicates with injector.js (main world) via window.postMessage

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "uploadBatch") {
    const count = (msg.files && msg.files.length) || 0;
    showToast(`Importing ${count} source${count === 1 ? "" : "s"} into NotebookLM…`, "progress");
    uploadBatch(msg.files)
      .then(() => {
        showToast(`Imported ${count} source${count === 1 ? "" : "s"} into NotebookLM.`, "success");
        sendResponse({ success: true });
      })
      .catch((e) => {
        showToast(`Import failed: ${e.message}`, "error");
        sendResponse({ success: false, error: e.message });
      });
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

  // Step 1: Ensure the add-sources dialog is open so the "Upload files"
  // control is visible for the user to click.
  showToast("Opening the add-sources dialog…", "progress");
  const dialog = await ensureAddSourcesDialog();

  // Step 2: Arm the injector. Once armed it watches for a file input / file
  // picker call and injects our staged files instead of opening the native
  // OS picker.
  showToast("Preparing the file injector…", "progress");
  await armInjector(files);

  // Step 3: Listen for the injector's success/failure before prompting.
  // The timeout is long because we are waiting on a human to click.
  const resultPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(
        new Error(
          "Timed out waiting for the 'Upload files' click — reopen the extension and try again.",
        ),
      );
    }, 180000);

    function handler(e) {
      if (e.source !== window) return;
      if (!e.data || e.data.type !== "__zotero_from_injector") return;
      if (e.data.status) return; // ignore non-terminal status messages here
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

  // Step 4: If NotebookLM already has a file input in the DOM, inject right
  // away — no click needed.
  const injectedNow = await requestExistingInjection("before-prompt");
  if (injectedNow) {
    console.log("[Zotero content] Injector found an existing file input");
    showToast("Injecting files into NotebookLM…", "progress");
    await resultPromise;
    await sleep(3000);
    return;
  }

  // Step 5: NotebookLM rejects script-synthesized clicks (isTrusted guard),
  // so ask the user to click "Upload files" themselves. Their trusted click
  // triggers the file picker, which the armed injector intercepts — the
  // native OS picker never appears.
  const uploadBtn =
    findClickableByText("upload files", dialog) || findClickableByText("upload files");
  if (uploadBtn) highlightElement(uploadBtn);

  showToast(
    `Click “Upload files” in NotebookLM to finish importing ${files.length} source${files.length === 1 ? "" : "s"}.`,
    "action",
  );

  // Step 6: Wait for the injector to confirm the click was intercepted.
  try {
    await resultPromise;
  } finally {
    if (uploadBtn) unhighlightElement(uploadBtn);
  }

  // Give NotebookLM time to process
  await sleep(3000);
}

function highlightElement(el) {
  el.dataset.zoteroPrevOutline = el.style.outline || "";
  el.dataset.zoteroPrevBoxShadow = el.style.boxShadow || "";
  el.style.outline = "3px solid #e8710a";
  el.style.boxShadow = "0 0 0 4px rgba(232,113,10,0.35)";
  el.scrollIntoView({ block: "center", inline: "center" });
}

function unhighlightElement(el) {
  el.style.outline = el.dataset.zoteroPrevOutline || "";
  el.style.boxShadow = el.dataset.zoteroPrevBoxShadow || "";
  delete el.dataset.zoteroPrevOutline;
  delete el.dataset.zoteroPrevBoxShadow;
}

async function armInjector(files) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Injector did not confirm armed state — is injector.js loaded?"));
    }, 5000);

    function handler(e) {
      if (e.source !== window) return;
      if (!e.data || e.data.type !== "__zotero_from_injector") return;
      if (e.data.status !== "armed") return;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      console.log("[Zotero content] Injector confirmed armed");
      resolve();
    }

    window.addEventListener("message", handler);

    console.log("[Zotero content] Arming injector with " + files.length + " files");
    window.postMessage(
      { type: "__zotero_to_injector", command: "arm", files: files },
      "*",
    );
  });
}

async function requestExistingInjection(reason) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.log("[Zotero content] Existing-input probe timed out (" + reason + ")");
      resolve(false);
    }, 1000);

    function handler(e) {
      if (e.source !== window) return;
      if (!e.data || e.data.type !== "__zotero_from_injector") return;
      if (e.data.status !== "inject-existing") return;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      if (e.data.found) {
        console.log("[Zotero content] Existing-input probe found a file input (" + reason + ")");
      } else {
        console.log("[Zotero content] Existing-input probe found no file input (" + reason + ")");
      }
      resolve(Boolean(e.data.found));
    }

    window.addEventListener("message", handler);
    window.postMessage(
      { type: "__zotero_to_injector", command: "inject-existing", reason },
      "*",
    );
  });
}

async function ensureAddSourcesDialog() {
  const existing = document.querySelector("add-sources-dialog");
  if (existing) return existing;

  const addBtn =
    document.querySelector('[aria-label*="Add source" i]') ||
    findClickableByText("add sources");

  if (addBtn) {
    clickElement(addBtn);
    const dialog = await waitForElement("add-sources-dialog", 3000);
    if (!dialog) {
      throw new Error("Could not open the add sources dialog");
    }
    await sleep(500);
    return dialog;
  }

  throw new Error("Could not find the add sources button");
}

function findClickableByText(text, root = document) {
  const target = normalizeText(text);
  const clickables = root.querySelectorAll(
    'button, [role="button"], [aria-label], [tabindex]:not([tabindex="-1"])',
  );

  for (const el of clickables) {
    if (!isVisible(el) || isDisabled(el)) continue;
    const label = normalizeText(el.getAttribute("aria-label") || "");
    const content = normalizeText(el.textContent || "");
    if (label.includes(target) || content.includes(target)) {
      return el;
    }
  }

  return null;
}

function clickElement(el) {
  el.scrollIntoView({ block: "center", inline: "center" });
  el.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true, composed: true }),
  );
  el.dispatchEvent(
    new MouseEvent("mouseup", { bubbles: true, cancelable: true, composed: true }),
  );
  el.click();
}

function isVisible(el) {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }

  return el.getClientRects().length > 0;
}

function isDisabled(el) {
  return (
    el.hasAttribute("disabled") ||
    el.getAttribute("aria-disabled") === "true" ||
    el.closest("[aria-hidden='true']")
  );
}

function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
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

let toastEl = null;
let toastTimer = null;

function showToast(message, kind = "progress") {
  const colors = {
    progress: "#1a73e8",
    action: "#e8710a",
    success: "#188038",
    error: "#d93025",
  };

  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.style.cssText = [
      "position:fixed",
      "bottom:20px",
      "right:20px",
      "z-index:2147483647",
      "max-width:340px",
      "padding:12px 16px",
      "border-radius:8px",
      "color:#fff",
      "font:500 13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      "box-shadow:0 2px 10px rgba(0,0,0,0.25)",
    ].join(";");
    (document.body || document.documentElement).appendChild(toastEl);
  }

  toastEl.style.background = colors[kind] || colors.progress;
  toastEl.textContent = `Zotero → NotebookLM: ${message}`;

  if (toastTimer) clearTimeout(toastTimer);
  // progress/action toasts stay until replaced; terminal ones auto-dismiss.
  if (kind === "success" || kind === "error") {
    toastTimer = setTimeout(() => {
      if (toastEl) {
        toastEl.remove();
        toastEl = null;
      }
    }, kind === "error" ? 12000 : 6000);
  }
}
