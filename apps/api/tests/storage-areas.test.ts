import { beforeAll, afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '../src/app.js';

const prisma = new PrismaClient();
const TEST_USER_ID = 'test-storage-areas-user';

describe('Storage Areas API', () => {
  beforeAll(async () => {
    await prisma.user.upsert({
      where: { email: 'storage-test@bom.dev' },
      update: { id: TEST_USER_ID },
      create: {
        id: TEST_USER_ID,
        email: 'storage-test@bom.dev',
        name: 'Storage Test User',
        emailVerified: true
      }
    });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: TEST_USER_ID } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.storageArea.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  describe('POST /api/v1/storage-areas', () => {
    it('creates a storage area successfully', async () => {
      const res = await request(app)
        .post('/api/v1/storage-areas')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Walk-in Cooler',
          location: 'Back of kitchen',
          temperatureZone: 'cold',
          notes: 'Main refrigeration unit'
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Walk-in Cooler');
      expect(res.body.temperatureZone).toBe('cold');
      expect(res.body.location).toBe('Back of kitchen');
    });

    it('creates with minimal data', async () => {
      const res = await request(app)
        .post('/api/v1/storage-areas')
        .set('X-User-Id', TEST_USER_ID)
        .send({ name: 'Dry Storage' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Dry Storage');
    });

    it('validates temperature zone enum', async () => {
      const res = await request(app)
        .post('/api/v1/storage-areas')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Invalid Zone',
          temperatureZone: 'hot' // not in enum
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/v1/storage-areas')
        .set('X-User-Id', TEST_USER_ID)
        .send({ location: 'Somewhere' });

      expect(res.status).toBe(400);
    });

    it('returns 409 for duplicate name', async () => {
      await request(app)
        .post('/api/v1/storage-areas')
        .set('X-User-Id', TEST_USER_ID)
        .send({ name: 'Duplicate Area' });

      const res = await request(app)
        .post('/api/v1/storage-areas')
        .set('X-User-Id', TEST_USER_ID)
        .send({ name: 'Duplicate Area' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('returns 401 without X-User-Id', async () => {
      const res = await request(app)
        .post('/api/v1/storage-areas')
        .send({ name: 'No Auth' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/storage-areas', () => {
    beforeEach(async () => {
      await prisma.storageArea.createMany({
        data: [
          { userId: TEST_USER_ID, name: 'Cooler', temperatureZone: 'cold' },
          { userId: TEST_USER_ID, name: 'Freezer', temperatureZone: 'frozen' },
          { userId: TEST_USER_ID, name: 'Pantry', temperatureZone: 'dry' }
        ]
      });
    });

    it('returns paginated list', async () => {
      const res = await request(app)
        .get('/api/v1/storage-areas')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(3);
      expect(res.body.total).toBe(3);
      expect(res.body.items[0].name).toBe('Cooler'); // sorted by name
    });

    it('supports pagination', async () => {
      const res = await request(app)
        .get('/api/v1/storage-areas?offset=1&limit=1')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].name).toBe('Freezer');
      expect(res.body.total).toBe(3);
    });

    it('filters by search', async () => {
      const res = await request(app)
        .get('/api/v1/storage-areas?search=freez')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].name).toBe('Freezer');
    });
  });

  describe('GET /api/v1/storage-areas/:id', () => {
    it('returns storage area by ID', async () => {
      const created = await prisma.storageArea.create({
        data: { userId: TEST_USER_ID, name: 'Get Test Area', temperatureZone: 'ambient' }
      });

      const res = await request(app)
        .get(`/api/v1/storage-areas/${created.id}`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.id);
      expect(res.body.name).toBe('Get Test Area');
      expect(res.body.temperatureZone).toBe('ambient');
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app)
        .get('/api/v1/storage-areas/99999')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/storage-areas/:id', () => {
    it('updates storage area partially', async () => {
      const created = await prisma.storageArea.create({
        data: { userId: TEST_USER_ID, name: 'Update Test', temperatureZone: 'cold' }
      });

      const res = await request(app)
        .patch(`/api/v1/storage-areas/${created.id}`)
        .set('X-User-Id', TEST_USER_ID)
        .send({ temperatureZone: 'frozen', notes: 'Changed to freezer' });

      expect(res.status).toBe(200);
      expect(res.body.temperatureZone).toBe('frozen');
      expect(res.body.notes).toBe('Changed to freezer');
      expect(res.body.name).toBe('Update Test'); // unchanged
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app)
        .patch('/api/v1/storage-areas/99999')
        .set('X-User-Id', TEST_USER_ID)
        .send({ notes: 'test' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/storage-areas/:id', () => {
    it('deletes storage area successfully', async () => {
      const created = await prisma.storageArea.create({
        data: { userId: TEST_USER_ID, name: 'Delete Test' }
      });

      const res = await request(app)
        .delete(`/api/v1/storage-areas/${created.id}`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(204);

      const found = await prisma.storageArea.findUnique({ where: { id: created.id } });
      expect(found).toBeNull();
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app)
        .delete('/api/v1/storage-areas/99999')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(404);
    });
  });
});
