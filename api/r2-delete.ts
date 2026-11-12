import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getR2Context, getUserId, isAllowedKey, setPrivateApiHeaders } from './_r2.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPrivateApiHeaders(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await getUserId(req))) {
    return res.status(401).json({ error: 'Please sign in again' });
  }
  const r2 = await getR2Context();
  if (!r2) {
    return res.status(503).json({ error: 'File storage is not configured' });
  }

  const key = String(req.body?.key || '');
  if (!isAllowedKey(key)) {
    return res.status(400).json({ error: 'Invalid file key' });
  }

  try {
    await r2.client.send(new DeleteObjectCommand({ Bucket: r2.bucketName, Key: key }));
    return res.status(200).json({ deleted: key });
  } catch (error: any) {
    console.error('R2 delete failed:', error);
    return res.status(500).json({ error: 'Could not delete file' });
  }
}
