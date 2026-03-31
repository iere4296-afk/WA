import { supabase } from '../../lib/supabase.js'

export async function uploadMedia(
  orgId: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string,
  bucket = 'media',
) {
  const path = `${orgId}/${Date.now()}-${fileName}`
  const { error } = await supabase.storage.from(bucket).upload(path, fileBuffer, {
    contentType,
    upsert: false,
  })

  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return {
    path,
    url: data.publicUrl,
  }
}
