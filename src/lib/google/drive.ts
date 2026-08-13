import "server-only";

// Fetch-based Drive v3 REST client, same hand-rolled approach as oauth.ts and
// picker-client.ts (no googleapis package in this project). Used server-side
// only, by the course close-out export -- writes PDFs into a folder tree the
// app itself creates, which is exactly what the `drive.file` scope already
// granted in oauth.ts covers (an app can freely manage files/folders it
// created; it can't browse the rest of the user's Drive).

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export interface DriveFolder {
  id: string;
  webViewLink: string;
}

export async function createDriveFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<DriveFolder> {
  const response = await fetch(`${DRIVE_API}/files?fields=id,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`Could not create Drive folder "${name}": ${await response.text()}`);
  }

  return (await response.json()) as DriveFolder;
}

export async function uploadFileToDrive(
  accessToken: string,
  input: { name: string; parentId: string; mimeType: string; bytes: Buffer }
): Promise<{ id: string }> {
  // Multipart upload: a JSON metadata part (name + parent) followed by the
  // raw file bytes, joined by a boundary -- the standard shape for Drive v3's
  // multipart uploadType, avoiding a two-request resumable upload for files
  // this small (single PDFs, not large media).
  const boundary = `close-out-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: input.name, parents: [input.parentId] });

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`
    ),
    input.bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const response = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Could not upload "${input.name}" to Drive: ${await response.text()}`);
  }

  return (await response.json()) as { id: string };
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  size: string;
  mimeType: string;
}

// Used by the technical verification pass -- "not zero-byte/half-uploaded" is
// checked by re-fetching the object's own metadata after upload, not trusted
// from the upload response.
export async function getDriveFileMetadata(accessToken: string, fileId: string): Promise<DriveFileMetadata> {
  const response = await fetch(`${DRIVE_API}/files/${fileId}?fields=id,name,size,mimeType`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Could not read Drive file metadata for ${fileId}: ${await response.text()}`);
  }

  return (await response.json()) as DriveFileMetadata;
}
