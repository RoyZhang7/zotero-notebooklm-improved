// Main-world script injected into notebooklm.google.com at document_start.
// Intercepts file input .click() to prevent the native OS file picker.
// Communicates with content script via window.postMessage.

(() => {
  const originalClick = HTMLInputElement.prototype.click;
  let armed = false;
  let pendingFiles = null;

  console.log("[Zotero injector] Main-world script loaded");

  // Listen for commands from content script via postMessage
  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    if (!e.data || e.data.type !== "__zotero_to_injector") return;

    const { command, files } = e.data;

    if (command === "arm") {
      armed = true;
      pendingFiles = files;
      console.log("[Zotero injector] Armed with " + (files ? files.length : 0) + " files");
    }
  });

  // Monkey-patch click to intercept file inputs
  HTMLInputElement.prototype.click = function () {
    if (armed && this.type === "file") {
      console.log("[Zotero injector] Intercepted file input click");
      armed = false;

      const input = this;

      if (pendingFiles && pendingFiles.length > 0) {
        try {
          const dt = new DataTransfer();
          for (const f of pendingFiles) {
            const binaryStr = atob(f.base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            dt.items.add(new File([bytes], f.fileName, { type: f.contentType }));
          }
          input.files = dt.files;
          pendingFiles = null;

          // Fire change so Angular picks it up
          input.dispatchEvent(new Event("change", { bubbles: true }));

          console.log("[Zotero injector] Injected " + dt.files.length + " files");
          window.postMessage(
            { type: "__zotero_from_injector", success: true },
            "*",
          );
        } catch (err) {
          console.error("[Zotero injector] Error:", err);
          window.postMessage(
            { type: "__zotero_from_injector", success: false, error: err.message },
            "*",
          );
        }
      }
      return; // don't open the file picker
    }

    return originalClick.call(this);
  };
})();
