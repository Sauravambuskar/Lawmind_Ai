import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Context, isAllowedKey } from './_r2.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const r2 = await getR2Context();
  if (!r2) {
    return res.status(503).json({ error: 'File storage is not configured' });
  }

  const raw = req.query.key;
  const key = Array.isArray(raw) ? raw.join('/') : String(raw || '');
  if (!isAllowedKey(key)) {
    return res.status(400).json({ error: 'Invalid file key' });
  }

  try {
    const url = await getSignedUrl(
      r2.client,
      new GetObjectCommand({ Bucket: r2.bucketName, Key: key }),
      { expiresIn: 300 },
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Location', url);
    return res.status(302).end();
  } catch (error: any) {
    console.error('R2 signed read URL failed:', error);
    return res.status(500).json({ error: 'Could not open file' });
  }
}
