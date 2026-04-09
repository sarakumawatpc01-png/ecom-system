import sharp from 'sharp';

export const processImageToWebP = async (buffer: Buffer) => {
  return sharp(buffer)
    .rotate()
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
};
