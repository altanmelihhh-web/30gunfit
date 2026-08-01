const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_NAME = '30GunFit Yemek Fotograflari';

const driveFetch = async (url, accessToken, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const error = new Error(err.error?.message || 'Google Drive isteği başarısız oldu');
    error.status = response.status;
    throw error;
  }
  return response;
};

const getOrCreateMealPhotosFolder = async (accessToken) => {
  const query = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchRes = await driveFetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    accessToken
  );
  const searchData = await searchRes.json();
  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }
  const createRes = await driveFetch(`${DRIVE_API}/files`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
  });
  const created = await createRes.json();
  return created.id;
};

/**
 * Fotoğrafı kullanıcının kendi Google Drive'ındaki uygulama klasörüne yükler
 * @returns {Promise<string>} Drive dosya ID'si
 */
export const uploadMealPhotoToDrive = async (accessToken, file, fileName) => {
  const folderId = await getOrCreateMealPhotosFolder(accessToken);
  const metadata = { name: fileName, parents: [folderId] };
  const boundary = '30gunfit_boundary_' + Date.now();
  const encoder = new TextEncoder();
  const metadataPart = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
  );
  const mediaHeader = encoder.encode(`--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`);
  const closing = encoder.encode(`\r\n--${boundary}--`);
  const fileBuffer = await file.arrayBuffer();

  const body = new Blob([metadataPart, mediaHeader, fileBuffer, closing]);

  const res = await driveFetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    }
  );
  const data = await res.json();
  return data.id;
};

/**
 * Drive'daki fotoğrafı indirip görüntülenebilir bir blob URL'e çevirir
 * Token süresi dolmuşsa (401/403) hata fırlatır - çağıran taraf yeniden giriş istemeli
 */
export const fetchDriveImageUrl = async (accessToken, fileId) => {
  const res = await driveFetch(`${DRIVE_API}/files/${fileId}?alt=media`, accessToken);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};
