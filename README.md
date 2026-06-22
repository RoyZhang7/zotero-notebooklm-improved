# Zotero → NotebookLM — Improved Fork

This is an improved fork of [peterdresslar/zotero-notebooklm](https://github.com/peterdresslar/zotero-notebooklm). It gets the project running on **Zotero 9**, makes it practical to pick a couple of papers out of a large staged set, and reworks the NotebookLM upload so it stops failing silently. The original author's README is preserved below the divider.

## What's improved in this fork

**Zotero 9 compatibility.** The upstream plugin was written for Zotero 7 and wouldn't install or run on Zotero 9. Three separate incompatibilities are fixed:
- **Install gate** — the manifest's `strict_max_version` was `8.*`, so Zotero 9 refused to install the plugin. Raised to `9.*`.
- **Startup crash** — the pinned `zotero-plugin-toolkit` called the removed `ChromeUtils.import()` and threw on load. Updated to `^5.1.4`.
- **Server dropping browser requests** — Zotero's local HTTP server cancels requests coming from a browser User-Agent unless they carry a connector header, which showed up as `net::ERR_EMPTY_RESPONSE`. The Chrome extension now sends the required header on every request to Zotero.

**Better source selection (both UIs).** The Chrome popup and the Zotero export dialog now:
- **Default to nothing selected** instead of everything, so you opt papers *in* rather than unchecking a long list.
- Have a **live search box** that filters the visible items by title or author/creators.
- Have a **Select all / Deselect all** toggle that operates only on the **currently filtered** items (and whose label reflects the current state) — e.g. search `caladan`, hit *Select all*, clear the search, and only that paper stays checked.

**More reliable NotebookLM upload.** NotebookLM blocks script-synthesized clicks and drops (it checks `event.isTrusted`), which made the old fully-automated upload hang or fail silently. The flow is now **"you click, we inject"**:
- The extension stages your files and opens NotebookLM's add-sources dialog.
- It **highlights the "Upload files" button** and shows an on-page prompt.
- **You click "Upload files" once** — that trusted click triggers NotebookLM's picker, which the extension intercepts and fills with your staged files (no OS file dialog appears).
- **On-page toasts** report progress, success, or the actual error, so an import never fails without telling you why.

## Updated usage (what's different from the original)

The Zotero staging step is unchanged, but note these differences when importing:

1. Both the Zotero dialog and the Chrome popup now open with **no items selected** — use the search box and **Select all** to choose sources quickly.
2. In Chrome, click the extension icon and hit **Import to NotebookLM** as before.
3. When prompted, **click the highlighted "Upload files" button inside NotebookLM yourself** to finish the import. This one manual click is required because NotebookLM rejects automated clicks; watch the on-page toast for the result.

> Note on staging: the popup currently clears your Zotero staging optimistically when you press Import. If you abandon the import without clicking "Upload files", you'll need to re-stage from Zotero.

---

# Zotero → NotebookLM

I use [Zotero](https://www.zotero.org/) as my source of truth for **all** my scientific literature, and whenever I look into a new topic, it starts with a new collection of the latest papers in Zotero. My favorite workflow: 
- take those new papers-->
- dump them into a new [NotebookLM](https://notebooklm.google.com/) notebook-->
- generate a audio "podcast"-->
- and off to my favorite jogging trail with headphones!

Unfortunately, there's no native integration between Zotero and NotebookLM, and--what's worse--Zotero's article storage on a local file system is an utter pain to navigate, select from, and use from the NotebookLM interface's file dropzone. So, I built this plugin to automate the workflow.

It's a bit of a kludge: NotebookLM only offers an API to business customers as of this time, and so we have to manipulate the web interface using a browser extension. This arrangement likely means that the overall setup is a bit brittle! But, as I *need* to use it many times a week (what else am I going to listen to when I am huffing up [Puʻu Pia](https://maps.app.goo.gl/56yaE2tURJyo24Ma6)?), I am likely to invest the time to try and keep this project maintained---and I'd welcome requests and contributions.

<p align="center">🌴 🌴 🌴</p>

<p align="center">
  <img src="public/zotero-notebooklm.png" alt="Chrome extension popup showing 8 Zotero sources staged for import to NotebookLM" width="400">
</p>

## About

A Zotero 7 plugin and Chrome extension that lets you select articles from your Zotero library and import their PDFs directly into Google NotebookLM — no manual file wrangling required.

## Why?

Zotero stores PDFs in opaque, key-based folder names. Manually gathering files from a subcollection and uploading them to NotebookLM is tedious and error-prone. This tool automates the entire workflow: browse your collections in Zotero, pick your sources, and push them to NotebookLM with two clicks.

## How It Works

The system has two parts:

1. **Zotero Plugin** — Adds an "Export to NotebookLM" dialog to Zotero's Tools menu. Browse your collection tree, search/filter items, and select which sources to stage. The plugin starts a local HTTP server that serves the staged files.

2. **Chrome Extension** — Connects to the Zotero plugin's local server, fetches the staged files, and injects them into NotebookLM's upload interface.

## Installation

### Zotero Plugin

1. Download or build the `.xpi` file (see [Building](#building) below)
2. In Zotero 7: **Tools → Add-ons → ⚙ → Install Add-on From File...**
3. Select the `.xpi` file and restart Zotero if prompted

### Chrome Extension

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** and select the `chrome-extension/` directory

## Usage

### Step 1: Stage Sources in Zotero

1. Open Zotero and go to **Tools → Export to NotebookLM...**
2. Browse the collection tree on the left to find your subcollection
3. Use the search box to filter items by title, author, or year
4. Click items to select them (checked items will be exported). Items without a valid PDF attachment are greyed out.
5. Click **Export to NotebookLM** to stage the selected files

### Step 2: Import into NotebookLM

1. Open [notebooklm.google.com](https://notebooklm.google.com) in Chrome and create or open a notebook
2. Click the Zotero → NotebookLM extension icon in your Chrome toolbar
3. The popup will show your staged sources with a green "Zotero connected" indicator
4. Click **Import to NotebookLM**
5. The extension will fetch each file from Zotero, then upload them all to NotebookLM's sources panel

### Tips

- Keep Zotero running while importing — the Chrome extension fetches files from Zotero's local server
- You can deselect items in the Chrome popup if you change your mind
- After a successful import, staged items are automatically cleared
- If the import fails, refresh the NotebookLM tab and try again

## Building

```bash
npm install
npm run build
```

The Zotero plugin `.xpi` will be at `.scaffold/build/zotero-notebook-lm.xpi`.

The Chrome extension requires no build step — load `chrome-extension/` directly.

## Known Issues

- Large batches (9+ files) may occasionally time out due to a race condition in the Chrome extension's file injection. If this happens, try importing in smaller batches.
- NotebookLM's DOM structure may change without notice, which could break the upload mechanism.

## License

MIT — see [LICENSE](LICENSE).
