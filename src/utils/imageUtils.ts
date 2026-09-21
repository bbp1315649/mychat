/**
 * Utility for compressing images on client side before transmitting
 * Ensures quick transmission and fits within payload constraints while maintaining high clarity.
 */
export async function compressImage(
  fileOrBlob: File | Blob,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.82
): Promise<{ dataUrl: string; sizeKb: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('خطا در خواندن فایل تصویر'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('خطا در بارگذاری تصویر جهت بهینه‌سازی'));
      img.onload = () => {
        let { width, height } = img;

        // Proportional resize
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('محیط گرافیکی Canvas در دسترس نیست'));
          return;
        }

        // Draw image with smooth filtering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Estimate size in KB
        const head = 'data:image/jpeg;base64,';
        const base64Length = dataUrl.length - head.length;
        const sizeKb = Math.round((base64Length * 3) / 4 / 1024);

        resolve({ dataUrl, sizeKb, width, height });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(fileOrBlob);
  });
}
