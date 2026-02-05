const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const TEST_DB_PATH = path.join(
  os.tmpdir(),
  `sg-test-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
);

process.env.SQLITE_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';
process.env.ENABLE_FACTORY_RESET = 'true';
process.env.DEMO_DAYS = process.env.DEMO_DAYS || '30';
process.env.DEFAULT_NETWORK_POLICY = process.env.DEFAULT_NETWORK_POLICY || 'off';
process.env.CORS_ALLOW_NULL = 'true';

const { run } = require('../scripts/migrate');
const { query, pool } = require('../db/pg');
const app = require('../index');

async function applySeed() {
  const seedPath = path.resolve(__dirname, '../../database/seed.sql');
  const sql = fs.readFileSync(seedPath, 'utf8');
  await query(sql);
}

beforeAll(async () => {
  await run();
  await applySeed();
});

afterAll(async () => {
  await pool.end();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

test('setup/login/logout/blacklist + reset gated', async () => {
  const admin = { nombre: 'Admin', email: 'admin@test.com', password: 'Secret123' };

  const status1 = await request(app).get('/api/setup/status');
  expect(status1.status).toBe(200);
  expect(status1.body.requiresSetup).toBe(true);

  const create = await request(app).post('/api/setup/admin').send(admin);
  expect(create.status).toBe(201);

  const login1 = await request(app).post('/api/login').send({
    email: admin.email,
    password: admin.password,
  });
  expect(login1.status).toBe(200);
  expect(login1.body.accessToken).toBeTruthy();
  expect(login1.body.refreshToken).toBeTruthy();

  const access1 = login1.body.accessToken;
  const refresh1 = login1.body.refreshToken;

  const rolesOk = await request(app)
    .get('/api/roles')
    .set('Authorization', `Bearer ${access1}`);
  expect(rolesOk.status).toBe(200);

  const logout = await request(app)
    .post('/api/logout')
    .set('Authorization', `Bearer ${access1}`)
    .send({ refreshToken: refresh1 });
  expect(logout.status).toBe(200);

  const rolesDenied = await request(app)
    .get('/api/roles')
    .set('Authorization', `Bearer ${access1}`);
  expect(rolesDenied.status).toBe(401);

  const login2 = await request(app).post('/api/login').send({
    email: admin.email,
    password: admin.password,
  });
  expect(login2.status).toBe(200);
  const access2 = login2.body.accessToken;

  const resetNoAuth = await request(app).post('/api/setup/reset-database');
  expect(resetNoAuth.status).toBe(401);

  const resetAuth = await request(app)
    .post('/api/setup/reset-database')
    .set('Authorization', `Bearer ${access2}`);
  expect(resetAuth.status).toBe(200);

  const status2 = await request(app).get('/api/setup/status');
  expect(status2.status).toBe(200);
  expect(status2.body.requiresSetup).toBe(true);
});
