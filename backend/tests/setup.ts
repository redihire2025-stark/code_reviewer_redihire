// Set required env vars before any module loads
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.GITHUB_APP_ID = '123456';
process.env.GITHUB_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
process.env.GITHUB_WEBHOOK_SECRET = 'test-secret-32-chars-minimum-length';
process.env.GROQ_API_KEY = 'gsk_test_key';
process.env.GROQ_MODEL = 'deepseek-r1-distill-llama-70b';
