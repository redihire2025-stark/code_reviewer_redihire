import { z } from 'zod';
import type { AppConfig } from '../types/index.js';

// Only DATABASE_URL is truly required at startup.
// Other keys are validated when first used so the server can start
// and show meaningful errors in logs even if some vars are missing.
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  GITHUB_APP_ID: z.string().default(''),
  GITHUB_PRIVATE_KEY: z.string().default(''),
  GITHUB_WEBHOOK_SECRET: z.string().default(''),
  GROQ_API_KEY: z.string().default(''),
  GROQ_MODEL: z.string().default('deepseek-r1-distill-llama-70b'),
  FRONTEND_URL: z.string().optional(),
});

function loadConfig(): AppConfig {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  const env = result.data;

  const privateKey = env.GITHUB_PRIVATE_KEY.includes('\\n')
    ? env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n')
    : env.GITHUB_PRIVATE_KEY;

  return {
    nodeEnv: env.NODE_ENV,
    port: parseInt(env.PORT, 10),
    databaseUrl: env.DATABASE_URL,
    github: {
      appId: env.GITHUB_APP_ID,
      privateKey,
      webhookSecret: env.GITHUB_WEBHOOK_SECRET,
    },
    groq: {
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL,
    },
  };
}

export const config = loadConfig();
