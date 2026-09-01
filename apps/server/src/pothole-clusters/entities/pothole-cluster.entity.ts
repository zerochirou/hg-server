export interface PotholeClusterEntity {
  id: string;
  center_latitude: number;
  center_longitude: number;
  severity: string;
  confidence_avg: number;
  detection_count: number;
  status: string;
  first_detected_at: Date;
  last_detected_at: Date;
  updated_at: Date;
  distance_meters?: number;
}
