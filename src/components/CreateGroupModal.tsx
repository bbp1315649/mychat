import React, { useState } from 'react';
import { User, Group } from '../types';
import { api } from '../services/api';
import { X, Users, Megaphone, CheckSquare, Square, Plus } from 'lucide-react';

interface CreateGroupModalProps {
  users: User[];
  onClose: () => void;
  onCreated: (group: Group) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  users,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isAnnouncementOnly, setIsAnnouncementOnly] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const group = await api.createGroup({
        name: name.trim(),
        description: description.trim() || 'گروه گفتگوی کادر مدرسه',
        memberIds: selectedMemberIds,
        isAnnouncementOnly,
      });
      onCreated(group);
      onClose();
    } catch (err: any) {
      alert(err.message || 'خطا در ایجاد گروه');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 animate-fade-in">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-100">تعریف گروه جدید در آموزشگاه</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-3 space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              نام گروه
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: شورای معلمان پایه دهم"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              توضیحات مختصر
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="هدف و دستور کار این گروه..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Announcement toggle */}
          <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-[11px] font-semibold text-slate-200">کانال اعلان رسمی یک‌طرفه</div>
                <div className="text-[9px] text-slate-400">فقط مدیر مجاز به ارسال پیام است</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isAnnouncementOnly}
              onChange={(e) => setIsAnnouncementOnly(e.target.checked)}
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
            />
          </div>

          {/* Members Checklist */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-slate-300">
                عضویت دبیران ({selectedMemberIds.length} انتخاب شده)
              </label>
              <button
                type="button"
                onClick={() => {
                  if (selectedMemberIds.length === users.length) {
                    setSelectedMemberIds([]);
                  } else {
                    setSelectedMemberIds(users.map(u => u.id));
                  }
                }}
                className="text-[10px] text-blue-400 hover:text-blue-300"
              >
                {selectedMemberIds.length === users.length ? 'لغو انتخاب همه' : 'انتخاب همه'}
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              {users.map((u) => {
                const isSelected = selectedMemberIds.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedMemberIds(prev => prev.filter(id => id !== u.id));
                      } else {
                        setSelectedMemberIds(prev => [...prev, u.id]);
                      }
                    }}
                    className={`p-1.5 rounded-lg border flex items-center justify-between cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500/50 text-slate-200'
                        : 'border-slate-800/60 text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <img src={u.avatar} alt="" className="w-5 h-5 rounded-md object-cover" />
                      <span className="text-[11px]">{u.fullName} ({u.subject})</span>
                    </div>
                    {isSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 active:scale-98 transition-all disabled:opacity-50"
          >
            {loading ? 'در حال ایجاد...' : 'ثبت و تعریف گروه'}
          </button>
        </form>
      </div>
    </div>
  );
};
