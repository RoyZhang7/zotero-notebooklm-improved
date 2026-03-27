import { initLocale, getString } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";
import { registerEndpoints } from "./modules/server";
import { openExportDialog } from "./modules/dialog";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  // Register HTTP endpoints for Chrome extension communication
  registerEndpoints();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  addon.data.ztoolkit = createZToolkit();

  // Register Tools menu item
  const menuItem = ztoolkit.UI.createElement(win.document, "menuitem", {
    tag: "menuitem",
    id: "zotero-notebooklm-menu-export",
    attributes: {
      label: getString("menuitem-export-label"),
    },
    listeners: [
      {
        type: "command",
        listener: () => openExportDialog(win),
      },
    ],
  });
  win.document.getElementById("menu_ToolsPopup")?.appendChild(menuItem);
}

async function onMainWindowUnload(_win: Window): Promise<void> {
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  // Clear staged items
  addon.data.stagedItems.clear();
  addon.data.stagedTimestamp = null;
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
};
