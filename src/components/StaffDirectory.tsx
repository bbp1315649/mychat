import React, { useState, useMemo } from 'react';
import { User } from '../types';
import { Search, MessageSquare, BookOpen, Crown, Shield, Trash2, X, Sparkles, Filter, Check } from 'lucide-react';
import { api } from '../services/api';

interface StaffDirectoryProps {
  users: User[];
  currentUser: User;
  onSelectUserForChat: (user: User) => void;
  onUserDeleted?: () => void;
}

// Persian text normalization helper for smooth live search matching
const normalizeText = (str: string = ''): string => {
  return str
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u200C/g, ' ')
    .trim();
};

// Substring match highlighter for instant visual feedback during live search
const HighlightMatch: React.FC<{ text: string; query: string; className?: string }> = ({
  text,
  query,
  className = '',
}) => {
  const trimmed = query.trim();
  if (!trimmed || !text) return <span className={className}>{text}</span>;

  const normText = normalizeText(text);
  const normQuery = normalizeText(trimmed);
  const idx = normText.indexOf(normQuery);

  if (idx === -1) return <span className={className}>{text}</span>;

  const start = Math.max(0, idx);
  const end = Math.min(text.length, start + trimmed.length);

  return (
    <span className={className}>
      {text.substring(0, start)}
      <mark className="bg-amber-400/30 text-amber-200 font-bold px-1 py-0.5 rounded">
        {text.substring(start, end)}
      </mark>
      {text.substring(end)}
    </span>
  );
};

export const StaffDirectory: React.FC<StaffDirectoryProps> = ({
  users,
  currentUser,
  onSelectUserForChat,
  onUserDeleted,
}) => {
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [userToDelete, setUserToDelete] = useState<{ id: string; fullName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const isCurrentUserPrincipal = currentUser.role === 'principal';

  // Extract unique subjects for instant category chips
  const uniqueSubjects = useMemo(() => {
    const set = new Set<string>();
    users.forEach(u => {
      if (u.subject && u.subject.trim()) {
        set.add(u.subject.trim());
      }
    });
    return Array.from(set);
  }, [users]);

  // Live filter computation
  const filtered = useMemo(() => {
    const normQ = normalizeText(search);

    return users.filter(u => {
      // Filter by subject tag if selected
      if (selectedSubject !== 'all' && u.subject !== selectedSubject) {
        return false;
      }

      if (!normQ) return true;

      const normName = normalizeText(u.fullName);
      const normSubj = normalizeText(u.subject);
      const normCode = normalizeText(u.personnelCode);
      const normMobile = normalizeText(u.mobile);

      return (
        normName.includes(normQ) ||
        normSubj.includes(normQ) ||
        normCode.includes(normQ) ||
        normMobile.includes(normQ)
      );
    });
  }, [users, search, selectedSubject]);

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteUser(userToDelete.id, currentUser.id);
      setStatusNotice(`کاربر «${userToDelete.fullName}» با موفقیت از سامانه حذف شد.`);
      setUserToDelete(null);
      if (onUserDeleted) onUserDeleted();
      setTimeout(() => setStatusNotice(null), 3500);
    } catch (err: any) {
      alert(err.message || 'خطا در حذف کاربر');
    } finally {
      setIsDeleting(false);
    }
  };

  const hasActiveFilter = search.trim().length > 0 || selectedSubject !== 'all';

  const handleClearFilters = () => {
    setSearch('');
    setSelectedSubject('all');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Live Search & Directory Header */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 shrink-0 space-y-2.5">
        {/* Title & Live Status Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-100">فهرست دبیران و کادر آموزشی</h2>
            <span className="bg-slate-800 text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded-full">
              {users.length} نفر
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>جستجوی زنده</span>
          </div>
        </div>

        {/* Live Search Input Box */}
        <div className="relative flex items-center">
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <Search className="w-4 h-4 text-blue-400" />
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی زنده بر اساس نام دبیر یا عنوان درس (مثلاً ریاضی، ادبیات، فیزیک)..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 rounded-xl pr-9 pl-9 py-2 text-xs text-slate-100 placeholder:text-slate-500 transition-all outline-none"
            dir="rtl"
          />

          {search.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="پاک کردن جستجو"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Subject Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
          <button
            type="button"
            onClick={() => setSelectedSubject('all')}
            className={`px-2.5 py-1 rounded-xl shrink-0 transition-all text-[11px] font-medium ${
              selectedSubject === 'all'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            همه ({users.length})
          </button>

          {uniqueSubjects.map((subj) => {
            const isSelected = selectedSubject === subj;
            const count = users.filter(u => u.subject === subj).length;
            return (
              <button
                key={subj}
                type="button"
                onClick={() => setSelectedSubject(isSelected ? 'all' : subj)}
                className={`px-2.5 py-1 rounded-xl shrink-0 transition-all text-[11px] flex items-center gap-1 ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/60'
                }`}
              >
                <span>{subj}</span>
                <span className="text-[9px] font-mono opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Live match counter indicator */}
        {hasActiveFilter && (
          <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5 pt-0.5">
            <div className="flex items-center gap-1">
              <span>یافت شد:</span>
              <strong className="text-emerald-400 font-mono font-bold">{filtered.length}</strong>
              <span>نفر از کل {users.length} همکار</span>
            </div>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-0.5"
            >
              <span>بازنشانی فیلتر</span>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Directory List or Empty State */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
              <Search className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-xs font-bold text-slate-200 mb-1">همکاری با این مشخصات یافت نشد</h3>
            <p className="text-[11px] text-slate-400 max-w-xs mb-3 leading-relaxed">
              {search.trim()
                ? `هیچ دبیری با نام، درس یا کد مطابق با «${search}» پیدا نشد.`
                : 'در دسته‌بندی انتخاب‌شده دبیری ثبت نشده است.'}
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95"
            >
              نمایش همه همکاران
            </button>
          </div>
        ) : (
          filtered.map((user) => {
            const isMe = user.id === currentUser.id;
            const isPrincipal = user.role === 'principal';
            const isDeputy = user.role === 'deputy';

            return (
              <div
                key={user.id}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                  isMe
                    ? 'bg-blue-950/20 border-blue-500/30'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={user.avatar}
                      alt={user.fullName}
                      className="w-11 h-11 rounded-2xl object-cover border border-slate-700"
                    />
                    {user.isOnline ? (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                    ) : (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-slate-600 border-2 border-slate-900 rounded-full" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <HighlightMatch
                        text={user.fullName}
                        query={search}
                        className="text-xs font-bold text-slate-200 truncate"
                      />
                      {isPrincipal && (
                        <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.2 rounded font-medium border border-amber-500/30 flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5" />
                          مدیر
                        </span>
                      )}
                      {isDeputy && (
                        <span className="bg-purple-500/20 text-purple-300 text-[9px] px-1.5 py-0.2 rounded font-medium border border-purple-500/30 flex items-center gap-0.5">
                          <Shield className="w-2.5 h-2.5" />
                          معاون
                        </span>
                      )}
                      {isMe && (
                        <span className="bg-blue-500/20 text-blue-300 text-[9px] px-1 rounded font-medium">
                          شما
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1 text-slate-300">
                        <BookOpen className="w-3 h-3 text-blue-400 shrink-0" />
                        <HighlightMatch text={user.subject} query={search} className="text-slate-300" />
                      </span>
                      <span>•</span>
                      <span className="font-mono">{user.mobile}</span>
                    </div>

                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      کد پرسنلی: {user.personnelCode}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                {!isMe && (
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {isCurrentUserPrincipal && (
                      <button
                        type="button"
                        onClick={() => setUserToDelete({ id: user.id, fullName: user.fullName })}
                        className="bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-400 p-2 rounded-xl border border-rose-500/30 transition-all"
                        title="حذف همکار از سامانه و مدرسه"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectUserForChat(user)}
                      className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white p-2 rounded-xl shadow-md shadow-blue-500/20 transition-all"
                      title="گفتگوی مستقیم"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-100">تأیید حذف همکار از سامانه</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                آیا از حذف کامل «<span className="font-bold text-slate-200">{userToDelete.fullName}</span>» از سامانه آموزشگاه اطمینان دارید؟
              </p>
              <p className="text-[11px] text-slate-500">
                با حذف این کاربر، دسترسی‌ها و پیام‌های شخصی او لغو خواهد شد.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'در حال حذف...' : 'تأیید و حذف'}</span>
              </button>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {statusNotice && (
        <div className="p-2.5 bg-emerald-500/15 border-t border-emerald-500/30 text-emerald-300 text-xs text-center">
          {statusNotice}
        </div>
      )}
    </div>
  );
};
