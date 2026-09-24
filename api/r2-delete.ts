import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { R2_BUCKET_NAME, getUserId, isAllowedKey, s3Client } from './_r2.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await getUserId(req))) {
    return res.status(401).json({ error: 'Please sign in again' });
  }

  const key = String(req.body?.key || '');
  if (!isAllowedKey(key)) {
    return res.status(400).json({ error: 'Invalid file key' });
  }

  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return res.status(200).json({ deleted: key });
  } catch (error: any) {
    console.error('R2 delete failed:', error);
    return res.status(500).json({ error: 'Could not delete file' });
  }
}
