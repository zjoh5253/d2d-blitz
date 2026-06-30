import { put, del, issueSignedToken, presignUrl } from "@vercel/blob";

// Stores a rep document (e.g. W-9) with PRIVATE access and returns its URL.
// Reads BLOB_READ_WRITE_TOKEN from env automatically.
//
// SECURITY: W-9 and similar documents contain PII (SSN/TIN). Blobs are stored
// with access: "private" so they are never reachable via their public URL.
// Viewing requires an ADMIN to request a short-lived signed URL via
// getSignedRepDocumentUrl(), which is minted server-side only.
//
// RETENTION: Documents are best-effort deleted on re-acceptance (the new file
// replaces the old one) and when the parent Agreement row is deleted (which
// cascades acceptance rows in the DB; we delete blobs before the DB row).
// A time-based retention / expiry policy is a future enhancement.
export async function uploadRepDocument(
  file: File,
  userId: string,
  kind: string
): Promise<string> {
  const safeName = file.name?.replace(/[^a-zA-Z0-9._-]/g, "_") || `${kind}`;
  const blob = await put(`rep-docs/${userId}/${kind}/${safeName}`, file, {
    access: "private",
    addRandomSuffix: true,
  });
  // Return the canonical blob URL (used for del() and presignUrl pathname).
  return blob.url;
}

/**
 * Mints a short-lived signed GET URL for a private rep document so an ADMIN
 * can download/view it. The URL expires after expiresInSeconds (default 5 min).
 *
 * presignUrl option names used: `operation: 'get'`, `pathname`, `validUntil`
 * (absolute ms-since-epoch expiry, capped to the delegation window).
 */
export async function getSignedRepDocumentUrl(
  urlOrPathname: string,
  expiresInSeconds = 300
): Promise<string> {
  // Extract the pathname from a full URL (presignUrl accepts pathnames).
  let pathname: string;
  try {
    pathname = new URL(urlOrPathname).pathname.replace(/^\//, "");
  } catch {
    // Already a bare pathname.
    pathname = urlOrPathname.replace(/^\//, "");
  }

  const validUntil = Date.now() + expiresInSeconds * 1000;

  const signedToken = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
  });

  const result = await presignUrl(signedToken, {
    operation: "get",
    pathname,
    validUntil,
    access: "private",
  });

  return result.presignedUrl;
}

/**
 * Best-effort deletion of a private rep document blob.
 * Errors are swallowed with a console.error so callers never fail due to
 * stale-blob cleanup.
 */
export async function deleteRepDocument(
  urlOrPathname: string
): Promise<void> {
  try {
    await del(urlOrPathname);
  } catch (err) {
    console.error("[blob-storage] deleteRepDocument failed:", err);
  }
}
