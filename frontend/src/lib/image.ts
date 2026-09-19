/** Client-side image helpers. */

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Centre-crop to a square and shrink to `size` px so it stays small in local storage. */
export async function squarePhoto(file: File, size = 256): Promise<string> {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.');
  if (file.size > PHOTO_MAX_BYTES) throw new Error('That image is over 5 MB. Choose a smaller one.');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('We couldn’t read that image. Try another file.');
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser can’t process images.');
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
