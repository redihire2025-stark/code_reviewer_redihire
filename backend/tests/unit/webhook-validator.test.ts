import { createHmac } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { validateWebhookSignature } from '../../src/webhooks/validator';

// Mock the config module
jest.mock('../../src/config/index', () => ({
  config: {
    nodeEnv: 'test',
    port: 3000,
    databaseUrl: 'postgresql://test',
    github: {
      appId: '123',
      privateKey: 'test-key',
      webhookSecret: 'my-webhook-secret',
    },
    groq: { apiKey: 'test', model: 'test-model' },
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const SECRET = 'my-webhook-secret';

function makeSignature(body: Buffer): string {
  return `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
}

function mockRequest(body: Buffer, signature?: string): Partial<Request> {
  return {
    body,
    ip: '127.0.0.1',
    headers: signature ? { 'x-hub-signature-256': signature } : {},
  };
}

describe('validateWebhookSignature', () => {
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('calls next() with a valid signature', () => {
    const body = Buffer.from(JSON.stringify({ action: 'opened' }));
    const sig = makeSignature(body);
    const req = mockRequest(body, sig);

    validateWebhookSignature(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 with missing signature', () => {
    const body = Buffer.from('{}');
    const req = mockRequest(body);

    validateWebhookSignature(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with invalid signature', () => {
    const body = Buffer.from('{}');
    const req = mockRequest(body, 'sha256=invalid');

    validateWebhookSignature(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with tampered body', () => {
    const originalBody = Buffer.from(JSON.stringify({ action: 'opened' }));
    const tamperedBody = Buffer.from(JSON.stringify({ action: 'deleted' }));
    const sig = makeSignature(originalBody); // Signature for original
    const req = mockRequest(tamperedBody, sig); // But body is different

    validateWebhookSignature(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
