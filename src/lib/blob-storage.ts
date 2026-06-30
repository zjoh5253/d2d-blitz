import { put } from "@vercel/blob";

// Stores a rep document (e.g. W-9) and returns its URL. Reads BLOB_READ_WRITE_TOKEN from env automatically.
// SECURITY: W-9 contains PII; URL exposure is restricted to ADMIN responses
export async function uploadRepDocument(
  file: File,
  userId: string,
  kind: string
): Promise<string> {
  const safeName = file.name?.replace(/[^a-zA-Z0-9._-]/g, "_") || `${kind}`;
  const blob = await put(`rep-docs/${userId}/${kind}/${safeName}`, file, {
    access: "public",
    addRandomSuffix: true,
  });
  return blob.url;
}
