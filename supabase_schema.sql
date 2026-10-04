-- ==============================================================================
-- اسکریپت ساخت کامل جداول و داده‌های اولیه دیتابیس مدرسه در Supabase (PostgreSQL)
-- سامانه ارتباطی و اتوماسیون معلمان و کادر مدرسه
-- ==============================================================================

-- ۱. فعال‌سازی اکستنشن‌های مورد نیاز
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ۲. جدول کاربران (مدیر، معاونین و دبیران)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    personnel_code TEXT NOT NULL UNIQUE,
    mobile TEXT NOT NULL,
    full_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('principal', 'deputy', 'teacher')),
    avatar TEXT NOT NULL,
    password TEXT NOT NULL,
    is_online BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۳. جدول گروه‌ها و کانال‌های اطلاع‌رسانی
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    avatar TEXT NOT NULL,
    is_announcement_only BOOLEAN DEFAULT false,
    auto_delete_hours INTEGER DEFAULT 0,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۴. جدول اعضای گروه‌ها (رابطه چند به چند بین گروه و کاربران)
CREATE TABLE IF NOT EXISTS group_members (
    id BIGSERIAL PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- ۵. جدول پیام‌ها (متن، صوت، تصویر، ویدیو، فایل، بخشنامه)
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    sender_avatar TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    file_url TEXT,
    file_name TEXT,
    voice_duration INTEGER,
    video_duration INTEGER,
    voice_transcript TEXT,
    is_voice_transcribed BOOLEAN DEFAULT false,
    is_voice_translated BOOLEAN DEFAULT false,
    original_spoken_text TEXT,
    is_pinned BOOLEAN DEFAULT false,
    reply_to_id TEXT,
    reply_to_content TEXT,
    reply_to_sender TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۶. جدول واکنش‌ها (ایموجی‌ها) به پیام‌ها
CREATE TABLE IF NOT EXISTS message_reactions (
    id BIGSERIAL PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- ۷. ایندکس‌ها برای سرعت بالای لود پیام‌ها و جستجو
CREATE INDEX IF NOT EXISTS idx_users_personnel_code ON users(personnel_code);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_created ON messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);

-- ۸. تنظیم دسترسی‌های سطحی (Row Level Security - RLS) در Supabase
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- ایجاد پالیسی‌های دسترسی عمومی (سازگار با بک‌اند و کلاینت اپلیکیشن)
DROP POLICY IF EXISTS "Public access to users" ON users;
CREATE POLICY "Public access to users" ON users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to groups" ON groups;
CREATE POLICY "Public access to groups" ON groups FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to group_members" ON group_members;
CREATE POLICY "Public access to group_members" ON group_members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to messages" ON messages;
CREATE POLICY "Public access to messages" ON messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to message_reactions" ON message_reactions;
CREATE POLICY "Public access to message_reactions" ON message_reactions FOR ALL USING (true) WITH CHECK (true);

-- ۹. درج اطلاعات و کاربران اولیه سامانه (حساب مدیر مدرسه و همکاران)
INSERT INTO users (id, personnel_code, mobile, full_name, subject, role, avatar, password, is_online, created_at)
VALUES 
('u_principal', '20859009', '09121112233', 'دکتر محمد رضایی (مدیر مدرسه)', 'مدیر آموزشگاه', 'principal', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'bbp13156', true, NOW()),
('u_deputy', '10002244', '09122223344', 'مهندس علیرضا حسینی (معاون)', 'معاونت آموزشی و پرورشی', 'deputy', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', 'deputy_pass_99', false, NOW()),
('u_101', '10003355', '09123334455', 'استاد حمید کاویانی', 'دبیر ریاضیات و هندسه', 'teacher', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', 'math_pass_123', true, NOW()),
('u_102', '10004466', '09124445566', 'سرکار خانم مریم سعیدی', 'دبیر زبان و ادبیات فارسی', 'teacher', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', 'lit_pass_456', false, NOW()),
('u_103', '10005577', '09125556677', 'دکتر بهزاد احمدی', 'دبیر فیزیک و آزمایشگاه', 'teacher', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80', 'phys_pass_789', true, NOW())
ON CONFLICT (personnel_code) DO NOTHING;

-- ۱۰. درج گروه‌ها و کانال‌های پیش‌فرض
INSERT INTO groups (id, name, description, avatar, is_announcement_only, auto_delete_hours, created_by, created_at)
VALUES
('g_announcements', 'کانال رسمی بخشنامه‌ها و اعلانات', 'کانال ارسال فوری مصوبات، بخشنامه‌های اداری و اطلاعیه‌های رسمی مدرسه', 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=150&auto=format&fit=crop&q=80', true, 0, 'u_principal', NOW()),
('g_all_teachers', 'شورای عمومی معلمان و دبیران', 'اتاق هم‌اندیشی و گفتگوی عمومی تمامی همکاران آموزشی و اداری', 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=150&auto=format&fit=crop&q=80', false, 0, 'u_principal', NOW()),
('g_science_dept', 'گروه آموزشی علوم پایه و ریاضی', 'هماهنگی آزمون‌ها، طرح درس و امتحانات هماهنگ دروس تخصصی', 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=150&auto=format&fit=crop&q=80', false, 0, 'u_principal', NOW())
ON CONFLICT (id) DO NOTHING;

-- ۱۱. عضویت کادر مدرسه در گروه‌ها
INSERT INTO group_members (group_id, user_id)
VALUES
('g_announcements', 'u_principal'),
('g_announcements', 'u_deputy'),
('g_announcements', 'u_101'),
('g_announcements', 'u_102'),
('g_announcements', 'u_103'),
('g_all_teachers', 'u_principal'),
('g_all_teachers', 'u_deputy'),
('g_all_teachers', 'u_101'),
('g_all_teachers', 'u_102'),
('g_all_teachers', 'u_103'),
('g_science_dept', 'u_principal'),
('g_science_dept', 'u_101'),
('g_science_dept', 'u_103')
ON CONFLICT DO NOTHING;

-- ۱۲. درج پیام‌های اولیه و بخشنامه نمونه
INSERT INTO messages (id, chat_id, sender_id, sender_name, sender_role, sender_avatar, content, type, is_pinned, created_at)
VALUES
('m_1', 'g_announcements', 'u_principal', 'دکتر محمد رضایی (مدیر مدرسه)', 'principal', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'همکاران گرامی و دبیران ارجمند، با سلام و آرزوی توفیق؛ لطفاً نمرات مستمر ماهانه را تا پایان هفته جاری در سامانه ثبت فرمایید.', 'circular', true, NOW()),
('m_2', 'g_all_teachers', 'u_principal', 'دکتر محمد رضایی (مدیر مدرسه)', 'principal', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'جلسه شورای معلمان روز سه‌شنبه ساعت ۱۲:۳۰ در محل سالن اجتماعات برگزار خواهد شد.', 'text', false, NOW()),
('m_3', 'g_all_teachers', 'u_101', 'استاد حمید کاویانی', 'teacher', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', 'سلام جناب دکتر رضایی، هماهنگی‌های گروه ریاضی انجام شده و گزارش پیشرفت دروس آماده ارائه می‌باشد.', 'text', false, NOW())
ON CONFLICT (id) DO NOTHING;
