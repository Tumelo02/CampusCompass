import { kv } from '@vercel/kv';
import crypto from 'crypto';

const KV_KEY = 'admin:disabledCodes';
const MAX_CODES = 1000;
const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const list = await kv.get(KV_KEY);
      return res.status(200).json({
        disabledCodes: Array.isArray(list) ? list : []
      });
    }

    if (req.method === 'POST') {
      const expected = process.env.ADMIN_PASS_HASH;
      if (!expected) {
        return res.status(500).json({ error: 'Server is missing ADMIN_PASS_HASH env var' });
      }
      const auth = req.headers.authorization || '';
      const m = /^Bearer\s+(.+)$/.exec(auth);
      if (!m) return res.status(401).json({ error: 'Missing bearer token' });
      const provided = sha256Hex(m[1]);
      if (!timingSafeEqualHex(provided, expected)) {
        return res.status(401).json({ error: 'Invalid passcode' });
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {};
      if (!Array.isArray(body.disabledCodes)) {
        return res.status(400).json({ error: 'Body must include disabledCodes array' });
      }
      const sanitized = body.disabledCodes
        .filter(c => typeof c === 'string' && CODE_PATTERN.test(c))
        .slice(0, MAX_CODES);

      await kv.set(KV_KEY, sanitized);
      return res.status(200).json({ ok: true, count: sanitized.length });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/visibility] error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
