import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

interface DetectionResponse {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  confidence: number;
  speedKmh?: number | null;
  zAccelPeak?: number | null;
  modelVersion: string;
  detectedAt: string;
}

describe('Detections (e2e)', () => {
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

  const testDeviceId = 'e2e-test-device-' + Date.now();

  describe('POST /api/detections', () => {
    it('should insert a single detection and return 201', async () => {
      const payload = {
        deviceId: testDeviceId,
        latitude: -6.2088,
        longitude: 106.8456,
        confidence: 0.95,
        speedKmh: 45.0,
        zAccelPeak: 3.8,
        modelVersion: 'v1.0',
        detectedAt: new Date().toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/api/detections')
        .send(payload)
        .expect(201);

      const body = response.body as DetectionResponse;
      expect(body).toBeDefined();
      expect(body.id).toBeDefined();
      expect(body.deviceId).toBe(testDeviceId);
      expect(body.latitude).toBe(-6.2088);
      expect(body.longitude).toBe(106.8456);
    });
  });

  describe('POST /api/detections/batch', () => {
    it('should insert multiple detections and return count', async () => {
      const payload = {
        detections: [
          {
            deviceId: testDeviceId,
            latitude: -6.209,
            longitude: 106.846,
            confidence: 0.88,
            speedKmh: 40.0,
            zAccelPeak: 4.1,
            modelVersion: 'v1.0',
            detectedAt: new Date().toISOString(),
          },
          {
            deviceId: testDeviceId,
            latitude: -6.2095,
            longitude: 106.8465,
            confidence: 0.92,
            speedKmh: 38.5,
            zAccelPeak: 3.6,
            modelVersion: 'v1.0',
            detectedAt: new Date().toISOString(),
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/detections/batch')
        .send(payload)
        .expect(201);

      expect(response.body).toEqual({ count: 2 });
    });
  });

  describe('GET /api/detections/device/:deviceId', () => {
    it('should retrieve detections by deviceId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/detections/device/${testDeviceId}`)
        .expect(200);

      const body = response.body as DetectionResponse[];
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(3);
      expect(body[0]?.deviceId).toBe(testDeviceId);
    });
  });
});
