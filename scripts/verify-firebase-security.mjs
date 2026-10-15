import { readFile } from 'node:fs/promises';
import { DATABASE, OWNER_EMAIL, PROJECT_ID, firebaseRequest } from './firebase-rest.mjs';

try {
  const request = await firebaseRequest();
  const releases = await request('firebaserules.googleapis.com', `projects/${PROJECT_ID}/releases?pageSize=100`);
  const release = releases.releases?.find(r => r.name.endsWith('/cloud.firestore'));
  if (!release) throw new Error('ยังไม่มี Firestore Rules release');
  const ruleset = await request('firebaserules.googleapis.com', release.rulesetName);
  const content = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  if (ruleset.source?.files?.find(f => f.name === 'firestore.rules')?.content !== content) throw new Error('กฎที่ deploy ไม่ตรงกับไฟล์ในโปรเจกต์');

  const scenarios = [
    { name: 'owner', auth: { uid: 'owner-test', token: { email: OWNER_EMAIL, email_verified: true } }, expectation: 'ALLOW' },
    { name: 'anonymous', auth: null, expectation: 'DENY' },
    { name: 'other-account', auth: { uid: 'other-test', token: { email: 'other@example.com', email_verified: true } }, expectation: 'DENY' },
    { name: 'unverified-owner', auth: { uid: 'unverified-test', token: { email: OWNER_EMAIL, email_verified: false } }, expectation: 'DENY' },
  ];
  const testCases = ['services', 'members', 'subscriptions', 'settings'].flatMap(collection => scenarios.map(s => ({
    expectation: s.expectation,
    request: { method: 'get', path: `/databases/(default)/documents/${collection}/${collection === 'settings' ? 'messages' : 'test-document'}`, auth: s.auth },
  })));
  testCases.push(...scenarios.map(s => ({ expectation: s.expectation, request: { method: 'delete', path: '/databases/(default)/documents/subscriptions/test-document', auth: s.auth } })));
  testCases.push(...scenarios.map(s => ({ expectation: s.expectation, request: { method: 'delete', path: '/databases/(default)/documents/members/test-document', auth: s.auth } })));
  const result = await request('firebaserules.googleapis.com', `projects/${PROJECT_ID}:test`, { method: 'POST', body: { source: { files: [{ name: 'firestore.rules', content }] }, testSuite: { testCases } } });
  if (result.issues?.some(i => i.severity === 'ERROR') || result.testResults?.length !== testCases.length || result.testResults.some(r => r.state !== 'SUCCESS')) {
    console.log(JSON.stringify({ issues: result.issues, testResults: result.testResults?.map(r => ({ state: r.state, errors: r.errorMessages })) }, null, 2));
    throw new Error('การทดสอบ Security Rules ไม่ผ่าน');
  }
  const publicChecks = await Promise.all(['services', 'members', 'subscriptions'].map(async collection => {
    const response = await fetch(`https://firestore.googleapis.com/v1/${DATABASE}/documents/${collection}?pageSize=1`, { signal: AbortSignal.timeout(20_000) });
    if (![401, 403].includes(response.status)) throw new Error(`คำขอไม่ล็อกอินของ ${collection} ไม่ถูกปฏิเสธ`);
    return { collection, unauthenticatedStatus: response.status };
  }));
  console.log(JSON.stringify({ deployedRulesMatch: true, ruleReadTestsPassed: result.testResults.length, publicChecks }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
