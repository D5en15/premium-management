import { readFile } from 'node:fs/promises';
import { parseInitialData, planImport } from './seed-data.mjs';
import { DATABASE, PROJECT_ID, encodeFields, firebaseRequest, readCollections } from './firebase-rest.mjs';

const args = new Set(process.argv.slice(2));
if ([...args].some(a => !['--inspect', '--apply', '--verify'].includes(a))) throw new Error('ใช้ --inspect, --apply หรือ --verify เท่านั้น');
const seed = parseInitialData(await readFile(new URL('../initial-data.md', import.meta.url), 'utf8'));
const sourceCounts = Object.fromEntries(Object.entries(seed).map(([key, items]) => [key, items.length]));
if (sourceCounts.services !== 4 || sourceCounts.members !== 19 || sourceCounts.subscriptions !== 21) throw new Error('จำนวนข้อมูลต้นฉบับไม่ตรงกับจำนวนที่ตรวจไว้ หยุดก่อนนำเข้า');

try {
  const request = await firebaseRequest();
  const databases = await request('firestore.googleapis.com', `projects/${PROJECT_ID}/databases`);
  const database = databases.databases?.find(d => d.name === DATABASE);
  console.log(JSON.stringify({ projectId: PROJECT_ID, sourceCounts, databases: (databases.databases ?? []).map(d => ({ name: d.name, locationId: d.locationId, type: d.type })) }, null, 2));
  if (!database) throw new Error('โปรเจกต์ยังไม่มี Firestore (default) ต้องสร้างฐานข้อมูลก่อน');
  if (database.type !== 'FIRESTORE_NATIVE') throw new Error('ฐานข้อมูลไม่ได้ใช้ Firestore Native mode');

  const existing = await readCollections(request);
  const plan = planImport(seed, existing);
  console.log(JSON.stringify({ existingCounts: Object.fromEntries(Object.entries(existing).map(([key, items]) => [key, items.length])), createCounts: Object.fromEntries(Object.keys(seed).map(key => [key, plan.create.filter(x => x.collection === key).length])), skipped: plan.skipped }, null, 2));

  if (args.has('--inspect')) {
    const releases = await request('firebaserules.googleapis.com', `projects/${PROJECT_ID}/releases?pageSize=100`);
    const release = releases.releases?.find(r => r.name.endsWith('/cloud.firestore'));
    if (release) {
      const ruleset = await request('firebaserules.googleapis.com', release.rulesetName);
      console.log(JSON.stringify({ firestoreRelease: release.name, rules: ruleset.source?.files }, null, 2));
    } else console.log('ยังไม่มี Firestore Rules release');
    process.exit(0);
  }

  if (args.has('--apply') && plan.create.length) {
    const writes = plan.create.map(({ collection, id, ...fields }) => ({
      update: { name: `${DATABASE}/documents/${collection}/${id}`, fields: encodeFields(fields) },
      currentDocument: { exists: false },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }, { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
    }));
    if (writes.length > 500) throw new Error('ข้อมูลเกินขอบเขต batch นี้ หยุดก่อนนำเข้า');
    const result = await request('firestore.googleapis.com', `${DATABASE}/documents:commit`, { method: 'POST', body: { writes } });
    console.log(JSON.stringify({ committed: result.writeResults?.length ?? 0, commitTime: result.commitTime }, null, 2));
  } else if (!args.has('--apply') && !args.has('--verify')) {
    console.log('Dry run เท่านั้น ยังไม่มีการเขียนข้อมูล ใช้ --apply เพื่อนำเข้า');
    process.exit(0);
  }

  const actual = await readCollections(request);
  const after = planImport(seed, actual);
  if (after.create.length) throw new Error('ยังมีข้อมูลจากต้นฉบับที่ขาดอยู่ การตรวจไม่ผ่าน');
  for (const { collection, id, ...fields } of plan.create) {
    const record = actual[collection].find(x => x.id === id);
    if (!record || Object.entries(fields).some(([key, value]) => record[key] !== value) || !record.createdAt || !record.updatedAt) throw new Error(`ตรวจข้อมูลใหม่ใน ${collection} ไม่ผ่าน`);
  }
  console.log(JSON.stringify({ verified: true, importedSourceCounts: sourceCounts, actualCounts: Object.fromEntries(Object.entries(actual).map(([key, items]) => [key, items.length])), pendingOnReimport: after.create.length, existingRecordsPreserved: plan.skipped }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
