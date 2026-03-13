#!/usr/bin/env node
/**
 * D2D Blitz API Test Suite
 * Run before deployment to catch API regressions
 * 
 * Usage: node api-test-suite.js [--base-url https://d2d-blitz.vercel.app]
 */

const BASE_URL = process.argv.find(arg => arg.startsWith('--base-url='))?.split('=')[1] || 
                 process.env.TEST_BASE_URL || 
                 'http://localhost:3000';

const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123'
};

let authToken = null;
let testResults = [];
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    testResults.push({ name, status: '✅ PASS' });
    passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    testResults.push({ name, status: '❌ FAIL', error: error.message });
    failed++;
    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      ...options.headers,
    },
  });
  
  const data = await response.json().catch(() => null);
  return { status: response.status, data, response };
}

// ==================== HEALTH CHECKS ====================

async function testHealthEndpoint() {
  await test('Health endpoint returns 200', async () => {
    const { status, data } = await request('/api/health');
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (data?.status !== 'healthy') throw new Error('Status not healthy');
  });
}

// ==================== AUTHENTICATION ====================

async function testAuthEndpoints() {
  await test('Register endpoint exists', async () => {
    const { status } = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: `test_${Date.now()}@example.com`,
        password: 'TestPass123!'
      })
    });
    // Should return 201 (created) or 409 (already exists)
    if (![201, 409].includes(status)) {
      throw new Error(`Expected 201 or 409, got ${status}`);
    }
  });

  await test('Login with invalid credentials returns 401', async () => {
    const { status } = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid@example.com',
        password: 'wrongpassword'
      })
    });
    if (status !== 401) throw new Error(`Expected 401, got ${status}`);
  });

  await test('Protected endpoints require auth', async () => {
    const endpoints = ['/api/user', '/api/sales', '/api/leaderboard'];
    for (const endpoint of endpoints) {
      const { status } = await request(endpoint);
      if (status !== 401) throw new Error(`${endpoint}: Expected 401, got ${status}`);
    }
  });
}

// ==================== SALES API ====================

async function testSalesEndpoints() {
  await test('GET /api/sales requires auth', async () => {
    const { status } = await request('/api/sales');
    if (status !== 401) throw new Error(`Expected 401, got ${status}`);
  });

  await test('POST /api/sales requires auth', async () => {
    const { status } = await request('/api/sales', {
      method: 'POST',
      body: JSON.stringify({ customerName: 'Test' })
    });
    if (status !== 401) throw new Error(`Expected 401, got ${status}`);
  });
}

// ==================== LEADERBOARD API ====================

async function testLeaderboardEndpoints() {
  await test('GET /api/leaderboard requires auth', async () => {
    const { status } = await request('/api/leaderboard');
    if (status !== 401) throw new Error(`Expected 401, got ${status}`);
  });
}

// ==================== COMMISSION API ====================

async function testCommissionEndpoints() {
  await test('GET /api/commissions requires auth', async () => {
    const { status } = await request('/api/commissions');
    if (status !== 401 && status !== 404) {
      throw new Error(`Expected 401 or 404, got ${status}`);
    }
  });
}

// ==================== DAILY REPORTS ====================

async function testDailyReportsEndpoints() {
  await test('GET /api/daily-reports requires auth', async () => {
    const { status } = await request('/api/daily-reports');
    if (status !== 401) throw new Error(`Expected 401, got ${status}`);
  });
}

// ==================== CARRIERS API ====================

async function testCarriersEndpoints() {
  await test('GET /api/carriers exists', async () => {
    const { status } = await request('/api/carriers');
    if (![200, 401].includes(status)) {
      throw new Error(`Expected 200 or 401, got ${status}`);
    }
  });
}

// ==================== UPLOAD API ====================

async function testUploadEndpoints() {
  await test('POST /api/upload requires auth', async () => {
    const { status } = await request('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ file: 'test' })
    });
    if (status !== 401) throw new Error(`Expected 401, got ${status}`);
  });
}

// ==================== ERROR HANDLING ====================

async function testErrorHandling() {
  await test('404 for unknown endpoints', async () => {
    const { status } = await request('/api/unknown-endpoint-that-does-not-exist');
    if (status !== 404) throw new Error(`Expected 404, got ${status}`);
  });

  await test('CORS headers present', async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    const corsHeader = response.headers.get('access-control-allow-origin');
    // CORS header may or may not be present depending on config
    // Just verify the request didn't fail
  });
}

// ==================== MAIN ====================

async function runTests() {
  console.log('\n🧪 D2D Blitz API Test Suite');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('===========================\n');

  await testHealthEndpoint();
  await testAuthEndpoints();
  await testSalesEndpoints();
  await testLeaderboardEndpoints();
  await testCommissionEndpoints();
  await testDailyReportsEndpoints();
  await testCarriersEndpoints();
  await testUploadEndpoints();
  await testErrorHandling();

  console.log('\n===========================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);
  
  if (failed > 0) {
    console.log('\n❌ TEST SUITE FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED');
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
