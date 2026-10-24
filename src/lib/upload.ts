import { supabase } from './supabase';

export async function uploadBrandingImage(
  file: File,
  folder: string
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('branding')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    return { url: null, error: uploadError.message };
  }

  const { data } = supabase.storage.from('branding').getPublicUrl(fileName);
  return { url: data.publicUrl, error: null };
}
