// ใส่ค่า Supabase ของครูตรงนี้
// วิธีดูค่า: Supabase Dashboard > Project Settings > API
const SUPABASE_URL = "https://zmxectdpriiwtsbaezpv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4KrThBM_827Gsr_4sKfsGA_J1vQGWHu";

// รหัสผ่าน Admin แบบง่าย สำหรับห้องเรียน
// หมายเหตุ: เพราะเป็น GitHub Pages รหัสนี้ไม่ใช่ระบบความปลอดภัยระดับสูง
const ADMIN_PASSWORD = "kru-dew-1234";

const BUCKET_NAME = "stop-motion-frames";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
