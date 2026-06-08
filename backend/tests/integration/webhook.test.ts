import { createHmac } from 'crypto';
import request from 'supertest';

// These integration tests verify the end-to-end webhook flow.
// They mock external services (GitHub, Groq, DB) to test only the integration logic.

jest.mock('../../src/database/client', () => ({
  prisma: {},
  connectDatabase: jest.fn().mockResolvedValue(undefined),
  disconnectDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/review.service', () => ({
  processPullRequest: jest.fn().mockResolvedValue({
    reviewId: 'review-123',
    prNumber: 1,
    repository: 'owner/repo',
    status: 'completed',
    score: 8.5,
    commentsPosted: 3,
  }),
}));

jest.mock('../../src/config/index', () => ({
  config: {
    nodeEnv: 'test',
    port: 3000,
    databaseUrl: 'postgresql://test',
    github: {
      appId: '123',
      privateKey: 'test-key',
      webhookSecret: 'integration-test-secret',
    },
    groq: { apiKey: 'test', model: 'test-model' },
  },
}));

const SECRET = 'integration-test-secret';

function sign(body: string): string {
  return `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
}

const prPayload = {
  action: 'opened',
  number: 1,
  pull_request: {
    id: 101,
    number: 1,
    title: 'Add game scoring feature',
    state: 'open',
    draft: false,
    html_url: 'https://github.com/owner/repo/pull/1',
    head: { sha: 'abc123', ref: 'feat/scoring' },
    base: { ref: 'main' },
    user: { login: 'devuser' },
  },
  repository: {
    id: 1,
    full_name: 'owner/repo',
    name: 'repo',
    owner: { login: 'owner' },
    private: false,
  },
  installation: { id: 456 },
};

describe('POST /api/github/webhook', () => {
  let app: Express.Application;

  beforeAll(async () => {
    const { default: appModule } = await import('../../src/app');
    app = appModule;
  });

  it('returns 202 for a valid PR opened webhook', async () => {
    const body = JSON.stringify(prPayload);
    const response = await request(app)
      .post('/api/github/webhook')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-GitHub-Delivery', 'test-delivery-1')
      .set('X-Hub-Signature-256', sign(body))
      .send(body);

    expect(response.status).toBe(202);
    expect(response.body.message).toContain('queued');
  });

  it('returns 401 for missing signature', async () => {
    const response = await request(app)
      .post('/api/github/webhook')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'pull_request')
      .send(JSON.stringify(prPayload));

    expect(response.status).toBe(401);
  });

  it('returns 200 for non-PR events', async () => {
    const body = JSON.stringify({ action: 'created' });
    const response = await request(app)
      .post('/api/github/webhook')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'issues')
      .set('X-Hub-Signature-256', sign(body))
      .send(body);

    expect(response.status).toBe(200);
  });

  it('skips draft PRs', async () => {
    const draftPayload = {
      ...prPayload,
      pull_request: { ...prPayload.pull_request, draft: true },
    };
    const body = JSON.stringify(draftPayload);
    const response = await request(app)
      .post('/api/github/webhook')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-Hub-Signature-256', sign(body))
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('Draft');
  });
});
