import React from 'react';
import { MessageSquare, Users, ShieldAlert, UserCheck } from 'lucide-react';
import { User } from '../types';

export type TabType = 'chats' | 'groups' | 'staff' | 'admin' | 'profile';

interface BottomNavProps {
  currentTab: TabType;
  onChangeTab: (tab: TabType) => void;
  currentUser: User;
  unreadCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onChangeTab,
  currentUser,
  unreadCount = 0,
}) => {
  const isPrincipal = currentUser.role === 'principal';

  return (
    <div className="flex flex-col shrink-0 z-30 select-none">
      <div className="h-14 bg-slate-900/95 backdrop-blur border-t border-slate-800/80 px-2 flex items-center justify-around">
        {/* Chats */}
        <button
          onClick={() => onChangeTab('chats')}
          className={`flex flex-col items-center justify-center flex-1 py-1 relative transition-colors ${
            currentTab === 'chats' ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-blue-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5">گفتگوها</span>
        </button>

        {/* Staff Directory */}
        <button
          onClick={() => onChangeTab('staff')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            currentTab === 'staff' ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">همکاران</span>
        </button>

        {/* Admin Panel (Principal exclusive) */}
        <button
          onClick={() => onChangeTab('admin')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
            currentTab === 'admin' 
              ? 'text-amber-400 font-semibold' 
              : isPrincipal 
                ? 'text-amber-400/70 hover:text-amber-300' 
                : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <ShieldAlert className="w-5 h-5" />
            {isPrincipal && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 flex items-center gap-0.5">
            پنل مدیر
          </span>
        </button>

        {/* Profile & Switcher */}
        <button
          onClick={() => onChangeTab('profile')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            currentTab === 'profile' ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-600 flex items-center justify-center bg-slate-800">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <UserCheck className="w-3.5 h-3.5" />
            )}
          </div>
          <span className="text-[10px] mt-0.5">پروفایل من</span>
        </button>
      </div>

      {/* Footer Creator Text */}
      <div className="py-1 bg-slate-950/95 border-t border-slate-900 text-center text-[10px] text-slate-400 font-medium select-text">
        (  سازنده: بابک بهرامی پور )
      </div>
    </div>
  );
};
