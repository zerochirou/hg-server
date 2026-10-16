# Dokumentasi Arsitektur API Endpoint & Panduan Integrasi (HyperGrid Server)

Dokumentasi ini disusun secara komprehensif untuk memetakan seluruh endpoint backend NestJS, skema request/response, logika bisnis spasial PostGIS, referensi konsumsi pada frontend Next.js, serta panduan integrasi untuk aplikasi mobile berbasis **Expo React Native**.

---

## 1. Arsitektur Sistem & Gambaran Umum

### 1.1 Struktur Monorepo
Proyek ini menggunakan arsitektur monorepo berbasis Turborepo dan pnpm:
- **`apps/server`**: Backend REST API dibangun menggunakan framework NestJS 11, Prisma ORM 7 (dengan `@prisma/adapter-pg`), PostgreSQL + PostGIS, serta Better-Auth untuk autentikasi.
- **`apps/app`**: Web dashboard monitoring dan GIS Studio dibangun menggunakan Next.js 16 (App Router), React 19, Tailwind CSS v4, TanStack React Query v5, dan MapLibre GL.

### 1.2 Konfigurasi Server & Network
| Parameter | Nilai Default | Keterangan |
| :--- | :--- | :--- |
| **Default Port** | `4000` | Dikonfigurasi melalui environment variable `PORT` |
| **Global API Prefix** | `/api` | Ditetapkan pada `main.ts` (`app.setGlobalPrefix('/api', { exclude: ['/'] })`) |
| **Base URL Lokal (Web/Node)** | `http://localhost:4000/api` | Akses dari browser atau terminal lokal |
| **Base URL Android Emulator** | `http://10.0.2.2:4000/api` | Akses dari Android Virtual Device (AVD) |
| **Base URL Expo Device (LAN)** | `http://<IP_KOMPUTER_LAN>:4000/api` | Akses dari Expo Go atau Dev Client pada smartphone fisik |
| **CORS Policy** | Mengizinkan mobile (`!origin`), `localhost:3000`, `localhost:8081`, dan skema mobile (`exp://`, `hypergrid://`) | `credentials: true` aktif |

---

## 2. Mekanisme Autentikasi & Sesi (Better-Auth)

Backend menggunakan **Better-Auth** yang dipasang melalui `@thallesp/nestjs-better-auth` dengan adapter database Prisma PostgreSQL.

### 2.1 Konfigurasi Autentikasi
- **Base Path Auth**: `/api/auth`
- **Plugin Aktif**:
  - `bearer()`: Mendukung autentikasi berbasis Bearer Token header (`Authorization: Bearer <token>`) yang sangat esensial untuk aplikasi mobile Expo React Native.
  - `expo()`: Mendukung skema deep-linking dan session handling untuk ekosistem React Native / Expo (`exp://`, `hypergrid://`).
- **Penyimpanan Kredensial**:
  - Web: HTTP-only Session Cookie (`better-auth.session_token`).
  - Mobile Expo: Bearer Token disimpan secara persisten di `expo-secure-store` dan dikirimkan pada header `Authorization: Bearer <token>`.

### 2.2 Endpoint Autentikasi Utama (`/api/auth/*`)

#### A. Registrasi Akun Petugas (Sign Up Email)
- **Method & Path**: `POST /api/auth/sign-up/email`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "petugas@hypergrid.io",
    "password": "passwordAman123",
    "name": "Budi Santoso"
  }
  ```
- **Response (200 OK / 201 Created)**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "usr_99812739",
      "email": "petugas@hypergrid.io",
      "name": "Budi Santoso",
      "emailVerified": false,
      "createdAt": "2026-10-11T12:00:00.000Z",
      "updatedAt": "2026-10-11T12:00:00.000Z"
    }
  }
  ```

#### B. Masuk Akun Petugas (Sign In Email)
- **Method & Path**: `POST /api/auth/sign-in/email`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "petugas@hypergrid.io",
    "password": "passwordAman123",
    "callbackURL": "http://localhost:3000/dashboard"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "usr_99812739",
      "email": "petugas@hypergrid.io",
      "name": "Budi Santoso"
    }
  }
  ```

#### C. Keluar Akun (Sign Out)
- **Method & Path**: `POST /api/auth/sign-out`
- **Headers**: `Authorization: Bearer <token>` atau Cookie session.
- **Request Body**: `{}`
- **Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

#### D. Verifikasi Sesi Aktif (Get Session)
- **Method & Path**: `GET /api/auth/get-session`
- **Headers**: `Authorization: Bearer <token>` (Mobile) atau Cookie session (Web)
- **Response (200 OK)**:
  ```json
  {
    "session": {
      "id": "sess_123",
      "userId": "usr_99812739",
      "expiresAt": "2026-10-18T12:00:00.000Z",
      "token": "eyJhbGciOi..."
    },
    "user": {
      "id": "usr_99812739",
      "email": "petugas@hypergrid.io",
      "name": "Budi Santoso"
    }
  }
  ```

---

## 3. Spesifikasi Lengkap Endpoint Domain

Domain utama HyperGrid mencakup **Detections (Data Mentah Telemetri IoT)** dan **Pothole Clusters (Hasil Agregasi Spasial AI)**.

```
┌──────────────────────────────────────────────────────────────┐
│                    Mobile / IoT Device                       │
│    (GPS, Accelerometer Z-Peak, AI Inference Edge Model)      │
└──────────────────────────────┬───────────────────────────────┘
                               │
            POST /api/detections (Single / Batch)
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     NestJS Server Core                       │
│ 1. Simpan Raw Record ke tabel `detections`                   │
│ 2. Spatial Clustering: Cek radius 15m (`findNearby`)          │
│    ├─ Ada: UPDATE `pothole_clusters` (hitung avg confidence) │
│    └─ Baru: INSERT `pothole_clusters` (status: active)       │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     PostGIS Database                         │
│ - PostGIS ST_DWithin (geography, 15m)                        │
│ - PostGIS ST_MakeEnvelope (Bounding Box Viewport)            │
└──────────────────────────────────────────────────────────────┘
```

---

### 3.1 Modul Sistem & Health Check

#### `GET /`
- **Deskripsi**: Root endpoint server. Mengarahkan otomatis ke dashboard web frontend.
- **Status Kode**: `302 Found`
- **Headers**: N/A
- **Respons**: Redirect ke `${CLIENT_URL}/dashboard` (default: `http://localhost:3000/dashboard`).

#### `GET /api/health`
- **Deskripsi**: Health check status server dan ketersediaan layanan backend.
- **Status Kode**: `200 OK`
- **Respons JSON**:
  ```json
  {
    "status": "ok",
    "service": "hypergrid-server",
    "timestamp": "2026-10-11T14:30:00.000Z"
  }
  ```

---

### 3.2 Modul Deteksi Mentah (`/api/detections`)

Modul ini mengelola data mentah hasil pembacaan sensor akselerometer dan inferensi model AI di perangkat pengguna / driver.

#### Endpoint 1: Single Ingestion (`POST /api/detections`)
- **Deskripsi**: Menyimpan 1 data deteksi mentah baru dan **secara otomatis melakukan agregasi spasial online** ke tabel `pothole_clusters`.
- **Status Kode**: `201 Created`
- **Headers**: `Content-Type: application/json`
- **Skema Request Body**:
  | Properti | Tipe Data | Wajib | Keterangan |
  | :--- | :--- | :--- | :--- |
  | `deviceId` | `string` | Ya | Identifier unik perangkat/kendaraan (misal: `"dev-pixel-7-driver-1"`) |
  | `userId` | `string` | Tidak | ID user pemilik sesi (opsional, `null` jika anonim) |
  | `latitude` | `number` (float) | Ya | Titik koordinat latitude WGS84 (misal: `-6.208800`) |
  | `longitude` | `number` (float) | Ya | Titik koordinat longitude WGS84 (misal: `106.845600`) |
  | `confidence` | `number` (float) | Ya | Tingkat keyakinan deteksi model AI (rentang `0.0` - `1.0`) |
  | `speedKmh` | `number` (float) | Tidak | Kecepatan kendaraan saat deteksi dalam km/jam |
  | `zAccelPeak` | `number` (float) | Tidak | Puncak gaya gravitasi sumbu Z akselerometer (dalam satuan G) |
  | `modelVersion` | `string` | Tidak | Versi model AI yang digunakan (default: `"v1"`) |
  | `detectedAt` | `string` (ISO 8601) | Ya | Waktu pencatatan deteksi pada perangkat |

- **Contoh Request Body**:
  ```json
  {
    "deviceId": "dev-pixel-7-driver-1",
    "latitude": -6.208800,
    "longitude": 106.845600,
    "confidence": 0.94,
    "speedKmh": 42.5,
    "zAccelPeak": 3.85,
    "modelVersion": "v1.0",
    "detectedAt": "2026-09-01T12:00:00.000Z"
  }
  ```

- **Contoh Respons (201 Created)**:
  ```json
  {
    "id": "e2a149cb-4899-4c07-b35a-942df35154ee",
    "deviceId": "dev-pixel-7-driver-1",
    "userId": null,
    "latitude": -6.2088,
    "longitude": 106.8456,
    "confidence": 0.94,
    "speedKmh": 42.5,
    "zAccelPeak": 3.85,
    "modelVersion": "v1.0",
    "detectedAt": "2026-09-01T12:00:00.000Z",
    "createdAt": "2026-09-01T12:00:01.120Z"
  }
  ```
  *(Catatan: Model Detection dikembalikan oleh Prisma dengan format penamaan properti **camelCase**)*.

- **Efek Samping Spasial Backend**:
  Backend memanggil `clustersService.aggregateDetection()`. Jika dalam radius 15 meter telah ada klaster jalan rusak, `detection_count` dinaikkan 1 dan rata-rata `confidence_avg` diperbarui. Jika belum ada, klaster baru dengan status `active` dan tingkat keparahan `medium` akan otomatis dibuat.

---

#### Endpoint 2: Bulk / Batch Ingestion (`POST /api/detections/batch`)
- **Deskripsi**: Mengunggah kumpulan data deteksi sekaligus. Endpoint ini sangat krusial untuk perangkat mobile ketika berada di area sinyal lemah (offline mode) dan mengirim data secara massal saat kembali online.
- **Status Kode**: `201 Created`
- **Headers**: `Content-Type: application/json`
- **Skema Request Body**:
  | Properti | Tipe Data | Wajib | Keterangan |
  | :--- | :--- | :--- | :--- |
  | `detections` | `CreateDetectionDto[]` | Ya | Array berisi objek deteksi dengan struktur yang sama seperti single ingestion |

- **Contoh Request Body**:
  ```json
  {
    "detections": [
      {
        "deviceId": "dev-pixel-7-driver-1",
        "latitude": -6.208850,
        "longitude": 106.845650,
        "confidence": 0.91,
        "speedKmh": 41.0,
        "zAccelPeak": 4.10,
        "modelVersion": "v1.0",
        "detectedAt": "2026-09-01T12:00:05.000Z"
      },
      {
        "deviceId": "dev-pixel-7-driver-1",
        "latitude": -6.208920,
        "longitude": 106.845710,
        "confidence": 0.88,
        "speedKmh": 39.5,
        "zAccelPeak": 3.65,
        "modelVersion": "v1.0",
        "detectedAt": "2026-09-01T12:00:10.000Z"
      }
    ]
  }
  ```

- **Contoh Respons (201 Created)**:
  ```json
  {
    "count": 2
  }
  ```

---

#### Endpoint 3: Daftar Raw Detections (`GET /api/detections`)
- **Deskripsi**: Mengambil daftar log deteksi mentah dengan opsi filter dan batas jumlah data.
- **Status Kode**: `200 OK`
- **Query Parameters**:
  | Parameter | Tipe Data | Wajib | Default | Keterangan |
  | :--- | :--- | :--- | :--- | :--- |
  | `limit` | `string` (integer) | Tidak | `100` | Batas maksimum record yang diambil |
  | `search` | `string` | Tidak | N/A | Mencari kata kunci pada `deviceId` atau `modelVersion` (case-insensitive) |
  | `deviceId` | `string` | Tidak | N/A | Filter spesifik berdasarkan ID perangkat |

- **Contoh URL**:
  `GET /api/detections?limit=50&deviceId=dev-pixel-7-driver-1`

- **Contoh Respons (200 OK)**:
  ```json
  [
    {
      "id": "e2a149cb-4899-4c07-b35a-942df35154ee",
      "deviceId": "dev-pixel-7-driver-1",
      "userId": null,
      "latitude": -6.2088,
      "longitude": 106.8456,
      "confidence": 0.94,
      "speedKmh": 42.5,
      "zAccelPeak": 3.85,
      "modelVersion": "v1.0",
      "detectedAt": "2026-09-01T12:00:00.000Z",
      "createdAt": "2026-09-01T12:00:01.120Z"
    }
  ]
  ```

---

#### Endpoint 4: Riwayat Deteksi Perangkat (`GET /api/detections/device/:deviceId`)
- **Deskripsi**: Mengambil riwayat deteksi terakhir khusus untuk satu perangkat (maksimum 50 entri, diurutkan descending berdasarkan waktu).
- **Status Kode**: `200 OK`
- **Path Parameters**: `deviceId` (`string`)
- **Contoh URL**: `GET /api/detections/device/dev-pixel-7-driver-1`
- **Contoh Respons (200 OK)**: Array objek `Detection[]`.

---

#### Endpoint 5: Detail Raw Detection (`GET /api/detections/:id`)
- **Deskripsi**: Mengambil detail satu data deteksi berdasarkan UUID.
- **Status Kode**: `200 OK` (atau `404 Not Found`)
- **Path Parameters**: `id` (`string` UUID)
- **Contoh Respons (200 OK)**: Objek `Detection`.

---

#### Endpoint 6: Update Raw Detection (`PATCH /api/detections/:id`)
- **Deskripsi**: Memperbarui atribut telemetri record deteksi (biasanya digunakan pada dashboard GIS untuk koreksi).
- **Status Kode**: `200 OK` (atau `404 Not Found`)
- **Path Parameters**: `id` (`string` UUID)
- **Request Body**:
  ```json
  {
    "confidence": 0.98,
    "speedKmh": 45.0,
    "zAccelPeak": 4.10,
    "modelVersion": "v1.2",
    "deviceId": "dev-pixel-7-driver-1",
    "latitude": -6.20885,
    "longitude": 106.84565
  }
  ```
- **Contoh Respons (200 OK)**: Objek `Detection` terupdate.

---

#### Endpoint 7: Hapus Raw Detection (`DELETE /api/detections/:id`)
- **Deskripsi**: Menghapus data deteksi mentah berdasarkan ID.
- **Status Kode**: `200 OK` (atau `404 Not Found`)
- **Path Parameters**: `id` (`string` UUID)
- **Contoh Respons (200 OK)**: Objek `Detection` yang telah dihapus.

---

### 3.3 Modul Klaster Lubang Jalan (`/api/pothole-clusters`)

Modul ini menyediakan data spasial hasil klasterisasi PostGIS untuk visualisasi peta dan sistem peringatan dini driver (*early warning*).

#### Endpoint 1: Query Bounding Box / Viewport Map (`GET /api/pothole-clusters`)
- **Deskripsi**: Mengambil seluruh klaster lubang jalan dalam jendela koordinat peta (*viewport bounding box*) atau seluruh daftar klaster dengan filter status/keparahan.
- **Status Kode**: `200 OK`
- **Query Parameters**:
  | Parameter | Tipe Data | Wajib | Keterangan |
  | :--- | :--- | :--- | :--- |
  | `minLat` | `number` (float) | Tidak | Titik latitude batas selatan (South) |
  | `minLon` | `number` (float) | Tidak | Titik longitude batas barat (West) |
  | `maxLat` | `number` (float) | Tidak | Titik latitude batas utara (North) |
  | `maxLon` | `number` (float) | Tidak | Titik longitude batas timur (East) |
  | `status` | `string` | Tidak | `'active'` \| `'verified'` \| `'repaired'` \| `'false_positive'` |
  | `severity` | `string` | Tidak | `'low'` \| `'medium'` \| `'high'` \| `'severe'` |
  | `limit` | `number` (int) | Tidak | Batas data (default: `500`) |

- **Contoh URL Bounding Box**:
  `GET /api/pothole-clusters?minLat=-6.2200&minLon=106.8300&maxLat=-6.2000&maxLon=106.8600&status=active`

- **Contoh Respons (200 OK)**:
  ```json
  [
    {
      "id": "76161491-dff1-4ab0-b4fe-c96791bfba12",
      "center_latitude": -6.2088,
      "center_longitude": 106.8456,
      "severity": "medium",
      "confidence_avg": 0.94,
      "detection_count": 3,
      "status": "active",
      "first_detected_at": "2026-09-01T12:00:00.000Z",
      "last_detected_at": "2026-09-01T12:00:10.000Z",
      "updated_at": "2026-09-01T12:00:10.540Z"
    }
  ]
  ```
  *(Catatan Penting: Karena endpoint ini menggunakan query raw SQL PostgreSQL, atribut respons menggunakan format **snake_case**: `center_latitude`, `center_longitude`, `confidence_avg`, `detection_count`, `first_detected_at`, `last_detected_at`, `updated_at`)*.

---

#### Endpoint 2: Cek Lubang Terdekat / Driver Early Warning (`GET /api/pothole-clusters/nearby`)
- **Deskripsi**: Digunakan oleh aplikasi mobile driver untuk mendeteksi apakah terdapat lubang jalan berbahaya di depan kendaraan dalam radius tertentu ($N$ meter).
- **Status Kode**: `200 OK`
- **Query Parameters**:
  | Parameter | Tipe Data | Wajib | Keterangan |
  | :--- | :--- | :--- | :--- |
  | `lat` | `number` (float) | Ya | Posisi latitude GPS driver saat ini |
  | `lon` | `number` (float) | Ya | Posisi longitude GPS driver saat ini |
  | `radius` | `number` (float) | Tidak | Jarak jangkauan deteksi dalam satuan meter (default: `15`) |

- **Contoh URL**:
  `GET /api/pothole-clusters/nearby?lat=-6.208800&lon=106.845600&radius=50`

- **Contoh Respons Jika Ditemukan (200 OK)**:
  ```json
  {
    "id": "76161491-dff1-4ab0-b4fe-c96791bfba12",
    "center_latitude": -6.2088,
    "center_longitude": 106.8456,
    "severity": "medium",
    "confidence_avg": 0.94,
    "detection_count": 3,
    "status": "active",
    "first_detected_at": "2026-09-01T12:00:00.000Z",
    "last_detected_at": "2026-09-01T12:00:10.000Z",
    "updated_at": "2026-09-01T12:00:10.540Z",
    "distance_meters": 6.42
  }
  ```
  *(Properti `distance_meters` dihitung otomatis menggunakan fungsi PostGIS `ST_Distance` geografi)*.

- **Contoh Respons Jika Tidak Ada Lubang Dalam Radius (200 OK)**:
  `null` atau `HTTP 200 with empty body/null`

---

#### Endpoint 3: Detail Klaster Lubang (`GET /api/pothole-clusters/:id`)
- **Deskripsi**: Mengambil detail satu klaster kerusakan jalan berdasarkan UUID.
- **Status Kode**: `200 OK` (atau `404 Not Found`)
- **Path Parameters**: `id` (`string` UUID)
- **Contoh URL**: `GET /api/pothole-clusters/76161491-dff1-4ab0-b4fe-c96791bfba12`
- **Contoh Respons (200 OK)**: Objek `PotholeClusterEntity`.

---

#### Endpoint 4: Update Status Verifikasi Dinas PU (`PATCH /api/pothole-clusters/:id/status`)
- **Deskripsi**: Digunakan oleh petugas verifikator lapangan atau dinas PU untuk memperbarui status penanganan jalan rusak (misal: memvalidasi kebenaran lubang atau menandai telah selesai diperbaiki).
- **Status Kode**: `200 OK` (atau `404 Not Found`)
- **Path Parameters**: `id` (`string` UUID)
- **Headers**: `Content-Type: application/json`
- **Skema Request Body**:
  | Properti | Tipe Data | Wajib | Nilai yang Diizinkan |
  | :--- | :--- | :--- | :--- |
  | `status` | `string` | Ya | `'active'`, `'verified'`, `'repaired'`, `'false_positive'` |
  | `severity` | `string` | Tidak | `'low'`, `'medium'`, `'high'`, `'severe'` |

- **Contoh Request Body**:
  ```json
  {
    "status": "verified",
    "severity": "high"
  }
  ```

- **Contoh Respons (200 OK)**:
  ```json
  {
    "id": "76161491-dff1-4ab0-b4fe-c96791bfba12",
    "center_latitude": -6.2088,
    "center_longitude": 106.8456,
    "severity": "high",
    "confidence_avg": 0.94,
    "detection_count": 3,
    "status": "verified",
    "first_detected_at": "2026-09-01T12:00:00.000Z",
    "last_detected_at": "2026-09-01T12:00:10.000Z",
    "updated_at": "2026-10-11T14:35:00.000Z"
  }
  ```

---

#### Endpoint 5: Edit Atribut Klaster Menyeluruh (`PATCH /api/pothole-clusters/:id`)
- **Deskripsi**: Memperbarui atribut posisi spasial, tingkat keparahan, rata-rata confidence, atau status dari klaster.
- **Status Kode**: `200 OK` (atau `404 Not Found`)
- **Path Parameters**: `id` (`string` UUID)
- **Request Body**:
  ```json
  {
    "status": "repaired",
    "severity": "medium",
    "center_latitude": -6.20881,
    "center_longitude": 106.84561,
    "detection_count": 5,
    "confidence_avg": 0.92
  }
  ```
- **Contoh Respons (200 OK)**: Objek `PotholeClusterEntity` terupdate.

---

#### Endpoint 6: Hapus Klaster Lubang (`DELETE /api/pothole-clusters/:id`)
- **Deskripsi**: Menghapus klaster lubang jalan dari basis data PostGIS.
- **Status Kode**: `200 OK` (atau `404 Not Found`)
- **Path Parameters**: `id` (`string` UUID)
- **Contoh Respons (200 OK)**:
  ```json
  {
    "success": true,
    "id": "76161491-dff1-4ab0-b4fe-c96791bfba12"
  }
  ```

---

## 4. Referensi Penerapan Pada Frontend Web

Frontend web (`apps/app`) mengonsumsi endpoint-endpoint ini menggunakan TanStack Query (`useQuery` dan `useMutation`):

1. **Pemanggilan Viewport Spasial**:
   File `apps/app/src/hooks/use-pothole-clusters.ts` mendengarkan pergerakan kamera peta MapLibre (`moveend` event), lalu mengekstrak `bounds.getSouth()`, `bounds.getWest()`, `bounds.getNorth()`, `bounds.getEast()`, dan mengirimkannya ke `GET /api/pothole-clusters?minLat=...&minLon=...&maxLat=...&maxLon=...`.
2. **Refetching Otomatis**:
   Semua data di-polling secara berkala setiap 10 detik (`refetchInterval: 10000`).
3. **Penyelarasan Cache Query**:
   Saat aksi verifikasi atau perubahan status dilakukan di tabel (`useUpdateClusterStatus`), frontend melakukan `queryClient.invalidateQueries({ queryKey: ['pothole-clusters'] })` untuk memastikan pin peta langsung sinkron dengan status baru.

---

## 5. Panduan Praktis Implementasi Pada Expo React Native

Panduan ini ditujukan bagi AI Agent atau pengembang yang akan membangun aplikasi mobile Expo React Native.

### 5.1 Penentuan Base URL Dinamis Sesuai Target Runtime
Saat menjalankan aplikasi di Expo, URL localhost bervariasi:
```typescript
import { Platform } from 'react-native';

export const getApiBaseUrl = (): string => {
  if (Platform.OS === 'android') {
    // 10.0.2.2 adalah alias loopback host komputer pada Android Emulator
    return 'http://10.0.2.2:4000/api';
  } else if (Platform.OS === 'ios') {
    // iOS Simulator dapat langsung mengakses localhost
    return 'http://localhost:4000/api';
  } else {
    // Untuk perangkat fisik (Expo Go / Dev Client via WiFi LAN)
    // Ganti dengan IP lokal laptop/mesin dev, misal:
    return 'http://192.168.1.10:4000/api';
  }
};
```

### 5.2 Integrasi Better-Auth Client dengan Expo SecureStore
Pasang dependensi `@better-auth/expo` dan `expo-secure-store`:
```typescript
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

export const authClient = createAuthClient({
  baseURL: 'http://10.0.2.2:4000',
  basePath: '/api/auth',
  plugins: [
    expoClient({
      storage: SecureStore,
    }),
  ],
});
```

### 5.3 Modul Driver Early Warning (Cek Lubang Terdekat)
Gunakan modul `expo-location` untuk mengambil posisi GPS driver dan lakukan query ke `/nearby`:
```typescript
import * as Location from 'expo-location';

export async function checkNearbyPothole(
  coords: { latitude: number; longitude: number },
  radiusMeters = 30
): Promise<PotholeCluster | null> {
  const url = `${getApiBaseUrl()}/pothole-clusters/nearby?lat=${coords.latitude}&lon=${coords.longitude}&radius=${radiusMeters}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json();
}
```

### 5.4 Modul Background Ingestion (Offline-First Queue)
Simpan data deteksi dari akselerometer di antrean lokal (misal: MMKV atau SQLite), lalu unggah menggunakan batch saat online:
```typescript
export async function flushDetectionsQueue(queue: CreateDetectionDto[]) {
  if (queue.length === 0) return;

  const response = await fetch(`${getApiBaseUrl()}/detections/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ detections: queue }),
  });

  if (!response.ok) {
    throw new Error('Gagal mengunggah batch deteksi');
  }

  return response.json();
}
```

---

## 6. TypeScript Definition Lengkap untuk Expo Native Client

Simpan tipe data berikut di file `types/api.ts` pada proyek Expo React Native:

```typescript
// Enum Status & Keparahan
export type PotholeSeverity = 'low' | 'medium' | 'high' | 'severe';
export type PotholeStatus = 'active' | 'verified' | 'repaired' | 'false_positive';

// Entitas Hasil Agregasi Spasial Klaster Pothole (snake_case dari PostGIS)
export interface PotholeCluster {
  id: string;
  center_latitude: number;
  center_longitude: number;
  severity: PotholeSeverity;
  confidence_avg: number;
  detection_count: number;
  status: PotholeStatus;
  first_detected_at: string;
  last_detected_at: string;
  updated_at: string;
  distance_meters?: number;
}

// Entitas Raw Detection (camelCase dari Prisma)
export interface RawDetection {
  id: string;
  deviceId: string;
  userId?: string | null;
  latitude: number;
  longitude: number;
  confidence: number;
  speedKmh?: number | null;
  zAccelPeak?: number | null;
  modelVersion: string;
  detectedAt: string;
  createdAt: string;
}

// DTO Pengiriman Deteksi Baru
export interface CreateDetectionDto {
  deviceId: string;
  userId?: string;
  latitude: number;
  longitude: number;
  confidence: number;
  speedKmh?: number;
  zAccelPeak?: number;
  modelVersion?: string;
  detectedAt: string;
}

export interface CreateBatchDetectionDto {
  detections: CreateDetectionDto[];
}

export interface UpdateClusterStatusDto {
  status: PotholeStatus;
  severity?: PotholeSeverity;
}

export interface BoundingBoxFilter {
  minLat?: number;
  minLon?: number;
  maxLat?: number;
  maxLon?: number;
  status?: PotholeStatus;
  severity?: PotholeSeverity;
  limit?: number;
}
```
