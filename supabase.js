// ใส่ค่า Supabase ของครูตรงนี้
// วิธีดูค่า: Supabase Dashboard > Project Settings > API
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

// รหัสผ่าน Admin แบบง่าย สำหรับห้องเรียน
// หมายเหตุ: เพราะเป็น GitHub Pages รหัสนี้ไม่ใช่ระบบความปลอดภัยระดับสูง
const ADMIN_PASSWORD = "kru-dew-1234";

const BUCKET_NAME = "stop-motion-frames";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
