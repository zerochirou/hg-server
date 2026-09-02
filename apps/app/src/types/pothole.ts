export type PotholeSeverity = 'low' | 'medium' | 'high' | 'severe';
export type PotholeStatus = 'active' | 'verified' | 'repaired' | 'false_positive';

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

export interface BoundingBox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}
