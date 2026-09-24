import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ALLOWED_FOLDERS, R2_BUCKET_NAME, getUserId, s3Client } from './_r2.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await getUserId(req))) {
    return res.status(401).json({ error: 'Please sign in again to upload files' });
  }

  try {
    const { filename, contentType, folder = 'evidence' } = req.body || {};

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    if (!(ALLOWED_FOLDERS as readonly string[]).includes(folder)) {
      return res.status(400).json({ error: 'Invalid folder' });
    }

    const sanitizedName = String(filename).replace(/[^a-zA-Z0-9.-]/g, '_').slice(-120);
    const month = new Date().toISOString().slice(0, 7);
    // The random id makes /files links unguessable, since reads are link-based.
    const key = `${folder}/${month}/${randomUUID()}_${sanitizedName}`;

    const uploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType || 'application/octet-stream',
      }),
      { expiresIn: 3600 },
    );

    // The bucket is private; files are read through /files/* (see api/r2-file.ts).
    return res.status(200).json({ uploadUrl, publicUrl: `/files/${key}`, key });
  } catch (error: any) {
    console.error('R2 presigned URL generation failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate upload URL' });
  }
}
