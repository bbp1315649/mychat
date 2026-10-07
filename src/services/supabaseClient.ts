import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  'https://cbsawpifhwdncirigfhk.supabase.co';

const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNic2F3cGlmaHdkbmNpcmlnZmhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMDkxNzMsImV4cCI6MjEwNTU4NTE3M30.Usux2j1l7dkkCYBZ3NOCXVmZ7IA5XLztHZiphhSSB8g';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
