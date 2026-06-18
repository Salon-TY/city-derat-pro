import { supabase } from "@/integrations/supabase/client";
import type { PhotoFile } from "@/components/intervention-form";
import { toast } from "sonner";

const BUCKET = "intervention-photos";
const SIG_BUCKET = "intervention-signatures";
const MAX_PX = 1200;
const JPEG_QUALITY = 0.75;

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_PX || height > MAX_PX) {
        if (width >= height) { height = Math.round((height * MAX_PX) / width); width = MAX_PX; }
        else { width = Math.round((width * MAX_PX) / height); height = MAX_PX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", JPEG_QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function ensureBucket(name: string) {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === name)) return;
  const { error } = await supabase.storage.createBucket(name, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
  });
  if (error && !error.message.includes("already exists")) {
    console.error(`[photos] Failed to create bucket ${name}:`, error.message);
  }
}

export async function uploadInterventionPhotos(
  photos: PhotoFile[],
  userId: string,
): Promise<string[]> {
  if (photos.length === 0) return [];
  await ensureBucket(BUCKET);
  const urls: string[] = [];
  for (const { file } of photos) {
    const compressed = await compressImage(file);
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
      cacheControl: "3600",
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) { toast.error(`Erreur upload photo : ${error.message}`); continue; }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

export async function deleteInterventionPhoto(url: string) {
  const path = extractPath(url, BUCKET);
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}

export async function uploadSignature(blob: Blob, userId: string): Promise<string | null> {
  await ensureBucket(SIG_BUCKET);
  const path = `${userId}/${Date.now()}.png`;
  const { error } = await supabase.storage.from(SIG_BUCKET).upload(path, blob, {
    cacheControl: "3600",
    contentType: "image/png",
    upsert: false,
  });
  if (error) { toast.error(`Erreur upload signature : ${error.message}`); return null; }
  const { data } = supabase.storage.from(SIG_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteSignature(url: string) {
  const path = extractPath(url, SIG_BUCKET);
  if (path) await supabase.storage.from(SIG_BUCKET).remove([path]);
}

function extractPath(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

const LOGO_BUCKET = "company-logos";

export async function uploadCompanyLogo(file: File, userId: string): Promise<string | null> {
  await ensureBucket(LOGO_BUCKET);
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/logo.${ext}`;
  const compressed = await compressImage(file);
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, compressed, {
    cacheControl: "3600",
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) { toast.error(`Erreur upload logo : ${error.message}`); return null; }
  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  // Add cache-bust to force refresh
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function deleteCompanyLogo(url: string) {
  const path = extractPath(url.split("?")[0], LOGO_BUCKET);
  if (path) await supabase.storage.from(LOGO_BUCKET).remove([path]);
}
