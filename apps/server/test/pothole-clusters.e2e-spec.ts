import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

interface ClusterResponse {
  id: string;
  center_latitude: number;
  center_longitude: number;
  severity: string;
  confidence_avg: number;
  detection_count: number;
  status: string;
  distance_meters?: number;
}

describe('PotholeClusters (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('/api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  let createdClusterId: string;
  const testLat = -6.2088;
  const testLon = 106.8456;

  beforeAll(async () => {
    // Seed detection to trigger cluster creation
    await request(app.getHttpServer()).post('/api/detections').send({
      deviceId: 'e2e-cluster-device',
      latitude: testLat,
      longitude: testLon,
      confidence: 0.9,
      detectedAt: new Date().toISOString(),
    });
  });

  describe('GET /api/pothole-clusters', () => {
    it('should query clusters in bounding box', async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/api/pothole-clusters?minLat=-6.22&minLon=106.83&maxLat=-6.20&maxLon=106.86&status=active`,
        )
        .expect(200);

      const body = response.body as ClusterResponse[];
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);

      createdClusterId = body[0].id;
      expect(body[0].center_latitude).toBeDefined();
      expect(body[0].center_longitude).toBeDefined();
    });
  });

  describe('GET /api/pothole-clusters/nearby', () => {
    it('should find nearby pothole within radius', async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/api/pothole-clusters/nearby?lat=${testLat}&lon=${testLon}&radius=50`,
        )
        .expect(200);

      const body = response.body as ClusterResponse;
      expect(body).toBeDefined();
      expect(body.id).toBeDefined();
      expect(body.distance_meters).toBeLessThanOrEqual(50);
    });
  });

  describe('GET /api/pothole-clusters/:id', () => {
    it('should return cluster detail by id', async () => {
      if (!createdClusterId) return;

      const response = await request(app.getHttpServer())
        .get(`/api/pothole-clusters/${createdClusterId}`)
        .expect(200);

      const body = response.body as ClusterResponse;
      expect(body).toBeDefined();
      expect(body.id).toBe(createdClusterId);
    });

    it('should return 404 for non-existent cluster id', async () => {
      await request(app.getHttpServer())
        .get('/api/pothole-clusters/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PATCH /api/pothole-clusters/:id/status', () => {
    it('should update cluster status and severity', async () => {
      if (!createdClusterId) return;

      const response = await request(app.getHttpServer())
        .patch(`/api/pothole-clusters/${createdClusterId}/status`)
        .send({
          status: 'verified',
          severity: 'high',
        })
        .expect(200);

      const body = response.body as ClusterResponse;
      expect(body.status).toBe('verified');
      expect(body.severity).toBe('high');
    });
  });
});
