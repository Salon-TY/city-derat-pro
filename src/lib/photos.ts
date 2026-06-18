import { supabase } from "@/integrations/supabase/client";
import type { PhotoFile } from "@/components/intervention-form";
import { toast } from "sonner";

const BUCKET = "intervention-photos";

export async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10 MB
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
    });
    if (error && !error.message.includes("already exists")) {
      console.error("[photos] Failed to create bucket:", error.message);
    }
  }
}

export async function uploadInterventionPhotos(
  photos: PhotoFile[],
  userId: string,
): Promise<string[]> {
  if (photos.length === 0) return [];

  await ensureBucket();

  const urls: string[] = [];
  for (const { file } of photos) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.error(`Erreur upload photo : ${error.message}`);
      continue;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

export async function deleteInterventionPhoto(url: string) {
  // Extract path from public URL: .../storage/v1/object/public/intervention-photos/<path>
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.slice(idx + marker.length);
  await supabase.storage.from(BUCKET).remove([path]);
}
