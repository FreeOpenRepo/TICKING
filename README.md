# 05_TICKETING_ENGINE: High-Concurrency Seat Reservation & Flash-Sale Engine

ระบบจำหน่ายตั๋วและจองที่นั่งคอนเสิร์ต/อีเวนต์ (High-Concurrency Ticketing Engine) ออกแบบมารองรับการแย่งจองตั๋ว (Flash-Sale) พร้อมกันหลายแสนคน โดยใช้สถาปัตยกรรม Distributed Locking (Redis Redlock), การจองที่นั่งแบบจำกัดเวลา 10 นาที (Exact 600s TTL), ผังที่นั่งแบบ Interactive Canvas 60 FPS, และตั๋ว QR Code เข้ารหัสด้วย HMAC-SHA256

---

## 🔄 ภาพรวม Workflow การทำงาน (Business & Technical Workflow)

```mermaid
flowchart TD
    Customer["Customer (ลูกค้า)<br/>เลือกที่นั่งบน Interactive Seating Map"] -->|"1. Hold Seat (AVAILABLE to HELD)"| LockCheck{"Distributed Lock<br/>Redis Redlock"}
    
    LockCheck -->|"ที่นั่งถูกล็อกโดยผู้อื่นอยู่"| LockReject["Lock Failed (ที่นั่งไม่ว่าง)"]
    LockCheck -->|"ล็อกที่นั่งสำเร็จ StrictlyZeroDoubleBooking"| HoldSuccess["ล็อกที่นั่งไว้ 10 นาที (HoldTokenTtlExact600Seconds)<br/>พร้อม SignalR Broadcast อัปเดตสีที่นั่ง"]
    
    HoldSuccess --> PaymentChoice{"Payment Processing<br/>Stripe Webhook"}
    
    PaymentChoice -->|"หมดเวลา 10 นาที (TTL_EXPIRED)"| TimeoutStep["2. Release Seat (HELD to AVAILABLE)<br/>ปลดล็อกที่นั่งคืนสู่ระบบทันที"]
    
    PaymentChoice -->|"ชำระเงินสำเร็จ (PAYMENT_SUCCESS)"| ConfirmStep["3. Confirm Booking (HELD to CONFIRMED)<br/>ยืนยันตั๋วถาวร"]
    ConfirmStep --> QREngine["QRCoder and HMAC-SHA256<br/>สร้าง QR Code เข้ารหัสเฉพาะตัว"]
    ConfirmStep --> MailDispatch["Email Dispatch Ticket<br/>ส่งตั๋วและใบเสร็จเข้าอีเมลลูกค้าทันที"]
```

### รายละเอียดขั้นตอนการเปลี่ยนสถานะ (State Transitions):
1. **`AVAILABLE ➔ HELD` (Trigger: `HOLD_SEAT`)**: ลูกค้าคลิกเลือกที่นั่ง ระบบใช้ Redis Redlock ล็อก Key ของที่นั่งในระดับ Atomic และนับถอยหลัง 600 วินาที พร้อมส่ง Event ผ่าน SignalR ไปบอกเบราว์เซอร์ของทุกคนในห้องว่า "ที่นั่งนี้กำลังมีผู้จอง"
2. **`HELD ➔ AVAILABLE` (Trigger: `TTL_EXPIRED`)**: หากลูกค้าไม่ชำระเงินภายใน 10 นาที Redis Key จะหมดอายุ และที่นั่งจะถูกปลดปล่อยให้ผู้อื่นเลือกได้ทันที
3. **`HELD ➔ CONFIRMED` (Trigger: `PAYMENT_SUCCESS`)**: เมื่อรับ Webhook ยืนยันยอดเงินจาก Payment Gateway ระบบจะเปลี่ยนสถานะเป็น Confirmed และสร้างตั๋ว QR Code ป้องกันการปลอมแปลง

---

## 🛡️ กฎเหล็กของระบบ (Domain Invariants)

1. **`StrictlyZeroDoubleBooking` (ห้ามเกิดการจองซ้ำซ้อน 0.00% เด็ดขาด)**:
   - ป้องกันปัญหาที่นั่งชนกัน (Race Condition) ในช่วงเปิดขายบัตร แม้จะมีผู้ใช้งานกดพร้อมกันหลายพันคนในมิลลิวินาทีเดียวกัน จะมีเพียงคนเดียวเท่านั้นที่ได้ Lock ของที่นั่งนั้นไป
2. **`HoldTokenTtlExact600Seconds` (อายุการถือสิทธิ์จองที่นั่งต้องตรง 600 วินาทีเป๊ะ)**:
   - สิทธิ์การจองมีอายุแน่นอน 10 นาที เพื่อไม่ให้เกิดการกั๊กที่นั่ง และนำที่นั่งกลับมาหมุนเวียนขายใหม่ได้อย่างรวดเร็ว

---

## 💻 Tech Stack & เหตุผลในการเลือกใช้

| ส่วนประกอบ | เทคโนโลยีที่เลือก | เหตุผลที่เลือก | ข้อดีหลัก (Advantages) |
|---|---|---|---|
| **Frontend Map** | **Next.js 16 + react-konva** | เรนเดอร์ผังที่นั่งความจุ 50,000 ที่นั่งด้วย HTML5 Canvas 2D/WebGL | เลื่อน ซูม และคลิกเลือกที่นั่งได้ลื่นไหล 60 FPS ไม่กิน Memory เหมือน DOM ธรรมดา |
| **Payment Gateway** | **@stripe/stripe-js** | ระบบรับชำระเงินระดับโลกที่ปลอดภัย รองรับบัตรเครดิตและพร้อมเพย์ | มี Webhook ยืนยันยอดเงินที่เชื่อถือได้และได้มาตรฐาน PCI-DSS Level 1 |
| **Backend API** | **.NET 10 (Native AOT)** | คอมไพล์เป็น Machine Code โดยตรง (Ahead-of-Time Compilation) | เริ่มต้นระบบได้ใน 10ms ใช้ RAM น้อยมาก ตอบสนองต่อ Request ได้เร็วระดับไมโครวินาที |
| **Distributed Lock**| **Medallion.Threading.Redis (Redlock)**| จัดการ Distributed Locking ข้ามหลาย Server Instance | ป้องกัน Double-Booking ได้ 100% แม้ระบบจะสเกลออกเป็น 100 Pods |
| **Tamper-Proof QR** | **QRCoder + HMAC-SHA256** | ตั๋ว QR Code ถูกเซ็นลายเซ็นดิจิทัลด้วย Secret Key ประจำระบบ | เครื่องสแกนหน้าประตูทางเข้าสามารถตรวจสอบตั๋วปลอมได้อย่างรวดเร็ว |

---

## 🚀 สรุปสถาปัตยกรรม (Architecture Highlights)

- **Extreme Concurrency**: ออกแบบมาเพื่อรับมือกับ Traffic Spike มหาศาลในเสี้ยววินาทีของการเปิดจองบัตร
