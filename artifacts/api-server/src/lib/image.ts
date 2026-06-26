import { logger } from "./logger";

/**
 * Checks if the imageUrl is a base64 encoded image and compresses it if it exceeds size limits.
 * Downscales image to max 150px dimension and converts to compressed JPEG.
 */
export async function compressImageIfBase64(imageUrl: string): Promise<string> {
  if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("data:image")) {
    return imageUrl;
  }

  // If the base64 string is already small (e.g., < 100KB characters), don't compress it
  if (imageUrl.length < 100000) {
    return imageUrl;
  }

  try {
    const matches = imageUrl.match(/^data:image\/([a-zA-Z+0-9]+);base64,(.+)$/);
    if (!matches) return imageUrl;

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    // Dynamic import to avoid loading Jimp unnecessarily
    const { Jimp } = await import("jimp");
    const image = await Jimp.read(buffer);

    let w = image.width;
    let h = image.height;
    const maxDim = 150;

    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
      image.resize({ w, h });
    }

    const compressedBuffer = await image.getBuffer("image/jpeg");
    const compressedBase64 = compressedBuffer.toString("base64");
    
    logger.info({ 
      originalLength: imageUrl.length, 
      compressedLength: compressedBase64.length 
    }, "Successfully compressed base64 image on-the-fly");

    return `data:image/jpeg;base64,${compressedBase64}`;
  } catch (err: any) {
    logger.error({ err }, "Failed to compress base64 image on-the-fly, saving raw image instead");
    return imageUrl;
  }
}
