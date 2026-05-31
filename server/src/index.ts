import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { db } from './db.js';
import { peopleRoutes } from './routes/people.js';
import { routinesRoutes } from './routes/routines.js';
import { medicationsRoutes } from './routes/medications.js';
import { scheduledAssignmentsRoutes } from './routes/scheduledAssignments.js';
import { prnAssignmentsRoutes } from './routes/prnAssignments.js';
import { awayPeriodsRoutes } from './routes/awayPeriods.js';
import { settingsRoutes } from './routes/settings.js';
import { uploadsRoutes, getUploadsRoot } from './routes/uploads.js';
import { dayRoutes } from './routes/day.js';
import { scheduledDoseLogsRoutes } from './routes/scheduledDoseLogs.js';
import { prnDoseLogsRoutes } from './routes/prnDoseLogs.js';
import { webhookRoutes } from './routes/webhooks.js';
import { reportingRoutes } from './routes/reporting.js';
import { startScheduler } from './scheduler.js';
import { authRoutes } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV ?? 'development';

const app = Fastify({ logger: true });

await app.register(fastifyMultipart, {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

app.get('/api/hello', async () => {
  const row = db
    .prepare(`SELECT value FROM meta WHERE key = 'created_at'`)
    .get() as { value: string } | undefined;
  return {
    message: 'hello from meds-tracker',
    env: NODE_ENV,
    db_created_at: row?.value ?? null,
    server_time: new Date().toISOString(),
  };
});

app.get('/api/health', async () => ({ ok: true }));

await app.register(authRoutes);
await app.register(peopleRoutes);
await app.register(routinesRoutes);
await app.register(medicationsRoutes);
await app.register(scheduledAssignmentsRoutes);
await app.register(prnAssignmentsRoutes);
await app.register(awayPeriodsRoutes);
await app.register(settingsRoutes);
await app.register(uploadsRoutes);
await app.register(dayRoutes);
await app.register(scheduledDoseLogsRoutes);
await app.register(prnDoseLogsRoutes);
await app.register(webhookRoutes);
await app.register(reportingRoutes);

// Serve uploaded images under /uploads/*.
const uploadsRoot = getUploadsRoot();
mkdirSync(uploadsRoot, { recursive: true });
await app.register(fastifyStatic, {
  root: uploadsRoot,
  prefix: '/uploads/',
  decorateReply: false,
});

// In production, serve the built client from /app/client/dist (Docker layout)
// and fall back to ../../client/dist (local `npm run build` + `npm start`).
if (NODE_ENV === 'production') {
  const candidates = [
    resolve(__dirname, '../../client/dist'),
    '/app/client/dist',
  ];
  const clientDist = candidates.find((p) => existsSync(join(p, 'index.html')));

  if (clientDist) {
    await app.register(fastifyStatic, {
      root: clientDist,
      prefix: '/',
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith('/api/') || req.raw.url?.startsWith('/uploads/')) {
        reply.code(404).send({ error: 'not found' });
        return;
      }
      reply.sendFile('index.html');
    });
  } else {
    app.log.warn('client build not found; API only');
  }
}

app
  .listen({ port: PORT, host: HOST })
  .then(() => {
    app.log.info(`meds-tracker listening on http://${HOST}:${PORT}`);
    startScheduler(app.log);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
