import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { extname, join } from 'node:path';
import { mkdirSync, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { requirePin } from '../auth.js';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_KIND = new Set(['person', 'med-box', 'med-tablet']);

export function getUploadsRoot(): string {
  const root =
    process.env.MEDS_UPLOADS_DIR ??
    (process.env.MEDS_DB_PATH
      ? join(process.env.MEDS_DB_PATH, '..', 'uploads')
      : null);
  // Fall back to <project-root>/data/uploads relative to the compiled file.
  if (root) return root;
  return new URL('../../../data/uploads', import.meta.url).pathname;
}

export async function uploadsRoutes(app: FastifyInstance) {
  const uploadsDir = getUploadsRoot();
  mkdirSync(uploadsDir, { recursive: true });

  app.post<{ Querystring: { kind?: string } }>(
    '/api/uploads',
    { preHandler: requirePin },
    async (req, reply) => {
      const kind = req.query.kind ?? 'person';
      if (!ALLOWED_KIND.has(kind)) {
        return reply.code(400).send({ error: 'bad kind' });
      }
      const file = await req.file();
      if (!file) return reply.code(400).send({ error: 'no file' });
      if (!ALLOWED_MIME.has(file.mimetype)) {
        return reply.code(400).send({ error: 'unsupported mime', mime: file.mimetype });
      }

      const ext = extname(file.filename || '').toLowerCase() ||
        (file.mimetype === 'image/jpeg' ? '.jpg' :
         file.mimetype === 'image/png'  ? '.png' :
         file.mimetype === 'image/webp' ? '.webp' : '.gif');
      const id = randomBytes(12).toString('hex');
      const filename = `${kind}-${id}${ext}`;
      const dest = join(uploadsDir, filename);

      let bytes = 0;
      file.file.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) file.file.destroy(new Error('file too large'));
      });

      try {
        await pipeline(file.file, createWriteStream(dest));
      } catch (e) {
        return reply.code(413).send({ error: (e as Error).message });
      }

      const url = `/uploads/${filename}`;
      return { url, kind, bytes, mime: file.mimetype };
    }
  );
}
