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
        ViewId: { DOCS: unknown };
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
  onPicked: (file: PickedDriveFile) => void;
}): Promise<void> {
  await ensurePickerLoaded();

  const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS).setIncludeFolders(false);

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
