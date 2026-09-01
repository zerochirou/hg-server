export class UpdateClusterStatusDto {
  status: 'active' | 'verified' | 'repaired' | 'false_positive';
  severity?: 'low' | 'medium' | 'high' | 'severe';
}
