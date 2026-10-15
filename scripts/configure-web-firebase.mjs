import { writeFile } from 'node:fs/promises';
import { PROJECT_ID, firebaseRequest } from './firebase-rest.mjs';

try {
  const request = await firebaseRequest();
  const parent = `projects/${PROJECT_ID}`;
  const apps = await request('firebase.googleapis.com', `${parent}/webApps`, { version: 'v1beta1' });
  console.log(JSON.stringify({ projectId: PROJECT_ID, webApps: (apps.apps ?? []).map(a => ({ appId: a.appId, displayName: a.displayName })) }, null, 2));
  let app = apps.apps?.find(a => a.displayName === 'Premium Management Web') ?? apps.apps?.[0];
  if (process.argv.includes('--apply')) {
    if (!app) {
      let operation = await request('firebase.googleapis.com', `${parent}/webApps`, { version: 'v1beta1', method: 'POST', body: { displayName: 'Premium Management Web' } });
      while (!operation.done) { await new Promise(resolve => setTimeout(resolve, 1500)); operation = await request('firebase.googleapis.com', operation.name, { version: 'v1beta1' }); }
      if (operation.error) throw new Error(operation.error.message);
      app = operation.response;
    }
    const config = await request('firebase.googleapis.com', `${parent}/webApps/${app.appId}/config`, { version: 'v1beta1' });
    if (config.projectId !== PROJECT_ID) throw new Error('Web config ไม่ตรงกับโปรเจกต์');
    await writeFile(new URL('../src/firebase-config.json', import.meta.url), JSON.stringify({ apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId, storageBucket: config.storageBucket, messagingSenderId: config.messagingSenderId, appId: config.appId }, null, 2) + '\n');
    console.log('บันทึก public Firebase Web config แล้ว ไม่มี private key หรือบัญชีสมาชิกใน config');
  }
  try {
    const config = await request('identitytoolkit.googleapis.com', `${parent}/config`, { version: 'v2' });
    if (process.argv.includes('--apply')) {
      const authorizedDomains = [...new Set([...(config.authorizedDomains ?? []), 'localhost', '127.0.0.1', `${PROJECT_ID}.firebaseapp.com`, `${PROJECT_ID}.web.app`])];
      if (authorizedDomains.length !== (config.authorizedDomains ?? []).length) {
        await request('identitytoolkit.googleapis.com', `${parent}/config?updateMask=authorizedDomains`, { version: 'v2', method: 'PATCH', body: { authorizedDomains } });
        console.log('เพิ่ม authorized domains สำหรับ localhost และ Firebase Hosting แล้ว');
      }
    }
    console.log(JSON.stringify({ authInitialized: true, authorizedDomains: config.authorizedDomains, signIn: { allowDuplicateEmails: config.signIn?.allowDuplicateEmails, emailEnabled: config.signIn?.email?.enabled, anonymousEnabled: config.signIn?.anonymous?.enabled } }, null, 2));
    const providers = await request('identitytoolkit.googleapis.com', `${parent}/defaultSupportedIdpConfigs`, { version: 'v2' });
    console.log(JSON.stringify({ providers: (providers.defaultSupportedIdpConfigs ?? []).map(p => ({ name: p.name, enabled: p.enabled, hasClientId: Boolean(p.clientId) })) }, null, 2));
    if (!providers.defaultSupportedIdpConfigs?.some(p => p.name.endsWith('/google.com') && p.enabled && p.clientId)) throw new Error('ต้องเปิด Google provider ใน Firebase Console ก่อนใช้งานจริง');
    console.log('Google Login พร้อมใช้งานในโปรเจกต์แล้ว');
  } catch (error) { console.error(`Authentication: ${error.message}`); process.exitCode = 1; }
} catch (error) { console.error(error.message); process.exitCode = 1; }
