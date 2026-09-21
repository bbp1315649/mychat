import React from 'react';
import { User } from '../types';
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
  ArrowRightLeft
} from 'lucide-react';

interface UserProfileProps {
  currentUser: User;
  allUsers: User[];
  onSwitchUser: (user: User) => void;
  onLogout: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  currentUser,
  allUsers,
  onSwitchUser,
  onLogout,
}) => {
  const isPrincipal = currentUser.role === 'principal';

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto p-4 space-y-4">
      {/* Profile Card */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl text-center relative overflow-hidden">
        <div className="w-20 h-20 rounded-3xl mx-auto mb-3 overflow-hidden border-2 border-slate-700 shadow-xl relative">
          <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
          <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
        </div>

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
              <span>رمز عبور شما:</span>
              <span className="font-mono text-amber-300 font-bold">{currentUser.password}</span>
            </div>
            {isPrincipal && (
              <span className="text-[10px] text-amber-400/80 font-mono">
                رمز اولیه: bbp13156
              </span>
            )}
          </div>
        </div>
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
