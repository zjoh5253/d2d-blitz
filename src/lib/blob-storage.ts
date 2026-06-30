import { put, del, issueSignedToken, presignUrl } from "@vercel/blob";

// Stores a rep document (e.g. W-9) with PRIVATE access and returns its URL.
//
// TOKEN: rep documents live in a dedicated PRIVATE blob store, whose token is
// exposed as BLOB_PRIVATE_READ_WRITE_TOKEN (namespaced so it can coexist with
// other connected stores that use the default BLOB_READ_WRITE_TOKEN). We pass
// it explicitly to every SDK call so operations always target the private
// store. Falls back to BLOB_READ_WRITE_TOKEN if the namespaced var is unset.
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
function privateBlobToken(): string | undefined {
  return (
    process.env.BLOB_PRIVATE_READ_WRITE_TOKEN ??
    process.env.BLOB_READ_WRITE_TOKEN
  );
}
export async function uploadRepDocument(
  file: File,
  userId: string,
  kind: string
): Promise<string> {
  const safeName = file.name?.replace(/[^a-zA-Z0-9._-]/g, "_") || `${kind}`;
  const blob = await put(`rep-docs/${userId}/${kind}/${safeName}`, file, {
    access: "private",
    addRandomSuffix: true,
    token: privateBlobToken(),
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

  const token = privateBlobToken();

  const signedToken = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
    token,
  });

  // presignUrl authenticates via the signedToken (minted above with the
  // private-store token); it does not take a separate token option.
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
    await del(urlOrPathname, { token: privateBlobToken() });
  } catch (err) {
    console.error("[blob-storage] deleteRepDocument failed:", err);
  }
}
