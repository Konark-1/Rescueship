import request from 'supertest';
import express from 'express';

// Dummy app for Mock APIs test
const app = express();
app.get('/mock/api/test', (req, res) => {
  res.status(200).json({ success: true, message: 'Mock API is working' });
});

describe('Mock APIs', () => {
  it('should return successful response from mock API endpoint', async () => {
    const response = await request(app).get('/mock/api/test');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Mock API is working');
  });
});
