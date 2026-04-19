import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "property-images";
const MAX_BYTES = 5 * 1024 * 1024;

function safeFileName(name: string) {
  const s = name.replace(/[^\w.-]+/g, "_").slice(0, 80);
  return s || "image";
}

/**
 * Upload a cover image to the public `property-images` bucket and return its public URL.
 * Paths are scoped under `userId/` so RLS matches applicant-documents style.
 */
export async function uploadPropertyCoverImage(
  supabase: SupabaseClient,
  params: {
    userId: string;
    file: File;
    /** When set (edit flow), path includes property id for traceability. */
    propertyId?: string;
  },
): Promise<string> {
  const { userId, file, propertyId } = params;
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPEG, PNG, WebP, etc.).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const safeName = safeFileName(file.name);
  const stamp = Date.now();
  const path =
    propertyId != null
      ? `${userId}/${propertyId}/${stamp}-${safeName}`
      : `${userId}/${crypto.randomUUID()}/${stamp}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error(
        `Storage bucket "${BUCKET}" is not set up in this Supabase project. Open SQL Editor and run supabase/migrations/20260418140000_property_images_bucket.sql (see README “Property cover image”).`,
      );
    }
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
}
