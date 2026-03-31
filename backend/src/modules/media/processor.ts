import sharp from 'sharp'

export async function processImage(buffer: Buffer, width = 1600): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer()
}
