import React, { useState } from 'react';
import { User } from '../types';
import { Search, MessageSquare, Phone, BookOpen, Crown, Shield } from 'lucide-react';

interface StaffDirectoryProps {
  users: User[];
  currentUser: User;
  onSelectUserForChat: (user: User) => void;
}

export const StaffDirectory: React.FC<StaffDirectoryProps> = ({
  users,
  currentUser,
  onSelectUserForChat,
}) => {
  const [search, setSearch] = useState('');

  const filtered = users.filter(u => 
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.subject.toLowerCase().includes(search.toLowerCase()) ||
    u.personnelCode.includes(search) ||
    u.mobile.includes(search)
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <h2 className="text-xs font-bold text-slate-100 mb-2">فهرست دبیران و کادر آموزشی</h2>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو بر اساس نام، درس تدریسی، یا کد پرسنلی..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 pr-8"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Directory List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.map((user) => {
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
                    <h3 className="text-xs font-bold text-slate-200 truncate">
                      {user.fullName}
                    </h3>
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
                      <BookOpen className="w-3 h-3 text-blue-400" />
                      {user.subject}
                    </span>
                    <span>•</span>
                    <span className="font-mono">{user.mobile}</span>
                  </div>

                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    کد پرسنلی: {user.personnelCode}
                  </div>
                </div>
              </div>

              {/* Chat action button */}
              {!isMe && (
                <button
                  onClick={() => onSelectUserForChat(user)}
                  className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white p-2 rounded-xl shadow-md shadow-blue-500/20 transition-all shrink-0 ml-2"
                  title="گفتگوی مستقیم"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
