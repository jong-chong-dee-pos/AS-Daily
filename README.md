# AS Daily Report

เว็บแอปแทนไฟล์ Daily.xlsx สำหรับบันทึกและดูรายงาน % PER, Lot out และต้นทุน (Standard / Actual) รายเดือน
ใช้ React + Vite และ Firebase (Authentication, Firestore, Hosting)

## เปิดใช้งานบน Claude (บัญชีเดียว)

ตอนนี้ใช้งานที่ https://claude.ai/artifact/Sv23oGXacRjLWzYK1RwGJV
เข้าด้วยบัญชี claude.ai ของเจ้าของ ไม่ต้อง Login แยก ข้อมูลเก็บในฐานข้อมูลของหน้านั้น

อัปเดตหน้า: `npm run build:artifact` แล้ว publish `dist-artifact/index.html` ไปที่ลิงก์เดิม
ข้อมูลตั้งต้นสร้างด้วย `node scripts/to-artifact-docs.mjs import.json` (ไลน์, พนักงาน, perMonth/YYYY-MM, lotMonth/YYYY-MM, ต้นทุน, เป้า, สรุป)

## หน้าในระบบ

| หน้า | ใครใช้ได้ | ใช้ทำอะไร |
|---|---|---|
| ภาพรวม (Dashboard) | ทุกคน | ตัวเลขสรุปเทียบเป้า + กราฟรายเดือน/รายสัปดาห์ |
| รายงาน % PER | ทุกคน | ดูรายไลน์ / ราย Setter / รายบุคคล |
| รายงาน Lot out | ทุกคน | Lot ส่งตรวจ, Lot out, % รายวัน รายสัปดาห์ รายเดือน |
| รายงานต้นทุน | ทุกคน | Standard / Actual / Variance 4 หมวด |
| กรอกข้อมูลรายวัน | editor, admin | % PER ทุกไลน์ + Lot out ของวันนั้น |
| กรอกต้นทุน | editor, admin | ต้นทุนรายเดือน 4 หมวด |
| ตั้งค่า | admin | ไลน์, พนักงาน, เป้าหมาย, ผู้ใช้ |

ทุกรายงานเลือกช่วงได้ 3 แบบ: รายปี, รายเดือน, ช่วงวันที่ และ Export เป็น Excel หรือ PDF ได้

## การใช้งานประจำวัน

1. เข้าเมนู **กรอกข้อมูลรายวัน** แล้วเลือกวันที่ (ค่าเริ่มต้นคือวันนี้)
2. ระบบเติมชื่อพนักงานประจำไลน์ให้อัตโนมัติ เปลี่ยนได้ถ้าวันนั้นคนเปลี่ยน
3. กรอก % PER ของแต่ละไลน์ ไลน์ที่ไม่ได้ผลิตให้เว้นว่าง (ไม่ถูกนำไปเฉลี่ย)
4. กรอก Lot ส่งตรวจ, Lot out Patrol, Lot out FG แล้วกด **บันทึก**
5. ต้นทุนกรอกเดือนละครั้งที่เมนู **กรอกต้นทุน**

## เพิ่มผู้ใช้ (admin)

1. Firebase console > Authentication > Users > **Add user** ใส่อีเมลและรหัสผ่าน
2. คัดลอก **User UID** ของคนนั้น
3. ในแอป เมนู **ตั้งค่า > ผู้ใช้** วาง UID ใส่ชื่อ อีเมล และเลือกสิทธิ์ (viewer / editor / admin)

ผู้ใช้ที่ยังไม่ถูกเพิ่มในหน้าตั้งค่าจะล็อกอินได้แต่ดูข้อมูลไม่ได้

## ติดตั้งครั้งแรก (ผู้ดูแลระบบ)

1. สร้างโปรเจกต์ใน Firebase console เปิด **Authentication (Email/Password)** และ **Firestore**
2. Project settings > Your apps > เพิ่ม Web app แล้วคัดลอกค่าไปใส่ `.env.local` ตาม `.env.example`
3. ติดตั้งและ deploy

   ```bash
   npm install
   npx firebase login
   npx firebase use --add          # เลือกโปรเจกต์
   npm run build
   npx firebase deploy --only firestore:rules,hosting
   ```

4. ผู้ใช้คนแรก: สร้างบัญชีใน Authentication แล้วสร้างเอกสาร `users/{UID}` ใน Firestore
   ใส่ `name`, `email`, `role: "admin"` จากนั้นเพิ่มคนอื่นผ่านหน้าตั้งค่าได้

## นำเข้าข้อมูลจาก Daily.xlsx

ต้องมี Python 3 และ `openpyxl` (`pip install openpyxl`) และไฟล์ service account
(Firebase console > Project settings > Service accounts > Generate new private key)

```bash
npm run import:parse -- Daily.xlsx > import.json
GOOGLE_APPLICATION_CREDENTIALS=service-account.json npm run import:load -- import.json --project <project-id>
```

สิ่งที่นำเข้า: ไลน์ 24 ไลน์ + Setter + พนักงานประจำไลน์, % PER และ Lot out รายวันของ พ.ย. 2026,
ต้นทุน ม.ค.–ต.ค. 2026, เป้าหมายรายเดือน 2026, สรุป % PER และ Lot out ม.ค.–ต.ค. 2026 และค่ารายปี 2024–2025
รันซ้ำได้ (เขียนทับข้อมูลเดิมที่ key เดียวกัน) ห้าม commit `import.json`, ไฟล์ xlsx หรือ service account

## สูตรที่ใช้

- % PER รายไลน์ = ค่าเฉลี่ยเฉพาะวันที่มีข้อมูล
- % PER รวม = ค่าเฉลี่ยของไลน์ที่ติ๊ก "นับรวม" (ค่าเริ่มต้น 9 ไลน์ตาม Excel)
- Lot out % = (Patrol + FG) ÷ Lot ส่งตรวจ × 100 คิดจากยอดรวม
- สัปดาห์: W1 วันที่ 1–7, W2 8–14, W3 15–21, W4 22–สิ้นเดือน
- Variance = Standard − Actual (ติดลบแสดงสีแดง)

## สำหรับนักพัฒนา

```bash
npm run dev          # รันแอป (ตั้ง VITE_USE_EMULATOR=true เพื่อใช้ emulator)
npm run emulators    # Firestore + Auth emulator
npm test             # unit + UI tests
npm run test:rules   # Firestore rules + data layer บน emulator
DAILY_XLSX=Daily.xlsx python3 -m unittest scripts/test_parse_xlsx.py
```
