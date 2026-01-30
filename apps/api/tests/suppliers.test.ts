import { beforeAll, afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '../src/app.js';

const prisma = new PrismaClient();
const TEST_USER_ID = 'test-suppliers-user';

describe('Suppliers API', () => {
  beforeAll(async () => {
    await prisma.user.upsert({
      where: { email: 'suppliers-test@bom.dev' },
      update: { id: TEST_USER_ID },
      create: {
        id: TEST_USER_ID,
        email: 'suppliers-test@bom.dev',
        name: 'Suppliers Test User',
        emailVerified: true
      }
    });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: TEST_USER_ID } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.supplier.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  describe('POST /api/v1/suppliers', () => {
    it('creates a supplier successfully', async () => {
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Sysco Foods',
          contactName: 'John Smith',
          phone: '555-123-4567',
          email: 'john@sysco.com',
          preferredOrderMethod: 'email',
          deliveryDays: ['monday', 'wednesday', 'friday']
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Sysco Foods');
      expect(res.body.contactName).toBe('John Smith');
      expect(res.body.deliveryDays).toEqual(['monday', 'wednesday', 'friday']);
    });

    it('creates a supplier with minimal data', async () => {
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('X-User-Id', TEST_USER_ID)
        .send({ name: 'Simple Supplier' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Simple Supplier');
    });

    it('returns 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('X-User-Id', TEST_USER_ID)
        .send({ contactName: 'John' });

      expect(res.status).toBe(400);
    });

    it('returns 409 for duplicate name', async () => {
      await request(app)
        .post('/api/v1/suppliers')
        .set('X-User-Id', TEST_USER_ID)
        .send({ name: 'Duplicate Supplier' });

      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('X-User-Id', TEST_USER_ID)
        .send({ name: 'Duplicate Supplier' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('returns 401 without X-User-Id', async () => {
      const res = await request(app)
        .post('/api/v1/suppliers')
        .send({ name: 'No Auth' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/suppliers', () => {
    beforeEach(async () => {
      await prisma.supplier.createMany({
        data: [
          { userId: TEST_USER_ID, name: 'Alpha Supplier' },
          { userId: TEST_USER_ID, name: 'Beta Supplier' },
          { userId: TEST_USER_ID, name: 'Gamma Supplier' }
        ]
      });
    });

    it('returns paginated list', async () => {
      const res = await request(app)
        .get('/api/v1/suppliers')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(3);
      expect(res.body.total).toBe(3);
      expect(res.body.items[0].name).toBe('Alpha Supplier'); // sorted by name
    });

    it('supports pagination', async () => {
      const res = await request(app)
        .get('/api/v1/suppliers?offset=1&limit=1')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].name).toBe('Beta Supplier');
      expect(res.body.total).toBe(3);
    });

    it('filters by search', async () => {
      const res = await request(app)
        .get('/api/v1/suppliers?search=alpha')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].name).toBe('Alpha Supplier');
    });
  });

  describe('GET /api/v1/suppliers/:id', () => {
    it('returns supplier by ID', async () => {
      const created = await prisma.supplier.create({
        data: { userId: TEST_USER_ID, name: 'Get Test Supplier' }
      });

      const res = await request(app)
        .get(`/api/v1/suppliers/${created.id}`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.id);
      expect(res.body.name).toBe('Get Test Supplier');
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app)
        .get('/api/v1/suppliers/99999')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/suppliers/:id', () => {
    it('updates supplier partially', async () => {
      const created = await prisma.supplier.create({
        data: { userId: TEST_USER_ID, name: 'Update Test', phone: '111-111-1111' }
      });

      const res = await request(app)
        .patch(`/api/v1/suppliers/${created.id}`)
        .set('X-User-Id', TEST_USER_ID)
        .send({ phone: '222-222-2222', notes: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.phone).toBe('222-222-2222');
      expect(res.body.notes).toBe('Updated');
      expect(res.body.name).toBe('Update Test'); // unchanged
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app)
        .patch('/api/v1/suppliers/99999')
        .set('X-User-Id', TEST_USER_ID)
        .send({ phone: '333-333-3333' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/suppliers/:id', () => {
    it('deletes supplier successfully', async () => {
      const created = await prisma.supplier.create({
        data: { userId: TEST_USER_ID, name: 'Delete Test' }
      });

      const res = await request(app)
        .delete(`/api/v1/suppliers/${created.id}`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(204);

      const found = await prisma.supplier.findUnique({ where: { id: created.id } });
      expect(found).toBeNull();
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app)
        .delete('/api/v1/suppliers/99999')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(404);
    });
  });
});
