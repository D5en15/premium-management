import { createRequire } from 'node:module';

export const PROJECT_ID = 'premium-management-9c870';
export const OWNER_EMAIL = 'nonteerapong8@gmail.com';
export const DATABASE = `projects/${PROJECT_ID}/databases/(default)`;

export async function firebaseRequest() {
  // Reuse the local CLI login. No credentials are exported or put in the app.
  const require = createRequire(import.meta.url);
  const auth = require('firebase-tools/lib/auth.js');
  const account = auth.getAllAccounts().find(a => a.user.email === OWNER_EMAIL);
  if (!account?.tokens.refresh_token) throw new Error('ต้องล็อกอิน Firebase CLI ด้วยบัญชีเจ้าของก่อน');
  let tokens;
  try { tokens = await auth.getAccessToken(account.tokens.refresh_token, []); }
  catch { throw new Error('ตรวจสอบบัญชี Firebase ไม่สำเร็จ กรุณา firebase login --reauth'); }
  return async (host, path, options = {}) => {
    const response = await fetch(`https://${host}/${options.version ?? 'v1'}/${path}`, {
      method: options.method ?? 'GET',
      headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(`Firebase API ${response.status}: ${json.error?.message ?? 'request failed'}`);
    return json;
  };
}

export function encodeFields(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key,
    typeof value === 'boolean' ? { booleanValue: value } : typeof value === 'number' ? Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value } : { stringValue: value },
  ]));
}
export function decodeDocument(document) {
  return { id: document.name.split('/').at(-1), ...Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key,
    'stringValue' in value ? value.stringValue : 'integerValue' in value ? Number(value.integerValue) : 'doubleValue' in value ? value.doubleValue : 'booleanValue' in value ? value.booleanValue : 'timestampValue' in value ? value.timestampValue : null,
  ])) };
}
export async function readCollections(request) {
  const collections = ['services', 'members', 'subscriptions'];
  const results = await Promise.all(collections.map(async collection => {
    const documents = [];
    let pageToken;
    do {
      const params = new URLSearchParams({ pageSize: '500' });
      if (pageToken) params.set('pageToken', pageToken);
      const page = await request('firestore.googleapis.com', `${DATABASE}/documents/${collection}?${params}`);
      documents.push(...(page.documents ?? []).map(decodeDocument));
      pageToken = page.nextPageToken;
    } while (pageToken);
    return [collection, documents];
  }));
  return Object.fromEntries(results);
}
