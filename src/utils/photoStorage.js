const DEFAULT_OPTIONS = {
  maxSize: 720,
  quality: 0.72,
  mimeType: 'image/jpeg'
};

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Fotoğraf okunamadı.'));
    };
    img.src = url;
  });

const canvasToDataUrl = (canvas, mimeType, quality) => canvas.toDataURL(mimeType, quality);

export const compressImageToDataUrl = async (file, options = {}) => {
  const { maxSize, quality, mimeType } = { ...DEFAULT_OPTIONS, ...options };
  const img = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  return {
    dataUrl: canvasToDataUrl(canvas, mimeType, quality),
    width,
    height,
    mimeType
  };
};

export const estimateDataUrlBytes = (dataUrl = '') => Math.ceil((dataUrl.length * 3) / 4);
