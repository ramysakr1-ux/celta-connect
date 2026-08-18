"use client";

// Thin wrapper around Google's client-side Picker + Identity Services scripts.
// No @types/google.picker or googleapis package exists in this project (the
// server-side flow in src/lib/google/oauth.ts is hand-rolled too), so the
// global surface is typed loosely here rather than pulling in a dependency
// for a handful of calls.
interface PickerCallbackData {
  action: string;
  docs?: Array<{ id: string; name: string; url: string; mimeType: string }>;
}

interface PickerView {
  setIncludeFolders: (include: boolean) => PickerView;
}

export type PickerViewId = "DOCS" | "SPREADSHEETS";

interface PickerInstance {
  addView: (view: PickerView) => PickerInstance;
  setOAuthToken: (token: string) => PickerInstance;
  setDeveloperKey: (key: string) => PickerInstance;
  setCallback: (cb: (data: PickerCallbackData) => void) => PickerInstance;
  build: () => { setVisible: (visible: boolean) => void };
}

declare global {
  interface Window {
    gapi: {
      load: (api: string, callback: () => void) => void;
    };
    google: {
      picker: {
        DocsView: new (viewId: unknown) => PickerView;
        ViewId: { DOCS: unknown; SPREADSHEETS: unknown };
        Action: { PICKED: string };
        PickerBuilder: new () => PickerInstance;
      };
    };
  }
}

export interface PickedDriveFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
}

const loadedScripts = new Map<string, Promise<void>>();

function loadScriptOnce(src: string): Promise<void> {
  let promise = loadedScripts.get(src);
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
    loadedScripts.set(src, promise);
  }
  return promise;
}

let pickerReady: Promise<void> | null = null;

function ensurePickerLoaded(): Promise<void> {
  if (!pickerReady) {
    pickerReady = loadScriptOnce("https://apis.google.com/js/api.js").then(
      () => new Promise<void>((resolve) => window.gapi.load("picker", () => resolve()))
    );
  }
  return pickerReady;
}

export async function openDrivePicker(opts: {
  accessToken: string;
  apiKey: string;
  viewId?: PickerViewId;
  onPicked: (file: PickedDriveFile) => void;
}): Promise<void> {
  await ensurePickerLoaded();

  const viewId = opts.viewId === "SPREADSHEETS" ? window.google.picker.ViewId.SPREADSHEETS : window.google.picker.ViewId.DOCS;
  const view = new window.google.picker.DocsView(viewId).setIncludeFolders(false);

  const picker = new window.google.picker.PickerBuilder()
    .addView(view)
    .setOAuthToken(opts.accessToken)
    .setDeveloperKey(opts.apiKey)
    .setCallback((data) => {
      if (data.action === window.google.picker.Action.PICKED && data.docs?.[0]) {
        const doc = data.docs[0];
        opts.onPicked({ id: doc.id, name: doc.name, url: doc.url, mimeType: doc.mimeType });
      }
    })
    .build();

  picker.setVisible(true);
}

const GOOGLE_SHEET_MIME_TYPE = "application/vnd.google-apps.spreadsheet";
export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// A native Google Sheet has no file bytes to download -- it has to be
// exported, and export only ever returns the FIRST tab. An uploaded
// .csv/.tsv living in Drive is a real file, downloaded as-is instead.
export async function fetchDriveFileAsText(file: PickedDriveFile, accessToken: string): Promise<string> {
  const url =
    file.mimeType === GOOGLE_SHEET_MIME_TYPE
      ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/csv`
      : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Could not read that file from Drive.");
  return response.text();
}

// A real .xlsx living in Drive (not a native Google Sheet, which has no
// bytes) -- downloaded as binary and handed to parseXlsx rather than read as
// text, which would corrupt it.
export async function fetchDriveFileAsArrayBuffer(file: PickedDriveFile, accessToken: string): Promise<ArrayBuffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Could not read that file from Drive.");
  return response.arrayBuffer();
}
