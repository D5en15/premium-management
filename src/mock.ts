import { bangkokToday, offsetDate, type Data } from './domain';

export const STORAGE_KEY = 'premium-preview-v1';
export const uid = () => crypto.randomUUID();

export function createMockData(today = bangkokToday()): Data {
  const services = [
    { id: 'youtube', name: 'YouTube Premium', monthlyPrice: 75, symbol: '🔴', color: '#ed5b53', isActive: true, sortOrder: 0 },
    { id: 'spotify', name: 'Spotify', monthlyPrice: 50, symbol: '🟢', color: '#35a877', isActive: true, sortOrder: 1 },
    { id: 'netflix-tv', name: 'Netflix TV', monthlyPrice: 140, symbol: '🟣', color: '#a176cb', isActive: true, sortOrder: 2 },
    { id: 'netflix', name: 'Netflix Normal', monthlyPrice: 85, symbol: '🟣', color: '#a176cb', isActive: true, sortOrder: 3 },
    { id: 'canva', name: 'Canva Pro', monthlyPrice: 45, symbol: '🔵', color: '#419db2', isActive: false, sortOrder: 4 },
  ];
  const names = ['พิมพ์ชนก วัฒนสุข', 'ธนกฤต ใจดี', 'ณัฐชา สายลม', 'กานต์พิชชา แสงดาว', 'ปกรณ์ อรุณใหม่', 'มินตรา พราวฟ้า', 'ภูริณัฐ ธารใส', 'ชลธิชา รุ่งเรือง', 'อัญชิสา นาคทอง', 'ธีรภัทร เมฆา', 'ลลิตา สุขสันต์', 'ศุภวิชญ์ ต้นน้ำ'];
  const members = names.map((name, index) => ({ id: `member-${index}`, name, description: index === 0 ? 'ติดต่อผ่าน Facebook • สะดวกช่วงเย็น' : index === 4 ? 'ใช้งานร่วมกัน 2 บริการ' : '' }));
  const records: [number, string, number][] = [[0, 'youtube', -1], [1, 'spotify', 0], [2, 'netflix-tv', 1], [3, 'youtube', 5], [4, 'spotify', 5], [4, 'netflix', 12], [5, 'youtube', 8], [6, 'netflix', 14], [7, 'spotify', 18], [8, 'netflix-tv', 21], [9, 'youtube', 24], [10, 'spotify', 30], [11, 'youtube', 35], [0, 'netflix', 17], [2, 'spotify', 28], [6, 'canva', -10]];
  const subscriptions = records.map(([member, serviceId, days], index) => {
    const expiresOn = offsetDate(today, days);
    return { id: `sub-${index}`, memberId: `member-${member}`, serviceId, expiresOn, billingDay: Number(expiresOn.slice(-2)), description: `demo${member + 1}@example.com${serviceId.startsWith('netflix') ? ' • โปรไฟล์ 2' : ''}`, status: index === 15 ? 'ended' as const : 'active' as const };
  });
  return { version: 1, revision: uid(), services, members, subscriptions };
}
