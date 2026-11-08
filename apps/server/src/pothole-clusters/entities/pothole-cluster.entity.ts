export const CLUSTER_SEVERITIES = ['low', 'medium', 'high', 'severe'] as const;
export type ClusterSeverity = (typeof CLUSTER_SEVERITIES)[number];

/**
 * Helper parsing & type assertion aman saat membaca field `severity`
 * dari respons query SQL raw atau Prisma agar tidak menimbulkan error tipe data string.
 */
export function parseClusterSeverity(
  val: unknown,
  fallback: ClusterSeverity = 'low',
): ClusterSeverity {
  if (typeof val !== 'string') return fallback;
  const normalized = val.trim().toLowerCase();
  switch (normalized) {
    case 'severe':
    case 'heavy':
      return 'severe';
    case 'high':
      return 'high';
    case 'medium':
    case 'moderate':
      return 'medium';
    case 'low':
    case 'light':
      return 'low';
    default:
      return fallback;
  }
}

export interface PotholeClusterEntity {
  id: string;
  center_latitude: number;
  center_longitude: number;
  severity: ClusterSeverity;
  confidence_avg: number;
  detection_count: number;
  status: string;
  first_detected_at: Date;
  last_detected_at: Date;
  updated_at: Date;
  distance_meters?: number;
}
