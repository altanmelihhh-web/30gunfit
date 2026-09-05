# 30 Gün Fit

Kişisel sağlık ve fitness takip uygulaması. React/Vite frontend, Firebase Auth/Firestore/Hosting ve Gemini API entegrasyonu kullanır.

## Özellikler

- Öğün, kalori, makro ve mikro besin takibi
- Open Food Facts ürün/barkod arama
- Öğün şablonları ve sık kullanılan öğünler
- AI fotoğraf/metin analizi
- Su, uyku, kilo, vücut ölçüsü, vücut kompozisyonu ve ilerleme fotoğrafları
- Antrenman kaydı, trend ekranı ve haftalık/aylık raporlar
- PWA/service worker desteği

## Geliştirme

```bash
npm install
npm start
```

Yerel uygulama varsayılan olarak `http://localhost:3000` adresinde açılır.

## Ortam Değişkenleri

Ücretsiz Firebase Spark planında Functions kullanmıyoruz. Gemini anahtarı Vite build sırasında frontend'e eklenir; bu yüzden anahtarı Git'e koymayın ve Google AI Studio'da HTTP referrer kısıtı ekleyin.

```bash
cp .env.example .env
```

`.env` içine:

```bash
VITE_GEMINI_API_KEY=...
```

Önerilen API key kısıtları:

- `https://gunfit-c0243.web.app/*`
- `http://localhost:3000/*`

## Test ve Build

```bash
npm test -- --watchAll=false
npm run build
```

Vite build çıktısı Firebase Hosting ile uyumlu olacak şekilde `build/` klasörüne yazılır.

Deploy:

```bash
firebase deploy --only firestore:rules,hosting
```

Önemli: Daha önce frontend bundle içinde görünen Gemini anahtarı rotate edilmelidir. Yeni anahtar yalnızca `.env` içinde tutulmalı ve referrer kısıtlı olmalıdır.

## Veri Güvenliği

Uygulamaya Google hesabıyla giriş yapılabilir. Firestore kuralları her kullanıcının yalnızca kendi `uid` kapsamındaki verilerini okuyup yazmasına izin verir.

`.env` dosyaları Git'e eklenmemelidir.
