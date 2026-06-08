import pino from 'pino';
import { config } from '../config/index.js';

// Redact sensitive fields from log output.
// This ensures API keys and tokens never appear in logs even if
// accidentally passed as context objects.
const REDACT_PATHS = [
  'apiKey',
  'api_key',
  'token',
  'authorization',
  'privateKey',
  'private_key',
  'secret',
  'password',
  'GROQ_API_KEY',
  'GITHUB_PRIVATE_KEY',
  'GITHUB_WEBHOOK_SECRET',
];

export const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  transport:
    config.nodeEnv !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  base: {
    service: 'ai-pr-reviewer',
    env: config.nodeEnv,
  },
});
