import React, { useState, useRef } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { 
  LogOut, 
  Crown, 
  Shield, 
  BookOpen, 
  Phone, 
  Hash, 
  Lock, 
  UserCheck, 
  Sparkles,
  ArrowRightLeft,
  Edit3,
  Camera,
  Check,
  X,
  Upload,
  Image as ImageIcon
} from 'lucide-react';

interface UserProfileProps {
  currentUser: User;
  allUsers: User[];
  onSwitchUser: (user: User) => void;
  onLogout: () => void;
  onProfileUpdated?: (updatedUser: User) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  currentUser,
  allUsers,
  onSwitchUser,
  onLogout,
  onProfileUpdated,
}) => {
  const isPrincipal = currentUser.role === 'principal';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [personnelCode, setPersonnelCode] = useState(currentUser.personnelCode);
  const [mobile, setMobile] = useState(currentUser.mobile);
  const [subject, setSubject] = useState(currentUser.subject);
  const [password, setPassword] = useState(currentUser.password);
  const [avatar, setAvatar] = useState(currentUser.avatar);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Suggested high-quality avatars for teachers / principal
  const PRESET_AVATARS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
  ];

  // Handle Photo upload from device / gallery
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('حجم تصویر نباید بیشتر از ۵ مگابایت باشد.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize to maximum 400x400 for crisp and lightweight avatar
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        setAvatar(compressedBase64);
        setErrorMsg(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanCode = personnelCode.replace(/\D/g, '').trim();
    if (cleanCode.length !== 8) {
      setErrorMsg('کد پرسنلی باید دقیقاً ۸ رقم عددی باشد');
      return;
    }

    const cleanMobile = mobile.replace(/\D/g, '').trim();
    if (cleanMobile.length !== 11 || !cleanMobile.startsWith('09')) {
      setErrorMsg('شماره همراه باید ۱۱ رقم بوده و با ۰۹ شروع شود');
      return;
    }

    if (!fullName.trim()) {
      setErrorMsg('نام و نام خانوادگی نمی‌تواند خالی باشد');
      return;
    }

    if (!password.trim()) {
      setErrorMsg('رمز عبور نمی‌تواند خالی باشد');
      return;
    }

    setSaving(true);
    try {
      const updatedUser = await api.updateProfile(currentUser.id, {
        fullName: fullName.trim(),
        personnelCode: cleanCode,
        mobile: cleanMobile,
        subject: subject.trim(),
        avatar: avatar.trim(),
        password: password.trim(),
      });

      setSuccessMsg('مشخصات و تصویر حساب کاربری با موفقیت به‌روزرسانی شد');
      if (onProfileUpdated) {
        onProfileUpdated(updatedUser);
      }
      setTimeout(() => {
        setIsEditing(false);
        setSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ذخیره‌سازی اطلاعات');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setFullName(currentUser.fullName);
    setPersonnelCode(currentUser.personnelCode);
    setMobile(currentUser.mobile);
    setSubject(currentUser.subject);
    setPassword(currentUser.password);
    setAvatar(currentUser.avatar);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsEditing(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto p-4 space-y-4">
      {/* Profile Card */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl text-center relative overflow-hidden shadow-lg">
        
        {/* Top Action / Edit Button */}
        <div className="absolute top-3 left-3 z-10">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-[11px] font-medium flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span>ویرایش مشخصات و عکس</span>
            </button>
          ) : (
            <button
              onClick={handleCancelEdit}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
              title="انصراف"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Hidden File Input for Device Photo */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoUpload}
        />

        {/* Avatar with Camera Trigger */}
        <div className="relative w-20 h-20 mx-auto mb-3">
          <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-slate-700 shadow-xl relative bg-slate-800">
            <img 
              src={isEditing ? avatar : currentUser.avatar} 
              alt={currentUser.fullName} 
              className="w-full h-full object-cover" 
            />
            <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
          </div>

          {isEditing && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -left-1 p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md border-2 border-slate-900 transition-all active:scale-95"
              title="انتخاب عکس از گوشی یا سیستم"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}
        </div>

        {!isEditing ? (
          <>
            <h2 className="text-sm font-bold text-slate-100">{currentUser.fullName}</h2>
            
            <div className="flex items-center justify-center gap-1.5 mt-1">
              {isPrincipal ? (
                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2.5 py-0.5 rounded-full font-semibold border border-amber-500/30 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-400" />
                  مدیر آموزشگاه
                </span>
              ) : currentUser.role === 'deputy' ? (
                <span className="bg-purple-500/20 text-purple-300 text-[10px] px-2.5 py-0.5 rounded-full font-semibold border border-purple-500/30 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-purple-400" />
                  معاون مدرسه
                </span>
              ) : (
                <span className="bg-blue-500/20 text-blue-300 text-[10px] px-2.5 py-0.5 rounded-full font-semibold border border-blue-500/30">
                  دبیر آموزشی
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 mt-1">{currentUser.subject}</p>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-2 mt-4 text-right">
              <div className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800/80">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                  <Hash className="w-3 h-3 text-blue-400" />
                  <span>کد پرسنلی (۸ رقم):</span>
                </div>
                <div className="font-mono text-xs font-bold text-slate-200">{currentUser.personnelCode}</div>
              </div>

              <div className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800/80">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                  <Phone className="w-3 h-3 text-emerald-400" />
                  <span>شماره همراه:</span>
                </div>
                <div className="font-mono text-xs font-bold text-slate-200">{currentUser.mobile}</div>
              </div>

              <div className="col-span-2 p-2.5 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>رمز عبور حساب:</span>
                  <span className="font-mono text-amber-300 font-bold">{currentUser.password}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Edit Form */
          <form onSubmit={handleSaveProfile} className="mt-3 text-right space-y-3">
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs text-center">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs text-center flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Quick Preset Avatars Picker */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                تصویر پروفایل:
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10 shrink-0 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 flex flex-col items-center justify-center text-[9px] gap-0.5 transition-all"
                  title="بارگذاری عکس جدید از دستگاه"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>آپلود</span>
                </button>
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatar(url)}
                    className={`w-10 h-10 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                      avatar === url ? 'border-amber-400 scale-105 shadow-md' : 'border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Full Name Input */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                نام و نام خانوادگی:
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Personnel Code Input */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                کد پرسنلی (۸ رقم):
              </label>
              <input
                type="text"
                maxLength={8}
                value={personnelCode}
                onChange={(e) => setPersonnelCode(e.target.value.replace(/\D/g, ''))}
                required
                dir="ltr"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono text-left focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Mobile Input */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                شماره همراه (۱۱ رقم با ۰۹):
              </label>
              <input
                type="text"
                maxLength={11}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                required
                dir="ltr"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono text-left focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Subject / Position */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                سمت / عنوان سازمانی:
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                رمز عبور حساب:
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono text-left focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-98 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'در حال ذخیره‌سازی...' : 'ذخیره تغییرات'}</span>
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
              >
                انصراف
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Fast User Switcher for Testing (بخش تغییر سریع کاربر برای تست چت دوطرفه) */}
      <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-3xl space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-200">سوئیچ سریع کاربر (مخصوص تست)</h3>
            <p className="text-[10px] text-slate-400">برای تست چت دوطرفه و تفاوت پنل مدیر و دبیر، یک کلیک کنید:</p>
          </div>
        </div>

        <div className="space-y-1.5">
          {Array.from(new Map(allUsers.map(u => [u.id, u])).values()).map((u) => {
            const isCurrent = u.id === currentUser.id;
            return (
              <button
                key={u.id}
                onClick={() => onSwitchUser(u)}
                disabled={isCurrent}
                className={`w-full p-2 rounded-xl border flex items-center justify-between transition-all ${
                  isCurrent
                    ? 'bg-blue-600/20 border-blue-500/50 text-slate-200 cursor-default'
                    : 'bg-slate-950 border-slate-800 hover:bg-slate-850 text-slate-300 active:scale-[0.99]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <img src={u.avatar} alt="" className="w-7 h-7 rounded-lg object-cover" />
                  <div className="text-right">
                    <div className="text-xs font-medium">{u.fullName}</div>
                    <div className="text-[10px] text-slate-500">{u.subject}</div>
                  </div>
                </div>

                {isCurrent ? (
                  <span className="text-[10px] bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full font-medium">
                    کاربر فعلی
                  </span>
                ) : (
                  <span className="text-[10px] text-indigo-400 hover:text-indigo-300">
                    ورود با این نقش ←
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Logout button */}
      <button
        onClick={onLogout}
        className="w-full py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
      >
        <LogOut className="w-4 h-4 text-rose-400" />
        <span>خروج از حساب کاربری</span>
      </button>

      <div className="text-center text-[10px] text-slate-500 pt-2">
        پیام‌رسان اختصاصی کادر آموزشی مدرسه • نگارش ویژه موبایل
      </div>
    </div>
  );
};
