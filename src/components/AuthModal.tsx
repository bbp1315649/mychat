import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { toEnglishDigits } from '../utils/number';
import { 
  School, 
  KeyRound, 
  Phone, 
  User as UserIcon, 
  BookOpen, 
  Lock, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  // Login fields
  const [personnelCode, setPersonnelCode] = useState('');
  const [password, setPassword] = useState('');
  
  // Register fields
  const [regFullName, setRegFullName] = useState('');
  const [regPersonnelCode, setRegPersonnelCode] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regSubject, setRegSubject] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = toEnglishDigits(personnelCode).replace(/\D/g, '').trim();
    const cleanPass = password.trim();

    if (!cleanCode || !cleanPass) {
      setError('لطفاً کد پرسنلی و رمز عبور را وارد کنید.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const user = await api.login(cleanCode, cleanPass);
      onSuccess(user);
    } catch (err: any) {
      setError(err.message || 'خطا در ورود به سامانه');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPersonnelCode = toEnglishDigits(regPersonnelCode).replace(/\D/g, '').trim();
    const cleanMobile = toEnglishDigits(regMobile).replace(/\D/g, '').trim();

    if (!regFullName.trim() || !cleanPersonnelCode || !cleanMobile) {
      setError('نام، کد پرسنلی ۸ رقمی و شماره همراه الزامی است.');
      return;
    }

    if (cleanPersonnelCode.length !== 8 || !/^\d{8}$/.test(cleanPersonnelCode)) {
      setError('کد پرسنلی باید دقیقاً ۸ رقم عددی باشد.');
      return;
    }

    if (!/^09\d{9}$/.test(cleanMobile)) {
      setError('شماره موبایل نامعتبر است (باید با ۰۹ شروع شده و ۱۱ رقم باشد).');
      return;
    }

    setLoading(true);
    try {
      const user = await api.register({
        fullName: regFullName.trim(),
        personnelCode: cleanPersonnelCode,
        mobile: cleanMobile,
        subject: regSubject.trim() || 'دبیر آموزشی',
        password: regPassword.trim() || undefined,
      });
      onSuccess(user);
    } catch (err: any) {
      setError(err.message || 'خطا در ثبت‌نام');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between overflow-y-auto p-4 bg-slate-950 text-slate-100">
      {/* Header Banner */}
      <div className="flex flex-col items-center text-center mt-2 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-3 border border-indigo-400/30">
          <School className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-lg font-bold text-slate-100">پیام‌رسان کادر آموزشی مدرسه</h1>
        <p className="text-xs text-slate-400 mt-1">ارتباط مستقیم مدیریت با دبیران و همکاران</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 mb-4">
        <button
          type="button"
          onClick={() => { setTab('login'); setError(null); }}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
            tab === 'login'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ورود به سامانه
        </button>
        <button
          type="button"
          onClick={() => { setTab('register'); setError(null); }}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
            tab === 'register'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ثبت‌نام همکار جدید
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Login Tab */}
      {tab === 'login' && (
        <form onSubmit={handleLoginSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              کد پرسنلی (۸ رقم)
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={8}
                value={personnelCode}
                onChange={(e) => setPersonnelCode(toEnglishDigits(e.target.value).replace(/\D/g, ''))}
                placeholder="مثال: 20859009"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors pr-9 text-left font-mono"
                dir="ltr"
              />
              <UserIcon className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              رمز عبور
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="رمز عبور خود را وارد کنید"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors pr-9 text-left font-mono"
                dir="ltr"
              />
              <KeyRound className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs py-2.5 rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'در حال ورود...' : 'ورود به حساب کاربری'}
          </button>

          {/* Footer note */}
          <div className="mt-4 pt-4 border-t border-slate-800/80 text-center">
            <span className="text-[11px] text-slate-500">
              دبیران گرامی، رمز عبور اولیه توسط مدیریت آموزشگاه به شما تحویل داده می‌شود.
            </span>
          </div>
        </form>
      )}

      {/* Register Tab */}
      {tab === 'register' && (
        <form onSubmit={handleRegisterSubmit} className="space-y-2.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-0.5">
              نام و نام خانوادگی
            </label>
            <div className="relative">
              <input
                type="text"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                placeholder="مثال: زهرا مرادی"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-0.5">
              کد پرسنلی (دقیقاً ۸ رقم عددی)
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={8}
                value={regPersonnelCode}
                onChange={(e) => setRegPersonnelCode(toEnglishDigits(e.target.value).replace(/\D/g, ''))}
                placeholder="مثال: 56781234"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono text-left"
                dir="ltr"
              />
              <span className="text-[10px] text-slate-500 absolute left-3 top-2.5 font-mono">
                {regPersonnelCode.length}/8
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-0.5">
              شماره تلفن همراه (۱۱ رقم با ۰۹)
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={11}
                value={regMobile}
                onChange={(e) => setRegMobile(toEnglishDigits(e.target.value).replace(/\D/g, ''))}
                placeholder="مثال: 09123456789"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono text-left"
                dir="ltr"
              />
              <Phone className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-0.5">
              درس تدریسی / عنوان شغلی
            </label>
            <div className="relative">
              <input
                type="text"
                value={regSubject}
                onChange={(e) => setRegSubject(e.target.value)}
                placeholder="مثال: دبیر زبان انگلیسی / علوم تجربی"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <BookOpen className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-0.5">
              رمز عبور دلخواه (اختیاری)
            </label>
            <div className="relative">
              <input
                type="text"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="در صورت خالی ماندن، رمز خودکار تولید می‌شود"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono text-left"
                dir="ltr"
              />
              <Lock className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>پس از ثبت‌نام، مدیر مدرسه می‌تواند رمز شما را مشاهده کرده و در صورت نیاز رمز جدید اختصاص دهد.</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'در حال ثبت‌نام...' : 'تکمیل ثبت‌نام و ورود'}
          </button>
        </form>
      )}

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 text-center text-[10px] text-slate-500">
        سامانه هوشمند ارتباطی مدرسه • طراحی اختصاصی صفحه موبایل
      </div>
    </div>
  );
};
