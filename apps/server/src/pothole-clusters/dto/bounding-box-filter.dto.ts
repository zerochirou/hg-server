export class BoundingBoxFilterDto {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
  status?: string;
  severity?: string;
  limit?: number = 500;
}
