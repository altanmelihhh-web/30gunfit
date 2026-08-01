const isHeic = (file) => {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return type === 'image/heic' || type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif');
};

/**
 * iPhone'lar varsayılan olarak fotoğrafları HEIC formatında kaydeder - Safari dışında
 * tarayıcılar bunu görüntüleyemez/işleyemez. HEIC tespit edilirse JPEG'e çevirir,
 * değilse dosyayı olduğu gibi döndürür.
 */
export const normalizeImageFile = async (file) => {
  if (!isHeic(file)) {
    return file;
  }
  const heic2any = (await import('heic2any')).default;
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
};
