export class CreateDetectionDto {
  deviceId: string;
  userId?: string;
  latitude: number;
  longitude: number;
  confidence: number;
  speedKmh?: number;
  zAccelPeak?: number;
  modelVersion?: string;
  detectedAt: string | Date;
}
