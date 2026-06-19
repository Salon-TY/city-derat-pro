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

async function ensureBucket(name: string): Promise<boolean> {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === name)) return true;
  const { error } = await supabase.storage.createBucket(name, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
  });
  if (!error || error.message.toLowerCase().includes("already exist")) return true;
  console.error(`[photos] Bucket "${name}" inaccessible :`, error.message);
  return false;
}

// Garde-fou : sans user_id valide, le chemin serait à la racine et violerait la RLS storage.
function requireUserId(userId: string): boolean {
  if (!userId) {
    toast.error("Session expirée. Reconnectez-vous avant d'envoyer un fichier.");
    return false;
  }
  return true;
}

export async function uploadInterventionPhotos(
  photos: PhotoFile[],
  userId: string,
): Promise<string[]> {
  if (photos.length === 0) return [];
  if (!requireUserId(userId)) return [];
  const ok = await ensureBucket(BUCKET);
  if (!ok) {
    toast.error("Dossier photos inaccessible. Créez le bucket « intervention-photos » dans Supabase > Storage.");
    return [];
  }
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
  if (!requireUserId(userId)) return null;
  const ok = await ensureBucket(SIG_BUCKET);
  if (!ok) {
    toast.error("Dossier signatures inaccessible. Créez le bucket « intervention-signatures » dans Supabase > Storage.");
    return null;
  }
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
  if (!requireUserId(userId)) return null;
  const ok = await ensureBucket(LOGO_BUCKET);
  if (!ok) {
    toast.error("Dossier logos inaccessible. Créez le bucket « company-logos » dans Supabase > Storage > New bucket.");
    return null;
  }
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
