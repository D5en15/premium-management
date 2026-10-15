# Premium Management

เว็บไซต์สำหรับเจ้าของบริการ Family คนเดียว ใช้ React + TypeScript + Vite และ CSS ปกติ เชื่อม Google Login และข้อมูลจริงใน Cloud Firestore ด้วย Firebase SDK

**เว็บไซต์จริง:** https://premium-management-9c870.web.app — เผยแพร่แล้ววันที่ 5 ตุลาคม 2026 และตรวจว่า Google provider เปิดแล้ว เข้าสู่ระบบด้วยบัญชีเจ้าของเพื่อใช้งาน

## เปิดใช้งาน

```sh
npm install
npm run dev
```

เปิด `http://localhost:5173` แล้วเข้าสู่ระบบด้วย Google เฉพาะ `nonteerapong8@gmail.com` ข้อมูลแสดงหลังยืนยันบัญชีและโหลด Firestore สำเร็จ

สำหรับตรวจ UI ด้วยข้อมูลสมมติ ให้ใช้ `http://localhost:5173/?demo=1` เฉพาะ dev server โหมดนี้ไม่แก้ข้อมูลจริงและไม่เปิดให้ใช้ใน production

## เปิด Google Login ครั้งแรก

1. เปิด [Firebase Authentication](https://console.firebase.google.com/project/premium-management-9c870/authentication/providers)
2. กด Get started → Add new provider → Google → Enable
3. ตั้งชื่อแอพ `Premium Management` เลือก support email `nonteerapong8@gmail.com` แล้ว Save
4. รัน `npm run firebase:configure-web` เพื่อตรวจ provider และเพิ่มโดเมนที่จำเป็นสำหรับการทดสอบ
5. กลับมาที่เว็บแล้วกด “เข้าสู่ระบบด้วย Google”

การเปิดครั้งแรกผ่าน Firebase Console ใช้แผนเดิมได้ ส่วน API initialize ของ Identity Platform ที่ลองใช้ตอบ `BILLING_NOT_ENABLED` จึงไม่ได้เปิด billing หรืออัปเกรดแผน

## หน้าที่พร้อมทดลอง

- **ภาพรวม:** เรียงกำหนดจ่าย ค้นหา กรองบริการ/ช่วงเตือน ต่ออายุด้วยจำนวนเดือน และคัดลอกข้อมูลทั้งหมด
- **สมาชิก:** เพิ่มและแก้ไขข้อมูลสมาชิก เพิ่มหลายบริการที่มีวันหมดอายุและข้อมูลบัญชีแยกกัน ดูรายละเอียดและยุติรายการบริการ
- **บริการพรีเมี่ยม:** เพิ่ม/แก้ชื่อ ราคา สัญลักษณ์ สี และเปิด–ปิดบริการโดยเก็บข้อมูลสมาชิกเดิม
- **รูปแบบข้อความ:** แก้เทมเพลตเตือนทั้ง 4 ช่วงและข้อความหลังต่ออายุ แทรกตัวแปร ดูตัวอย่าง คืนค่าเริ่มต้น และกดบันทึกเพื่อใช้กับปุ่มคัดลอก (บัญชีจริงเก็บที่ Firestore `settings/messages`; โหมดทดลองเก็บในเบราว์เซอร์)
- **เข้าสู่ระบบ:** Google Login จริง ตรวจบัญชีเจ้าของ และมีการออกจากระบบ

## ข้อมูล

ข้อมูลจริงโหลดจากเซิร์ฟเวอร์ครบทั้ง `services`, `members`, `subscriptions` หลังยืนยันบัญชี อัปเดตเมื่อกลับมาเปิดแท็บ ทุก 60 วินาที และกดโหลดใหม่ได้ การแก้ไขใช้ transaction ตรวจค่าที่เปิดฟอร์มกับข้อมูลบนเซิร์ฟเวอร์ เพื่อไม่ทับการแก้จากอีกหน้าต่าง แจ้งสำเร็จหลังเซิร์ฟเวอร์ยืนยันเท่านั้น

ข้อมูลจริงไม่ถูกเก็บใน localStorage ใช้ Firestore memory cache ตามค่าเริ่มต้น ส่วน localStorage ใช้เฉพาะโหมดจำลองใน dev server ข้อมูลจำลองอยู่ใน `src/mock.ts` และมีปุ่มรีเซ็ต

ข้อมูลจริงใน `initial-data.md` ไม่ถูกนำเข้า frontend, ไม่รวมใน build และถูกละเว้นใน Git กับการเสิร์ฟไฟล์ของ Vite

public Firebase config ใน `src/firebase-config.json` เป็นค่าตั้งค่า Web SDK ไม่ใช่ private key การเข้าถึงข้อมูลถูกควบคุมด้วย Firebase Authentication และ Security Rules ที่ deploy แล้ว

## Firebase และการนำเข้าข้อมูลจริง

โปรเจกต์ `premium-management-9c870` ใช้ Firestore `(default)` ที่กรุงเทพฯ (`asia-southeast3`) นำเข้าแล้ว 4 บริการ 19 สมาชิก และ 21 รายการบริการเมื่อ 2 ตุลาคม 2026

ข้อมูลอยู่ใน collections `services`, `members`, `subscriptions` โดยสมาชิกที่ใช้หลายบริการเป็นคนเดียวกัน และวันหมดอายุแยกตามรายการบริการ ทุกเอกสารมีเวลาฝั่งเซิร์ฟเวอร์ `createdAt`, `updatedAt`

สคริปต์อ่านข้อมูลจากไฟล์จริงบนเครื่องเท่านั้น ใช้บัญชี Firebase CLI เจ้าของที่ล็อกอินไว้ ไม่เก็บ credential ในโค้ด และใช้การเขียนแบบ atomic พร้อมเงื่อนไขว่าเอกสารใหม่ต้องยังไม่มีอยู่ นำเข้าซ้ำจะข้ามข้อมูลเดิม รวมข้อมูลที่ต่ออายุหรือแก้หมายเหตุไปแล้ว

```sh
npm run firebase:inspect      # ดูจำนวนข้อมูลและกฎสิทธิ์ ไม่เขียนข้อมูล
npm run firebase:import       # เพิ่มเฉพาะข้อมูลที่ยังไม่มีจาก initial-data.md
npm run firebase:verify       # ตรวจว่าข้อมูลจากต้นฉบับมีรายการอ้างอิงครบ
npm run firebase:check-rules  # ตรวจ Rules ที่ deploy และการปฏิเสธผู้ไม่ล็อกอิน
```

Security Rules อนุญาตอ่านและเขียนเฉพาะอีเมลเจ้าของที่ยืนยันแล้ว ตรวจฟิลด์และความสัมพันธ์ และไม่อนุญาตลบถาวร ขั้นตอนตรวจนี้ครอบคลุมการอ่าน 12 กรณีและคำขอจริงแบบไม่ล็อกอินทั้ง 3 collections ไม่ได้อ้างว่าเป็นการทดสอบ write rules ครบทุกกรณี

การ deploy Rules แยกจากการเผยแพร่เว็บ:

```sh
npx firebase deploy --only firestore:rules --project premium-management-9c870
```

## โครงสร้าง

```text
src/App.tsx                หน้าจอ เมนู และการแก้ข้อมูลจำลอง
src/components/Editors.tsx ฟอร์มสมาชิก บริการ และต่ออายุ
src/components/Modal.tsx   หน้าต่างฟอร์ม
src/domain.ts              วันที่ กติกาต่ออายุ ข้อความเตือน และส่งออก
src/mock.ts                ชุดข้อมูลสมมติ
src/styles.css             รูปแบบและ responsive
src/firebase.ts            Google Login โหลดข้อมูล และ transaction
src/useFirebase.ts         สถานะบัญชี การโหลด และการอัปเดตข้อมูล
src/changes.ts             เลือกเฉพาะเอกสารที่เปลี่ยนและฟิลด์ที่อนุญาต
```

ใช้ Google Fonts พร้อมฟอนต์สำรอง หากไม่มีอินเทอร์เน็ตเว็บยังใช้งานด้วยฟอนต์ระบบได้

## ตรวจสอบและ build

```sh
npm test
npm run test:e2e
npm run build
```

ชุดทดสอบเบราว์เซอร์ใช้ Google Chrome ที่ติดตั้งในเครื่อง ตรวจการเพิ่ม/แก้ไข ต่ออายุ ส่งออก เปิด–ปิดบริการ หน้าเข้าสู่ระบบ และหน้าจอมือถือ 360px ส่วนชุดทดสอบกติกาวันที่ใช้ Node.js 22.18 ขึ้นไป

`npm run build` สร้างไฟล์สำหรับเผยแพร่ใน `dist/` เผยแพร่ผ่าน Firebase Hosting แล้ว การทดสอบ UI ใช้ข้อมูลจำลองและตรวจว่า production ข้าม Login ไม่ได้ จึงไม่แก้วันหมดอายุสมาชิกจริงระหว่างทดสอบ

## เผยแพร่เวอร์ชันใหม่

```sh
npm run build
npx firebase deploy --only hosting --project premium-management-9c870
```

Hosting ใช้เฉพาะไฟล์ใน `dist/` ไม่เผยแพร่ไฟล์ข้อมูลจริง เอกสาร หรือ credentials

การลบบริการของสมาชิก: ยืนยันแล้วลบ subscription ออกจาก Firestore จริง ไม่มีรายการยุติที่เก็บไว้ ชื่อสมาชิก บริการอื่น และบริการหลักยังอยู่

ลบสมาชิก: เปิดรายละเอียดสมาชิกแล้วกดลบสมาชิก ยืนยันเพื่อลบสมาชิกและบริการทั้งหมดของเขาใน Firestore พร้อมกัน สมาชิกไม่มีบริการยังคงอยู่จนกดลบเอง
