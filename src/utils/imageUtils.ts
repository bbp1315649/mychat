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

/**
 * Utility for processing and square-cropping user profile avatars from device storage or camera.
 * Supports large images (up to 35MB) by loading via URL.createObjectURL or FileReader,
 * auto-detects aspect ratio, center-crops to a perfect 1:1 square, and compresses to lightweight JPEG.
 */
export async function cropAndCompressAvatar(
  fileOrBlob: File | Blob,
  targetSize = 360,
  quality = 0.85
): Promise<{ dataUrl: string; sizeKb: number }> {
  return new Promise((resolve, reject) => {
    // Basic file validation
    if (fileOrBlob.size > 35 * 1024 * 1024) {
      reject(new Error('حجم تصویر بیش از حد مجاز (حداکثر ۳۵ مگابایت) است. لطفاً عکسی با حجم کمتر انتخاب کنید.'));
      return;
    }

    // Try URL.createObjectURL first (fastest, memory efficient for mobile devices)
    let blobUrl: string | null = null;
    try {
      blobUrl = URL.createObjectURL(fileOrBlob);
    } catch (e) {
      // fallback to FileReader
    }

    const processImage = (img: HTMLImageElement) => {
      try {
        const { naturalWidth, naturalHeight } = img;
        if (!naturalWidth || !naturalHeight) {
          throw new Error('ابعاد تصویر معتبر نیست.');
        }

        // Center square crop calculation
        const minDim = Math.min(naturalWidth, naturalHeight);
        const sx = Math.floor((naturalWidth - minDim) / 2);
        const sy = Math.floor((naturalHeight - minDim) / 2);

        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('عدم دسترسی به بستر پردازش تصویر Canvas');
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw center-cropped square
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const head = 'data:image/jpeg;base64,';
        const base64Length = dataUrl.length - head.length;
        const sizeKb = Math.round((base64Length * 3) / 4 / 1024);

        resolve({ dataUrl, sizeKb });
      } catch (err: any) {
        reject(err || new Error('خطا در برش و بهینه‌سازی عکس'));
      } finally {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      }
    };

    const img = new Image();
    img.onload = () => processImage(img);
    img.onerror = () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      // If blobUrl failed (e.g. some webviews), fallback to FileReader
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('خطا در خواندن فایل از حافظه دستگاه'));
      reader.onload = () => {
        const fallbackImg = new Image();
        fallbackImg.onload = () => processImage(fallbackImg);
        fallbackImg.onerror = () => reject(new Error('فرمت تصویر انتخاب‌شده پشتیبانی نمی‌شود. لطفاً تصویر دیگری (JPG یا PNG) انتخاب نمایید.'));
        fallbackImg.src = reader.result as string;
      };
      reader.readAsDataURL(fileOrBlob);
    };

    if (blobUrl) {
      img.src = blobUrl;
    } else {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('خطا در دسترسی به حافظه دستگاه'));
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.readAsDataURL(fileOrBlob);
    }
  });
}

