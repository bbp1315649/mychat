import React, { useState } from 'react';
import { User, Group } from '../types';
import { api } from '../services/api';
import { toEnglishDigits } from '../utils/number';
import { 
  ShieldCheck, 
  KeyRound, 
  Users, 
  PlusCircle, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Check, 
  Copy, 
  Lock, 
  Phone, 
  CheckSquare, 
  Square,
  Sparkles,
  AlertCircle,
  Megaphone,
  UserPlus,
  Trash2,
  UserMinus
} from 'lucide-react';

interface AdminPanelProps {
  currentUser: User;
  users: User[];
  groups: Group[];
  onRefreshUsers: () => void;
  onRefreshGroups: () => void;
  onGroupCreated: (newGroup: Group) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  users,
  groups,
  onRefreshUsers,
  onRefreshGroups,
  onGroupCreated,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'passwords' | 'create_group' | 'members' | 'add_staff'>('passwords');

  // Password management states
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [editingPasswordFor, setEditingPasswordFor] = useState<string | null>(null);
  const [customPasswordInput, setCustomPasswordInput] = useState('');
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create group states
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupIsAnnouncement, setNewGroupIsAnnouncement] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [createGroupLoading, setCreateGroupLoading] = useState(false);
  const [createGroupSuccess, setCreateGroupSuccess] = useState<string | null>(null);

  // Group membership states
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');
  const [currentGroupMemberIds, setCurrentGroupMemberIds] = useState<string[]>(
    groups[0]?.memberIds || []
  );
  const [saveMembersLoading, setSaveMembersLoading] = useState(false);
  const [saveMembersSuccess, setSaveMembersSuccess] = useState<string | null>(null);

  // Add staff directly state
  const [directName, setDirectName] = useState('');
  const [directCode, setDirectCode] = useState('');
  const [directMobile, setDirectMobile] = useState('');
  const [directSubject, setDirectSubject] = useState('');
  const [directPassword, setDirectPassword] = useState('');
  const [addStaffLoading, setAddStaffLoading] = useState(false);
  const [addStaffMessage, setAddStaffMessage] = useState<string | null>(null);

  // Sync group member ids when selected group changes
  const handleSelectGroupForMembers = (gId: string) => {
    setSelectedGroupId(gId);
    const grp = groups.find(g => g.id === gId);
    if (grp) {
      setCurrentGroupMemberIds([...grp.memberIds]);
    }
  };

  // Toggle password visibility
  const toggleVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  // Generate / Reset password for teacher
  const handleResetPassword = async (userId: string, custom?: string) => {
    try {
      const res = await api.resetPassword(userId, custom);
      setPasswordNotice(`رمز عبور با موفقیت به «${res.newPassword}» تغییر یافت.`);
      setEditingPasswordFor(null);
      setCustomPasswordInput('');
      onRefreshUsers();
      setTimeout(() => setPasswordNotice(null), 4000);
    } catch (err: any) {
      alert(err.message || 'خطا در تغییر رمز');
    }
  };

  // Copy to clipboard
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Create Group submission
  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      alert('نام گروه الزامی است');
      return;
    }

    setCreateGroupLoading(true);
    try {
      const created = await api.createGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || 'گروه دبیران آموزشگاه',
        memberIds: selectedMemberIds,
        isAnnouncementOnly: newGroupIsAnnouncement,
      });

      onGroupCreated(created);
      setCreateGroupSuccess(`گروه «${created.name}» با موفقیت تعریف شد.`);
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupIsAnnouncement(false);
      setSelectedMemberIds([]);
      setTimeout(() => setCreateGroupSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'خطا در تعریف گروه');
    } finally {
      setCreateGroupLoading(false);
    }
  };

  // Save Group Membership
  const handleSaveMembers = async () => {
    if (!selectedGroupId) return;
    setSaveMembersLoading(true);
    try {
      await api.updateGroupMembers(selectedGroupId, currentGroupMemberIds);
      setSaveMembersSuccess('اعضای گروه با موفقیت به‌روزرسانی شدند.');
      onRefreshGroups();
      setTimeout(() => setSaveMembersSuccess(null), 3500);
    } catch (err: any) {
      alert(err.message || 'خطا در ذخیره اعضا');
    } finally {
      setSaveMembersLoading(false);
    }
  };

  // Principal removes a member directly from selected group
  // Requirement: "مدیر قابلیت حذف افراد ... از گروه را داشته باشد"
  const handleDirectRemoveMember = async (groupId: string, userId: string, userName: string) => {
    if (!window.confirm(`آیا از حذف «${userName}» از این گروه اطمینان دارید؟`)) return;
    try {
      const updatedMembers = await api.removeGroupMember(groupId, userId);
      setCurrentGroupMemberIds(updatedMembers);
      onRefreshGroups();
      setSaveMembersSuccess(`«${userName}» با موفقیت از گروه حذف شد.`);
      setTimeout(() => setSaveMembersSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message || 'خطا در حذف عضو از گروه');
    }
  };

  // User deletion state for in-app confirmation modal
  const [userToDelete, setUserToDelete] = useState<{ id: string; fullName: string } | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Principal deletes a user / cancels registration from school database
  // Requirement: "مدیر بتواند افراد و افراد پیش فرض رو حذف کند"
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      await api.deleteUser(userToDelete.id, currentUser.id);
      setPasswordNotice(`کاربر «${userToDelete.fullName}» با موفقیت از سامانه آموزشگاه حذف شد.`);
      setUserToDelete(null);
      onRefreshUsers();
      onRefreshGroups();
      setTimeout(() => setPasswordNotice(null), 4000);
    } catch (err: any) {
      setPasswordNotice(err.message || 'خطا در حذف کاربر');
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Direct Teacher Registration by Principal
  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = toEnglishDigits(directCode).replace(/\D/g, '').trim();
    const cleanMobile = toEnglishDigits(directMobile).replace(/\D/g, '').trim();

    if (!directName.trim() || cleanCode.length !== 8 || !/^09\d{9}$/.test(cleanMobile)) {
      alert('لطفاً نام کامل، کد پرسنلی ۸ رقمی و شماره موبایل ۱۱ رقمی معتبر را وارد کنید.');
      return;
    }

    setAddStaffLoading(true);
    try {
      await api.register({
        fullName: directName.trim(),
        personnelCode: cleanCode,
        mobile: cleanMobile,
        subject: directSubject.trim() || 'دبیر آموزشی',
        password: directPassword.trim() || undefined,
      });

      setAddStaffMessage(`همکار گرامی «${directName}» با موفقیت در سامانه ثبت شد.`);
      setDirectName('');
      setDirectCode('');
      setDirectMobile('');
      setDirectSubject('');
      setDirectPassword('');
      onRefreshUsers();
      setTimeout(() => setAddStaffMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت همکار');
    } finally {
      setAddStaffLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Banner */}
      <div className="p-3 bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/60 border-b border-amber-500/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-amber-300">پنل اختصاصی مدیریت آموزشگاه</h2>
              <p className="text-[10px] text-amber-400/80">
                مدیریت دبیران، گروه‌ها و رمزهای عبور همکاران
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-medium border border-amber-500/30">
            دسترسی سطح مدیر
          </span>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1 mt-3 bg-slate-950/80 p-1 rounded-xl border border-amber-500/20 text-[10px]">
          <button
            onClick={() => setActiveSubTab('passwords')}
            className={`py-1.5 px-1 rounded-lg font-medium transition-all text-center truncate ${
              activeSubTab === 'passwords'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            مشاهده و رمزها
          </button>
          <button
            onClick={() => setActiveSubTab('create_group')}
            className={`py-1.5 px-1 rounded-lg font-medium transition-all text-center truncate ${
              activeSubTab === 'create_group'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            تعریف گروه
          </button>
          <button
            onClick={() => setActiveSubTab('members')}
            className={`py-1.5 px-1 rounded-lg font-medium transition-all text-center truncate ${
              activeSubTab === 'members'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            عضویت در گروه
          </button>
          <button
            onClick={() => setActiveSubTab('add_staff')}
            className={`py-1.5 px-1 rounded-lg font-medium transition-all text-center truncate ${
              activeSubTab === 'add_staff'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ثبت دبیر جدید
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* TAB 1: PASSWORDS MANAGEMENT */}
        {activeSubTab === 'passwords' && (
          <div className="space-y-3">
            {passwordNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{passwordNotice}</span>
              </div>
            )}

            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1">
                <KeyRound className="w-3.5 h-3.5" />
                <span>مشاهده رمز و اختصاص رمز جدید برای دبیران</span>
              </div>
              <p className="text-[11px] text-slate-400">
                مدیر مدرسه می‌تواند رمز عبور جاری هر دبیر را مشاهده کند و در صورت فراموشی یا نیاز، رمز جدید تولید یا وارد کند.
              </p>
            </div>

            <div className="space-y-2">
              {users.map((u) => {
                const isUserPrincipal = u.role === 'principal';
                const isPasswordVisible = visiblePasswords[u.id];
                const isEditing = editingPasswordFor === u.id;

                return (
                  <div
                    key={u.id}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-2 relative"
                  >
                    {/* User header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={u.avatar}
                          alt=""
                          className="w-9 h-9 rounded-xl object-cover border border-slate-700"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-200">{u.fullName}</span>
                            {isUserPrincipal ? (
                              <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.2 rounded font-medium border border-amber-500/30">
                                مدیر
                              </span>
                            ) : (
                              <span className="bg-blue-500/20 text-blue-300 text-[9px] px-1.5 py-0.2 rounded font-medium border border-blue-500/30">
                                {u.subject}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span>کد پرسنلی: {u.personnelCode}</span>
                            <span>{u.mobile}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Password Box */}
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-[11px] text-slate-400">رمز عبور:</span>
                        <span className="font-mono text-xs font-bold text-amber-300 tracking-wider">
                          {isPasswordVisible ? u.password : '••••••••'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleVisibility(u.id)}
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                          title={isPasswordVisible ? 'مخفی‌سازی رمز' : 'مشاهده رمز'}
                        >
                          {isPasswordVisible ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleCopy(u.password, u.id)}
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                          title="کپی رمز عبور"
                        >
                          {copiedId === u.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Change / Reset Password Actions */}
                    {!isEditing ? (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleResetPassword(u.id)}
                          className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-[11px] font-medium rounded-xl border border-slate-700 flex items-center justify-center gap-1 transition-all"
                        >
                          <RefreshCw className="w-3 h-3 text-amber-400" />
                          <span>تولید رمز تصادفی و اختصاص</span>
                        </button>

                        <button
                          onClick={() => {
                            setEditingPasswordFor(u.id);
                            setCustomPasswordInput('');
                          }}
                          className="py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-medium rounded-xl border border-amber-500/30 transition-all"
                        >
                          تعیین رمز دلخواه
                        </button>
                      </div>
                    ) : (
                      <div className="pt-1 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={customPasswordInput}
                            onChange={(e) => setCustomPasswordInput(e.target.value)}
                            placeholder="رمز جدید را وارد کنید..."
                            className="flex-1 bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 font-mono text-left"
                            dir="ltr"
                            autoFocus
                          />
                          <button
                            onClick={() => handleResetPassword(u.id, customPasswordInput)}
                            disabled={!customPasswordInput.trim()}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl disabled:opacity-50"
                          >
                            ثبت
                          </button>
                          <button
                            onClick={() => setEditingPasswordFor(null)}
                            className="bg-slate-800 text-slate-400 text-xs px-2.5 py-1.5 rounded-xl"
                          >
                            لغو
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Admin delete staff / revoke registration (including default users) */}
                    {u.id !== currentUser.id && (
                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">مدیریت حساب و عضویت:</span>
                        <button
                          type="button"
                          onClick={() => setUserToDelete({ id: u.id, fullName: u.fullName })}
                          className="px-2.5 py-1 text-[10px] text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg flex items-center gap-1 transition-all"
                          title="حذف این کاربر از سامانه و پایگاه داده مدرسه"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>حذف کاربر از سامانه و مدرسه</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: CREATE NEW GROUP */}
        {activeSubTab === 'create_group' && (
          <form onSubmit={handleCreateGroupSubmit} className="space-y-3">
            {createGroupSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{createGroupSuccess}</span>
              </div>
            )}

            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300">
              <div className="flex items-center gap-1.5 text-blue-400 font-semibold mb-1">
                <PlusCircle className="w-3.5 h-3.5" />
                <span>تعریف و ایجاد گروه جدید در مدرسه</span>
              </div>
              <p className="text-[11px] text-slate-400">
                گروه‌های درسی، پایه، شورای انضباطی یا کانال اعلانات اختصاصی ایجاد کنید.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                نام گروه
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="مثال: گروه معلمان پایه نهم / انجمن اولیا و مربیان"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                توضیحات و هدف گروه
              </label>
              <textarea
                rows={2}
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                placeholder="هدف، دستور کار و هماهنگی‌های این گروه..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Announcement toggle */}
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">کانال اطلاع‌رسانی یک‌طرفه</div>
                  <div className="text-[10px] text-slate-400">فقط مدیر و معاون مجاز به ارسال پیام باشند</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={newGroupIsAnnouncement}
                onChange={(e) => setNewGroupIsAnnouncement(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            {/* Members Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-slate-300">
                  انتخاب اعضای اولیه گروه ({selectedMemberIds.length} نفر انتخاب شده)
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

              <div className="max-h-48 overflow-y-auto space-y-1.5 bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                {users.map((u) => {
                  const isSelected = selectedMemberIds.includes(u.id);
                  const isUserPrincipal = u.role === 'principal';

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
                      className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500/50 text-slate-100'
                          : 'bg-slate-900 border-slate-800/80 text-slate-400 hover:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <img src={u.avatar} alt="" className="w-6 h-6 rounded-lg object-cover" />
                        <div>
                          <div className="text-xs font-medium text-slate-200">
                            {u.fullName}
                            {isUserPrincipal && ' (مدیر)'}
                          </div>
                          <div className="text-[10px] text-slate-500">{u.subject}</div>
                        </div>
                      </div>

                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={createGroupLoading || !newGroupName.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {createGroupLoading ? 'در حال ایجاد گروه...' : 'تأیید و ایجاد گروه جدید'}
            </button>
          </form>
        )}

        {/* TAB 3: GROUP MEMBERS MANAGEMENT */}
        {activeSubTab === 'members' && (
          <div className="space-y-3">
            {saveMembersSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{saveMembersSuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                انتخاب گروه جهت ویرایش و عضویت افراد:
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => handleSelectGroupForMembers(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.memberIds.length} عضو)
                  </option>
                ))}
              </select>
            </div>

            {/* Checklist of all teachers */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-slate-300">
                  فهرست دبیران و وضعیت عضویت در این گروه:
                </label>
                <span className="text-[10px] text-amber-400 font-mono">
                  {currentGroupMemberIds.length} عضو فعال
                </span>
              </div>

              <div className="space-y-1.5 max-h-[380px] overflow-y-auto">
                {users.map((u) => {
                  const isMember = currentGroupMemberIds.includes(u.id);
                  const isUserPrincipal = u.role === 'principal';

                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        if (isUserPrincipal) return; // Principal always in group
                        if (isMember) {
                          setCurrentGroupMemberIds(prev => prev.filter(id => id !== u.id));
                        } else {
                          setCurrentGroupMemberIds(prev => [...prev, u.id]);
                        }
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        isUserPrincipal
                          ? 'bg-amber-500/10 border-amber-500/30 cursor-default'
                          : isMember
                            ? 'bg-emerald-600/15 border-emerald-500/40 cursor-pointer'
                            : 'bg-slate-900 border-slate-800/80 hover:bg-slate-850 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <img src={u.avatar} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        <div>
                          <div className="text-xs font-semibold text-slate-200">
                            {u.fullName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {u.subject} | کد: {u.personnelCode}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isUserPrincipal ? (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-medium">
                            مدیر دائم
                          </span>
                        ) : isMember ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              عضو است
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDirectRemoveMember(selectedGroupId, u.id, u.fullName);
                              }}
                              className="rounded-lg text-rose-300 hover:text-rose-200 hover:bg-rose-500/25 transition-all text-[10px] flex items-center gap-1 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5"
                              title="حذف فوری این دبیر از گروه جاری"
                            >
                              <UserMinus className="w-3 h-3" />
                              <span>حذف از گروه</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                            غیرعضو (کلیک جهت افزودن)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleSaveMembers}
              disabled={saveMembersLoading}
              className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 font-bold text-xs py-2.5 rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              {saveMembersLoading ? 'در حال ذخیره اعضا...' : 'ذخیره و به‌روزرسانی عضویت گروه'}
            </button>
          </div>
        )}

        {/* TAB 4: ADD STAFF DIRECTLY */}
        {activeSubTab === 'add_staff' && (
          <form onSubmit={handleAddStaffSubmit} className="space-y-3">
            {addStaffMessage && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{addStaffMessage}</span>
              </div>
            )}

            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                <UserPlus className="w-3.5 h-3.5" />
                <span>ثبت مشخصات همکار توسط مدیر</span>
              </div>
              <p className="text-[11px] text-slate-400">
                می‌توانید اطلاعات همکار را مستقیم با کد پرسنلی ۸ رقمی و شماره موبایل ثبت کنید.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                نام و نام خانوادگی همکار
              </label>
              <input
                type="text"
                value={directName}
                onChange={(e) => setDirectName(e.target.value)}
                placeholder="مثال: دکتر کیوان شمس"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                کد پرسنلی (دقیقاً ۸ رقم)
              </label>
              <input
                type="text"
                maxLength={8}
                value={directCode}
                onChange={(e) => setDirectCode(toEnglishDigits(e.target.value).replace(/\D/g, ''))}
                placeholder="مثال: 49821035"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                شماره تلفن همراه (۱۱ رقم با ۰۹)
              </label>
              <input
                type="text"
                maxLength={11}
                value={directMobile}
                onChange={(e) => setDirectMobile(toEnglishDigits(e.target.value).replace(/\D/g, ''))}
                placeholder="مثال: 09121234567"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                درس تدریسی / سمت همکار
              </label>
              <input
                type="text"
                value={directSubject}
                onChange={(e) => setDirectSubject(e.target.value)}
                placeholder="مثال: دبیر زیست‌شناسی و زمین‌شناسی"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                رمز عبور اولیه (در صورت خالی بودن خودکار تولید می‌شود)
              </label>
              <input
                type="text"
                value={directPassword}
                onChange={(e) => setDirectPassword(e.target.value)}
                placeholder="مثال: teach_442"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-left"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={addStaffLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs py-2.5 rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              {addStaffLoading ? 'در حال ثبت همکار...' : 'ثبت همکار در سامانه'}
            </button>
          </form>
        )}

        {/* Modal for User Deletion Confirmation (No window.confirm, safe for all iframes) */}
        {userToDelete && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-100">تأیید حذف همکار از سامانه</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  آیا از حذف کامل «<span className="font-bold text-slate-200">{userToDelete.fullName}</span>» از پایگاه داده و سامانه مدرسه اطمینان دارید؟
                </p>
                <p className="text-[11px] text-slate-500">
                  تمامی گفتگوهای دوطرفه، دسترسی‌ها و عضویت‌های این کاربر حذف خواهند شد.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmDeleteUser}
                  disabled={isDeletingUser}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingUser ? 'در حال حذف...' : 'تأیید و حذف نهایی'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  disabled={isDeletingUser}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
