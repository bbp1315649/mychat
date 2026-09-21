import React, { useState, useRef } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { 
  LogOut, 
  Crown, 
  Shield, 
  Phone, 
  Hash, 
  Lock, 
  Edit3,
  Camera,
  Check,
  X,
  Upload,
  ArrowRight,
  Eye,
  EyeOff,
  User as UserIcon,
  Briefcase
} from 'lucide-react';

interface UserProfileProps {
  currentUser: User;
  onLogout: () => void;
  onProfileUpdated?: (updatedUser: User) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  currentUser,
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
  const [showPassword, setShowPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // High-quality preset avatars
  const PRESET_AVATARS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80',
  ];

  // Handle Photo upload from device / gallery
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('حجم تصویر نباید بیشتر از ۵ مگابایت باشد.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
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

      setSuccessMsg('مشخصات و تصویر با موفقیت ذخیره شدند');
      if (onProfileUpdated) {
        onProfileUpdated(updatedUser);
      }
      setTimeout(() => {
        setIsEditing(false);
        setSuccessMsg(null);
      }, 1000);
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

  // FULL-SCREEN EDIT VIEW
  if (isEditing) {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden relative">
        {/* Fixed Header */}
        <div className="p-3 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancelEdit}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors active:scale-95"
              title="بازگشت"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>ویرایش مشخصات و عکس</span>
              </h2>
              <p className="text-[10px] text-slate-400">اطلاعات کاربری مدیر آموزشگاه</p>
            </div>
          </div>

          <button
            onClick={handleCancelEdit}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body with ample padding */}
        <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs text-center leading-relaxed">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs text-center flex items-center justify-center gap-1.5 font-medium">
              <Check className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Avatar Section */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-3 shadow-md">
            <label className="block text-xs font-semibold text-slate-300">
              تصویر و عکس پروفایل
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />

            <div className="relative w-24 h-24 mx-auto">
              <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-amber-500/60 shadow-xl bg-slate-800">
                <img 
                  src={avatar} 
                  alt="پیش‌نمایش تصویر" 
                  className="w-full h-full object-cover" 
                />
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -left-1 p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg border-2 border-slate-900 transition-transform active:scale-90"
                title="انتخاب تصویر از گوشی"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Choose from device button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-2xl text-xs font-semibold text-amber-300 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <Upload className="w-4 h-4 text-amber-400" />
              <span>انتخاب عکس از گالری گوشی یا سیستم</span>
            </button>

            {/* Preset avatars selection */}
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400 block mb-2 text-right">یا انتخاب از تصاویر پیشنهادی آماده:</span>
              <div className="grid grid-cols-6 gap-2">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatar(url)}
                    className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
                      avatar === url 
                        ? 'border-amber-400 ring-2 ring-amber-400/30 scale-105 shadow-lg' 
                        : 'border-slate-800 opacity-70 hover:opacity-100 hover:border-slate-600'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form Fields Card */}
          <form id="profile-edit-form" onSubmit={handleSaveProfile} className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-3.5 shadow-md">
            {/* Full Name */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5 text-right">
                <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                <span>نام و نام خانوادگی:</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="مثال: دکتر محمد رضایی"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
              />
            </div>

            {/* Personnel Code */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5 text-right">
                <Hash className="w-3.5 h-3.5 text-indigo-400" />
                <span>کد پرسنلی (۸ رقم عددی):</span>
              </label>
              <input
                type="text"
                maxLength={8}
                value={personnelCode}
                onChange={(e) => setPersonnelCode(e.target.value.replace(/\D/g, ''))}
                required
                dir="ltr"
                placeholder="20859009"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-3.5 py-2.5 text-xs text-slate-100 font-mono text-left placeholder:text-slate-600 focus:outline-none transition-colors"
              />
            </div>

            {/* Mobile */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5 text-right">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>شماره تلفن همراه (۱۱ رقم):</span>
              </label>
              <input
                type="text"
                maxLength={11}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                required
                dir="ltr"
                placeholder="09121112233"
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-2xl px-3.5 py-2.5 text-xs text-slate-100 font-mono text-left placeholder:text-slate-600 focus:outline-none transition-colors"
              />
            </div>

            {/* Subject / Role title */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5 text-right">
                <Briefcase className="w-3.5 h-3.5 text-purple-400" />
                <span>سمت / عنوان در آموزشگاه:</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                placeholder="مثال: مدیر آموزشگاه"
                className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5 text-right">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>رمز عبور حساب:</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  dir="ltr"
                  placeholder="رمز عبور"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-3.5 py-2.5 text-xs text-amber-300 font-mono text-left placeholder:text-slate-600 focus:outline-none transition-colors pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Bottom Floating Sticky Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-slate-900/95 border-t border-slate-800 backdrop-blur flex items-center gap-2 z-20 shadow-2xl">
          <button
            type="submit"
            form="profile-edit-form"
            disabled={saving}
            className="flex-1 py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{saving ? 'در حال ثبت تغییرات...' : 'ذخیره تغییرات مشخصات'}</span>
          </button>

          <button
            type="button"
            onClick={handleCancelEdit}
            disabled={saving}
            className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            انصراف
          </button>
        </div>
      </div>
    );
  }

  // STANDARD PROFILE VIEW
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto p-4 space-y-4 pb-20">
      {/* Profile Card */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl text-center relative overflow-hidden shadow-lg space-y-3">
        {/* Avatar */}
        <div className="w-24 h-24 rounded-3xl mx-auto overflow-hidden border-2 border-amber-500/60 shadow-xl relative bg-slate-800">
          <img src={currentUser.avatar} alt={currentUser.fullName} className="w-full h-full object-cover" />
          <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
        </div>

        <div>
          <h2 className="text-base font-bold text-slate-100">{currentUser.fullName}</h2>
          
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            {isPrincipal ? (
              <span className="bg-amber-500/20 text-amber-300 text-xs px-3 py-0.5 rounded-full font-bold border border-amber-500/30 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                مدیر آموزشگاه
              </span>
            ) : currentUser.role === 'deputy' ? (
              <span className="bg-purple-500/20 text-purple-300 text-xs px-3 py-0.5 rounded-full font-bold border border-purple-500/30 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                معاون مدرسه
              </span>
            ) : (
              <span className="bg-blue-500/20 text-blue-300 text-xs px-3 py-0.5 rounded-full font-semibold border border-blue-500/30">
                دبیر آموزشی
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 mt-1">{currentUser.subject}</p>
        </div>

        {/* Big Edit Button */}
        <button
          onClick={() => setIsEditing(true)}
          className="w-full py-2.5 px-4 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-sm"
        >
          <Edit3 className="w-4 h-4 text-amber-400" />
          <span>ویرایش مشخصات و تغییر عکس پروفایل</span>
        </button>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-2 text-right pt-2 border-t border-slate-800/80">
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
              <Hash className="w-3.5 h-3.5 text-blue-400" />
              <span>کد پرسنلی:</span>
            </div>
            <div className="font-mono text-xs font-bold text-slate-100">{currentUser.personnelCode}</div>
          </div>

          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>شماره همراه:</span>
            </div>
            <div className="font-mono text-xs font-bold text-slate-100">{currentUser.mobile}</div>
          </div>

          <div className="col-span-2 p-3 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>رمز عبور حساب:</span>
            </div>
            <span className="font-mono text-amber-300 font-bold text-xs">••••••••</span>
          </div>
        </div>
      </div>

      {/* Logout button */}
      <button
        onClick={onLogout}
        className="w-full py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
      >
        <LogOut className="w-4 h-4 text-rose-400" />
        <span>خروج از حساب کاربری</span>
      </button>

      <div className="text-center text-[10px] text-slate-500 pt-2">
        پیام‌رسان اختصاصی کادر آموزشی مدرسه • امنیت و حریم خصوصی محفوظ
      </div>
    </div>
  );
};
