# Dokumen Evaluasi Kode & Rekomendasi Perbaikan Sistematis (HyperGrid)

Dokumen ini disusun untuk mengidentifikasi kelemahan, inkonsistensi arsitektur, potensi celah keamanan, dan bug fungsional yang ditemukan pada codebase fullstack HyperGrid (`apps/server` dan `apps/app`). Dokumen ini disusun secara modular dan sistematis agar dapat digunakan langsung oleh AI Agent atau pengembang berikutnya untuk melakukan refactoring dan automasi perbaikan.

---

## 1. Ringkasan Tingkat Urgensi Temuan

| No | Modul / Lokasi | Tingkat Urgensi | Deskripsi Singkat Masalah |
| :---: | :--- | :---: | :--- |
| 1 | `apps/server/src/main.ts` & DTOs | **Critical** | Tidak ada `ValidationPipe` global dan ketiadaan validasi runtime pada DTO |
| 2 | `apps/server/src/pothole-clusters` | **High** | Potensi SQL Crash (500 Error) pada `findNearby` jika koordinat `NaN` |
| 3 | `apps/server/src/pothole-clusters/pothole-clusters.service.ts` | **High** | Kolom geometri PostGIS (`center_location` & `location`) selalu `NULL` sehingga GiST Index mati |
| 4 | Controllers Backend (`detection` & `pothole-clusters`) | **High** | Ketiadaan Auth Guard pada endpoint mutasi data (`PATCH`, `DELETE`) |
| 5 | `apps/server/src/main.ts` | **Medium** | Kesalahan logika callback CORS (seluruh origin tidak dikenal tetap diizinkan) |
| 6 | Data Serialization (`Prisma` vs `Raw SQL`) | **Medium** | Inkonsistensi penamaan properti respons (`camelCase` vs `snake_case`) |
| 7 | `apps/server/src/detection/detection.service.ts` | **Medium** | N+1 Sequential Query pada proses batch ingestion (`createBatch`) |
| 8 | `apps/server/src/pothole-clusters/pothole-clusters.service.ts` | **Medium** | Parameter query `search` tidak diimplementasikan pada query SQL `getByBoundingBox` |
| 9 | `apps/server/src/auth.ts` | **Low** | Hardcoded IP development (`10.85.76.210`) pada `trustedOrigins` |
| 10 | `apps/app/src/app/dashboard/data/page.tsx` | **Low** | Notasi LaTeX mentah `$Z$-axis` di dalam antarmuka web |

---

## 2. Detail Evaluasi & Rekomendasi Solusi

---

### [BUG-01] Ketiadaan Global ValidationPipe & Validasi Runtime DTO (Critical)

#### Lokasi File:
- [`apps/server/src/main.ts`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/server/src/main.ts#L4-L7)
- [`apps/server/src/detection/dto/create-detection.dto.ts`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/server/src/detection/dto/create-detection.dto.ts#L1-L12)
- [`apps/server/src/detection/dto/create-batch-detection.dto.ts`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/server/src/detection/dto/create-batch-detection.dto.ts#L1-L6)
- [`apps/server/src/pothole-clusters/dto/update-cluster-status.dto.ts`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/server/src/pothole-clusters/dto/update-cluster-status.dto.ts#L1-L5)

#### Deskripsi Masalah:
1. `apps/server/package.json` tidak memiliki package `class-validator` maupun `class-transformer`.
2. Pada `main.ts`, tidak ada aktivasi `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))`.
3. Semua class DTO hanya mendefinisikan TypeScript interface/class murni tanpa decorator validator.
4. **Dampak**: Jika client atau hacker mengirim payload JSON dengan tipe data yang salah (misalnya `latitude: "jakarta"` atau `confidence: 999`), NestJS meloloskan payload tersebut ke Prisma / raw SQL, yang memicu error fatal database (*Internal Server Error 500*) alih-alih mengembalikan `400 Bad Request` yang ramah bagi client.

#### Rekomendasi Perbaikan:
1. Pasang dependensi di `apps/server`:
   ```bash
   pnpm --filter server add class-validator class-transformer
   ```
2. Tambahkan `ValidationPipe` di `apps/server/src/main.ts`:
   ```typescript
   import { ValidationPipe } from '@nestjs/common';
   
   app.useGlobalPipes(
     new ValidationPipe({
       whitelist: true,
       transform: true,
       forbidNonWhitelisted: true,
       transformOptions: { enableImplicitConversion: true },
     }),
   );
   ```
3. Berikan decorator pada DTO:
   ```typescript
   import { IsString, IsNumber, IsOptional, IsDateString, Min, Max } from 'class-validator';

   export class CreateDetectionDto {
     @IsString()
     deviceId: string;

     @IsOptional()
     @IsString()
     userId?: string;

     @IsNumber()
     @Min(-90)
     @Max(90)
     latitude: number;

     @IsNumber()
     @Min(-180)
     @Max(180)
     longitude: number;

     @IsNumber()
     @Min(0)
     @Max(1)
     confidence: number;

     @IsOptional()
     @IsNumber()
     speedKmh?: number;

     @IsOptional()
     @IsNumber()
     zAccelPeak?: number;

     @IsOptional()
     @IsString()
     modelVersion?: string;

     @IsDateString()
     detectedAt: string;
   }
   ```

---

### [BUG-02] Potensi Unhandled Crash SQL pada Endpoint `/nearby` (High)

#### Lokasi File:
- [`apps/server/src/pothole-clusters/pothole-clusters.controller.ts:46-57`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/server/src/pothole-clusters/pothole-clusters.controller.ts#L46-L57)
- [`apps/server/src/pothole-clusters/pothole-clusters.service.ts:86-118`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/server/src/pothole-clusters/pothole-clusters.service.ts#L86-L118)

#### Deskripsi Masalah:
Pada controller:
```typescript
@Get('nearby')
async findNearby(
  @Query('lat') lat: string,
  @Query('lon') lon: string,
  @Query('radius') radius?: string,
) {
  return this.clustersService.findNearby(
    parseFloat(lat),
    parseFloat(lon),
    radius ? parseFloat(radius) : 15,
  );
}
```
Jika client memanggil `/api/pothole-clusters/nearby` tanpa query parameter `lat` atau `lon`, `parseFloat(lat)` akan menghasilkan nilai `NaN`.
Nilai `NaN` ini langsung dioper ke query PostGIS:
`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography`
PostgreSQL akan menolak query ini dan melemparkan database exception yang mengakibatkan status `500 Internal Server Error`.

#### Rekomendasi Perbaikan:
Tambahkan validasi di controller:
```typescript
import { BadRequestException } from '@nestjs/common';

@Get('nearby')
async findNearby(
  @Query('lat') lat?: string,
  @Query('lon') lon?: string,
  @Query('radius') radius?: string,
) {
  if (!lat || !lon) {
    throw new BadRequestException('Parameter lat dan lon wajib disertakan.');
  }
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  if (isNaN(latitude) || isNaN(longitude)) {
    throw new BadRequestException('Parameter lat dan lon harus berupa angka valid.');
  }

  return this.clustersService.findNearby(
    latitude,
    longitude,
    radius ? parseFloat(radius) : 15,
  );
}
```

---

### [BUG-03] Kolom PostGIS Geometry Selalu `NULL` & Spatial Index Mati (High)

#### Lokasi File:
- [`apps/server/prisma/schema.prisma:93,116`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/server/prisma/schema.prisma#L93)
- [`apps/server/src/detection/detection.service.ts:21-33`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/server/src/detection/detection.service.ts#L21-L33)
- [`apps/server/src/pothole-clusters/pothole-clusters.service.ts:43-51,285-288`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/server/src/pothole-clusters/pothole-clusters.service.ts#L285-L288)

#### Deskripsi Masalah:
1. Di skema database, tabel `detections` memiliki kolom `location` bertipe `geometry(Point, 4326)`, dan `pothole_clusters` memiliki `center_location` dengan indeks GiST (`idx_potholes_location`).
2. Namun pada saat insert data di `DetectionService`:
   ```typescript
   await this.db.detection.create({
     data: {
       deviceId: dto.deviceId,
       latitude: dto.latitude,
       longitude: dto.longitude,
       // Kolom location TIDAK diisi!
     }
   });
   ```
3. Begitu pula pada `PotholeClustersService.aggregateDetection`:
   ```sql
   INSERT INTO pothole_clusters (center_latitude, center_longitude, ...)
   VALUES (${detection.latitude}, ${detection.longitude}, ...)
   -- Kolom center_location TIDAK diisi!
   ```
4. Akibatnya, seluruh kolom geometry bernilai `NULL`. Indeks GiST tidak pernah terpakai.
5. Inilah alasan mengapa di fungsi `getByBoundingBox`, developer terpaksa menambahkan klausa `OR (center_longitude >= ...)` menggunakan perbandingan float biasa yang lambat ketika data berjumlah puluhan ribu.

#### Rekomendasi Perbaikan:
Pilihan A (Migrasi PostgreSQL Generated Column - Direkomendasikan):
Ubah migrasi PostgreSQL agar kolom terisi otomatis oleh database:
```sql
ALTER TABLE "pothole_clusters" 
  DROP COLUMN "center_location",
  ADD COLUMN "center_location" geometry(Point, 4326) 
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(center_longitude, center_latitude), 4326)) STORED;
```
Pilihan B (Isi manual di SQL INSERT):
```sql
INSERT INTO pothole_clusters (
  center_latitude,
  center_longitude,
  center_location,
  ...
) VALUES (
  ${detection.latitude},
  ${detection.longitude},
  ST_SetSRID(ST_MakePoint(${detection.longitude}, ${detection.latitude}), 4326),
  ...
)
```

---

### [BUG-04] Endpoint Mutasi Data Tidak Terlindungi Auth Guard (High)

#### Lokasi File:
- [`apps/server/src/pothole-clusters/pothole-clusters.controller.ts:68-103`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/server/src/pothole-clusters/pothole-clusters.controller.ts#L68-L103)
- [`apps/server/src/detection/detection.controller.ts:56-76`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/server/src/detection/detection.controller.ts#L56-L76)

#### Deskripsi Masalah:
Proyek telah mengonfigurasi Better-Auth secara lengkap, namun controller tidak menggunakan guard atau decorator keamanan apa pun.
Setiap orang dapat melakukan:
- `DELETE /api/pothole-clusters/:id` (Menghapus klaster)
- `PATCH /api/pothole-clusters/:id/status` (Mengubah status verifikasi PU)
- `DELETE /api/detections/:id` (Menghapus log deteksi)
tanpa mengirimkan token autentikasi atau cookie sama sekali.

#### Rekomendasi Perbaikan:
Gunakan guard dari package `@thallesp/nestjs-better-auth`:
```typescript
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { UseGuards } from '@nestjs/common';

@Patch(':id/status')
@UseGuards(AuthGuard)
async updateStatus(@Param('id') id: string, @Body() dto: UpdateClusterStatusDto) {
  return this.clustersService.updateStatus(id, dto);
}

@Delete(':id')
@UseGuards(AuthGuard)
async delete(@Param('id') id: string) {
  return this.clustersService.delete(id);
}
```

---

### [BUG-05] Kesalahan Logika pada Callback CORS (Medium)

#### Lokasi File:
- [`apps/server/src/main.ts:17-28`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/server/src/main.ts#L17-L28)

#### Deskripsi Masalah:
Perhatikan blok berikut:
```typescript
app.enableCors({
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    // Allow requests with no origin (like mobile apps, Expo native, or curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // <--- LOGIKA KELIRU
    }
  },
  credentials: true,
  // ...
});
```
Pada blok `else`, callback tetap mengeksekusi `callback(null, true)`. Ini membuat whitelisting sama sekali tidak berfungsi dan seluruh origin luar yang tidak diizinkan tetap lolos.

#### Rekomendasi Perbaikan:
```typescript
if (!origin || allowedOrigins.includes(origin)) {
  callback(null, true);
} else {
  if (process.env.NODE_ENV === 'production') {
    callback(new Error('Origin tidak diizinkan oleh kebijakan CORS'));
  } else {
    callback(null, true);
  }
}
```

---

### [BUG-06] Inkonsistensi Naming Convention Respon API (Medium)

#### Lokasi File:
- `apps/server/src/detection/detection.service.ts` (Model Prisma)
- `apps/server/src/pothole-clusters/pothole-clusters.service.ts` (Raw SQL)

#### Deskripsi Masalah:
- Endpoint di `/api/detections` mengembalikan properti **camelCase**:
  `deviceId`, `speedKmh`, `zAccelPeak`, `modelVersion`, `detectedAt`, `createdAt`.
- Endpoint di `/api/pothole-clusters` mengembalikan properti **snake_case**:
  `center_latitude`, `center_longitude`, `confidence_avg`, `detection_count`, `first_detected_at`, `last_detected_at`, `updated_at`.
- Hal ini menyebabkan pengembang aplikasi mobile Expo atau frontend harus mengingat dan menangani dua gaya konvensi penamaan yang berbeda dalam satu sistem.

#### Rekomendasi Perbaikan:
Pada `apps/server/src/pothole-clusters/pothole-clusters.service.ts`, gunakan alias SQL agar konsisten menghasilkan camelCase:
```sql
SELECT
  id,
  center_latitude AS "centerLatitude",
  center_longitude AS "centerLongitude",
  severity,
  confidence_avg AS "confidenceAvg",
  detection_count AS "detectionCount",
  status,
  first_detected_at AS "firstDetectedAt",
  last_detected_at AS "lastDetectedAt",
  updated_at AS "updatedAt"
FROM pothole_clusters
...
```

---

### [BUG-07] Masalah N+1 Sequential Writes pada `createBatch` (Medium)

#### Lokasi File:
- [`apps/server/src/detection/detection.service.ts:68-75`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/server/src/detection/detection.service.ts#L68-L75)

#### Deskripsi Masalah:
```typescript
for (const item of dto.detections) {
  await this.clustersService.aggregateDetection({
    latitude: item.latitude,
    longitude: item.longitude,
    confidence: item.confidence,
    detectedAt: new Date(item.detectedAt),
  });
}
```
Setiap 1 panggilan `aggregateDetection` melakukan minimal 2 query database (1 `findNearby` + 1 `UPDATE`/`INSERT`).
Jika aplikasi mobile mengunggah batch berisi 100 titik hasil rekaman offline, server akan mengeksekusi 200 query database secara berurutan (*sequential*), yang dapat menyebabkan latency request meningkat drastis hingga beberapa detik.

#### Rekomendasi Perbaikan:
1. Untuk skala menengah: Gunakan `Promise.all` secara terkontrol (*chunked concurrent execution*).
2. Untuk arsitektur produksi: Buat background job / queue (misal: BullMQ atau Redis) agar request HTTP `POST /api/detections/batch` langsung merespons setelah `createMany`, sementara klasterisasi dikerjakan di background worker.

---

### [BUG-08] Parameter `search` Tidak Digunakan pada `getByBoundingBox` (Medium)

#### Lokasi File:
- [`apps/server/src/pothole-clusters/pothole-clusters.service.ts:18,61-80`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/server/src/pothole-clusters/pothole-clusters.service.ts#L18)

#### Deskripsi Masalah:
Method `getByBoundingBox` menerima filter:
`filter: Partial<BoundingBoxFilterDto> & { search?: string; severity?: string; }`
Namun variabel `search` sama sekali tidak pernah diikutsertakan ke dalam klausa SQL. Pada frontend `apps/app/src/app/dashboard/data/page.tsx:163-173`, developer terpaksa melakukan pencarian secara client-side setelah memuat semua data.

#### Rekomendasi Perbaikan:
Tambahkan klausa `search` ke dalam query SQL:
```typescript
const searchClause = search
  ? Prisma.sql`AND (id::text ILIKE ${'%' + search + '%'})`
  : Prisma.empty;
```

---

### [BUG-09] Hardcoded IP Development di `auth.ts` (Low)

#### Lokasi File:
- [`apps/server/src/auth.ts:52-53`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/server/src/auth.ts#L52-L53)

#### Deskripsi Masalah:
Terdapat alamat IP hardcoded pengembang:
```typescript
'exp://10.85.76.210:8081',
'hypergrid://10.85.76.210:8081',
```
Jika AI Agent atau anggota tim lain menjalankan aplikasi di jaringan LAN WiFi lain, domain Expo Go tersebut tidak akan cocok dan dapat menimbulkan isu CORS / Origin Verification pada Better-Auth.

#### Rekomendasi Perbaikan:
Gunakan regex atau wildcard pattern yang sudah didukung oleh konfigurasi Better-Auth (`'exp://**'`, `'hypergrid://**'`) dan hapus baris IP statis tersebut.

---

### [BUG-10] Penulisan Notasi LaTeX Mentah pada Komponen Web (Low)

#### Lokasi File:
- [`apps/app/src/app/dashboard/data/page.tsx:499`](file:///home/nacktdiv/Project/kaffie/hg-server/apps/app/src/app/dashboard/data/page.tsx#L499)

#### Deskripsi Masalah:
Teks di render dengan:
`Log titik rekaman akselerometer $Z$-axis, kecepatan kendaraan...`
Karena halaman ini adalah teks biasa HTML dan bukan compiler KaTeX, karakter `$Z$-axis` muncul secara harfiah dengan simbol dolar di layar antarmuka pengguna web.

#### Rekomendasi Perbaikan:
Ganti `$Z$-axis` menjadi `sumbu Z` atau `Z-axis`.

---

## 3. Rencana Eksekusi Sistematis untuk AI Agent Berikutnya

Bagi AI Agent yang akan ditugaskan memperbaiki masalah di atas, ikuti langkah-langkah kerja berurutan berikut ini:

1. **Tahap 1: Validasi Dependensi & DTO**
   - Install `class-validator` & `class-transformer` di `apps/server`.
   - Update `main.ts` dengan global `ValidationPipe`.
   - Tambahkan decorator validasi pada semua DTO di `apps/server/src/detection/dto` dan `apps/server/src/pothole-clusters/dto`.
   - Jalankan `pnpm --filter server test` untuk memastikan tidak ada unit test yang patah.

2. **Tahap 2: Patching Controller & Keamanan**
   - Tambahkan proteksi parameter `lat` & `lon` pada endpoint `findNearby`.
   - Pasang `@UseGuards(AuthGuard)` pada method `DELETE` dan `PATCH` di `PotholeClustersController` dan `DetectionController`.
   - Perbaiki callback CORS di `main.ts`.

3. **Tahap 3: Optimasi Database Spasial PostGIS**
   - Perbaiki query `INSERT INTO pothole_clusters` agar mengisi kolom `center_location` dengan fungsi `ST_SetSRID(ST_MakePoint(...), 4326)`.
   - Lakukan hal serupa pada tabel `detections`.

4. **Tahap 4: Verifikasi & Test Regression**
   - Jalankan `pnpm turbo run check-types`
   - Jalankan `pnpm turbo run lint`
   - Jalankan `pnpm --filter server test:e2e` (jika database testing aktif).
