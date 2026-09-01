-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "pothole_severity" AS ENUM ('low', 'medium', 'high', 'severe');

-- CreateEnum
CREATE TYPE "pothole_status" AS ENUM ('active', 'verified', 'repaired', 'false_positive');

-- CreateTable
CREATE TABLE "detections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" VARCHAR(100) NOT NULL,
    "user_id" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "location" geometry(Point, 4326),
    "confidence" DOUBLE PRECISION NOT NULL,
    "speed_kmh" DOUBLE PRECISION,
    "z_accel_peak" DOUBLE PRECISION,
    "model_version" VARCHAR(20) NOT NULL DEFAULT 'v1',
    "detected_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pothole_clusters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "center_latitude" DOUBLE PRECISION NOT NULL,
    "center_longitude" DOUBLE PRECISION NOT NULL,
    "center_location" geometry(Point, 4326),
    "severity" "pothole_severity" NOT NULL DEFAULT 'medium',
    "confidence_avg" DOUBLE PRECISION NOT NULL,
    "detection_count" INTEGER DEFAULT 1,
    "status" "pothole_status" NOT NULL DEFAULT 'active',
    "first_detected_at" TIMESTAMPTZ NOT NULL,
    "last_detected_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pothole_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_detections_device_time" ON "detections"("device_id", "detected_at");

-- CreateIndex
CREATE INDEX "idx_detections_location" ON "detections" USING GIST ("location");

-- CreateIndex
CREATE INDEX "idx_potholes_location" ON "pothole_clusters" USING GIST ("center_location");

-- CreateIndex
CREATE INDEX "idx_potholes_status" ON "pothole_clusters"("status");
