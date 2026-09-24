import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { R2_BUCKET_NAME, isAllowedKey, s3Client } from './_r2';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const raw = req.query.key;
  const key = Array.isArray(raw) ? raw.join('/') : String(raw || '');
  if (!isAllowedKey(key)) {
    return res.status(400).json({ error: 'Invalid file key' });
  }

  try {
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
      { expiresIn: 3600 },
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Location', url);
    return res.status(302).end();
  } catch (error: any) {
    console.error('R2 signed read URL failed:', error);
    return res.status(500).json({ error: 'Could not open file' });
  }
}
