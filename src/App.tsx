import React, { useState, useEffect } from 'react';
import { User, Group, Message } from './types';
import { api, realtime } from './services/api';
import { MobileFrame } from './components/MobileFrame';
import { AuthModal } from './components/AuthModal';
import { ChatList } from './components/ChatList';
import { ChatRoom } from './components/ChatRoom';
import { AdminPanel } from './components/AdminPanel';
import { StaffDirectory } from './components/StaffDirectory';
import { UserProfile } from './components/UserProfile';
import { BottomNav, TabType } from './components/BottomNav';
import { CreateGroupModal } from './components/CreateGroupModal';
import { ArrowRightLeft, Crown, Sparkles, LogOut, UserPlus } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTab, setCurrentTab] = useState<TabType>('chats');
  const [activeChat, setActiveChat] = useState<{
    id: string;
    title: string;
    avatar: string;
    isGroup: boolean;
    groupData?: Group;
    directUser?: User;
  } | null>(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Load initial users and groups
  const loadData = async (userObj?: User) => {
    try {
      const uList = await api.getUsers();
      setUsers(uList);

      const targetUser = userObj || currentUser;
      const gList = await api.getGroups(targetUser?.id);
      setGroups(gList);

      // Load initial messages for groups
      const allMsgs: Message[] = [];
      for (const g of gList) {
        const gMsgs = await api.getMessages(g.id);
        allMsgs.push(...gMsgs);
      }
      setMessages(allMsgs);
    } catch (err) {
      console.warn('Initial data load notice:', err);
    }
  };

  // Initial setup: auto-login default Principal for quick interactive testing or load from localStorage
  useEffect(() => {
    const init = async () => {
      try {
        const uList = await api.getUsers();
        setUsers(uList);

        const savedUserJson = localStorage.getItem('school_chat_active_user');
        let initialUser: User | null = null;

        if (savedUserJson) {
          try {
            const parsed = JSON.parse(savedUserJson);
            const found = uList.find(u => u.id === parsed.id);
            if (found) initialUser = found;
          } catch (e) {
            // ignore
          }
        }

        // If no user saved, default to Principal so user immediately experiences the manager panel with password bbp13156
        if (!initialUser) {
          const principal = uList.find(u => u.role === 'principal');
          if (principal) initialUser = principal;
        }

        if (initialUser) {
          setCurrentUser(initialUser);
          localStorage.setItem('school_chat_active_user', JSON.stringify(initialUser));
          await loadData(initialUser);
        }
      } catch (e) {
        console.error('Initialization error:', e);
      } finally {
        setLoadingInitial(false);
      }
    };

    init();

    // Connect WebSocket
    realtime.connect();

    // WebSocket real-time event listeners
    const unsubMsg = realtime.on('message:new', (newMsg: Message) => {
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });

    const unsubPin = realtime.on('message:pinned', ({ messageId, isPinned }: { messageId: string; isPinned: boolean }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned } : m));
    });

    const unsubReaction = realtime.on('message:reaction', ({ messageId, reactions }: { messageId: string; reactions: Record<string, string[]> }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    });

    const unsubGroupCreated = realtime.on('group:created', (newGroup: Group) => {
      setGroups(prev => {
        if (prev.some(g => g.id === newGroup.id)) return prev;
        return [...prev, newGroup];
      });
    });

    const unsubGroupUpdated = realtime.on('group:updated', (updatedGroups: Group[]) => {
      setGroups(updatedGroups);
    });

    const unsubGroupMembers = realtime.on('group:members_updated', ({ groupId, memberIds }: { groupId: string; memberIds: string[] }) => {
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, memberIds } : g));
    });

    const unsubUserCreated = realtime.on('user:created', (newUser: User) => {
      setUsers(prev => {
        if (prev.some(u => u.id === newUser.id)) return prev;
        return [...prev, newUser];
      });
    });

    const unsubUserPass = realtime.on('user:password_updated', ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, password: newPassword } : u));
      setCurrentUser(prev => prev?.id === userId ? { ...prev, password: newPassword } : prev);
    });

    return () => {
      unsubMsg();
      unsubPin();
      unsubReaction();
      unsubGroupCreated();
      unsubGroupUpdated();
      unsubGroupMembers();
      unsubUserCreated();
      unsubUserPass();
      realtime.disconnect();
    };
  }, []);

  // Handle Login or Registration Success
  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('school_chat_active_user', JSON.stringify(user));
    loadData(user);
    setActiveChat(null);
  };

  // Switch User for quick testing
  const handleSwitchUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('school_chat_active_user', JSON.stringify(user));
    loadData(user);
    setActiveChat(null);
  };

  // Logout
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('school_chat_active_user');
    setActiveChat(null);
  };

  // Select Group
  const handleSelectGroup = async (group: Group) => {
    setActiveChat({
      id: group.id,
      title: group.name,
      avatar: group.avatar,
      isGroup: true,
      groupData: group,
    });
    // Fetch latest messages
    try {
      const msgs = await api.getMessages(group.id);
      setMessages(prev => {
        const others = prev.filter(m => m.chatId !== group.id);
        return [...others, ...msgs];
      });
    } catch (e) {
      // ignore
    }
  };

  // Select Direct User for 1-on-1 chat
  const handleSelectDirectUser = async (targetUser: User) => {
    if (!currentUser) return;
    const directChatId = [currentUser.id, targetUser.id].sort().join('_');
    setActiveChat({
      id: directChatId,
      title: targetUser.fullName,
      avatar: targetUser.avatar,
      isGroup: false,
      directUser: targetUser,
    });
    try {
      const msgs = await api.getMessages(directChatId);
      setMessages(prev => {
        const others = prev.filter(m => m.chatId !== directChatId);
        return [...others, ...msgs];
      });
    } catch (e) {
      // ignore
    }
  };

  // Pin message
  const handlePinMessage = async (messageId: string) => {
    try {
      const isPinned = await api.togglePinMessage(messageId);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned } : m));
    } catch (err: any) {
      alert(err.message || 'خطا در سنجاق پیام');
    }
  };

  // React to message
  const handleReactMessage = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    try {
      const updatedReactions = await api.reactToMessage(messageId, currentUser.id, emoji);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: updatedReactions } : m));
    } catch (err: any) {
      alert(err.message || 'خطا در واکنش');
    }
  };

  // Group Created Callback
  const handleGroupCreated = (newGroup: Group) => {
    setGroups(prev => [...prev, newGroup]);
    handleSelectGroup(newGroup);
  };

  // Calculate unread (demo count)
  const unreadCount = 2;

  return (
    <MobileFrame>
      {!currentUser ? (
        <AuthModal onSuccess={handleAuthSuccess} />
      ) : (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* Quick Role Switcher Sub-header for effortless test switching */}
          <div className="bg-slate-900/90 border-b border-slate-800/80 px-3 py-1 flex items-center justify-between text-[11px] shrink-0">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-400">حساب فعال:</span>
              <span className="font-bold text-slate-100">{currentUser.fullName.split(' ')[0]}</span>
              {currentUser.role === 'principal' ? (
                <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.2 rounded font-bold border border-amber-500/30 flex items-center gap-0.5">
                  <Crown className="w-2.5 h-2.5" />
                  مدیر
                </span>
              ) : (
                <span className="bg-blue-500/20 text-blue-300 text-[9px] px-1.5 py-0.2 rounded font-medium border border-blue-500/30">
                  {currentUser.subject.split(' ')[0]}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const nextUser = users.find(u => u.id !== currentUser.id) || users[0];
                  if (nextUser) handleSwitchUser(nextUser);
                }}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded-lg border border-indigo-500/30 transition-colors"
                title="سوئیچ سریع بین حساب‌ها برای تست پیام‌رسانی"
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span>سوئیچ کاربر</span>
              </button>

              <button
                onClick={handleLogout}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/30 transition-colors"
                title="خروج و بازگشت به صفحه ثبت‌نام و ورود"
              >
                <UserPlus className="w-3 h-3" />
                <span>ثبت‌نام / ورود</span>
              </button>
            </div>
          </div>

          {/* Main Viewport */}
          <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
            {activeChat ? (
              <ChatRoom
                chatId={activeChat.id}
                chatTitle={activeChat.title}
                chatAvatar={activeChat.avatar}
                isGroup={activeChat.isGroup}
                groupData={activeChat.groupData}
                directUser={activeChat.directUser}
                currentUser={currentUser}
                messages={messages}
                allUsers={users}
                onBack={() => setActiveChat(null)}
                onSendMessage={(msg) => setMessages(prev => [...prev, msg])}
                onPinMessage={handlePinMessage}
                onReactMessage={handleReactMessage}
              />
            ) : (
              <>
                {currentTab === 'chats' && (
                  <ChatList
                    groups={groups}
                    directUsers={users}
                    messages={messages}
                    currentUser={currentUser}
                    onSelectGroup={handleSelectGroup}
                    onSelectDirectUser={handleSelectDirectUser}
                    onOpenCreateGroup={() => {
                      if (currentUser.role === 'principal') {
                        setShowCreateGroupModal(true);
                      } else {
                        alert('فقط مدیر آموزشگاه دسترسی به تعریف گروه جدید دارد.');
                      }
                    }}
                  />
                )}

                {currentTab === 'staff' && (
                  <StaffDirectory
                    users={users}
                    currentUser={currentUser}
                    onSelectUserForChat={handleSelectDirectUser}
                  />
                )}

                {currentTab === 'admin' && (
                  currentUser.role === 'principal' ? (
                    <AdminPanel
                      currentUser={currentUser}
                      users={users}
                      groups={groups}
                      onRefreshUsers={() => loadData(currentUser)}
                      onRefreshGroups={() => loadData(currentUser)}
                      onGroupCreated={handleGroupCreated}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-3">
                        <Crown className="w-7 h-7" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-200 mb-1">پنل ویژه مدیریت آموزشگاه</h3>
                      <p className="text-xs text-slate-400 max-w-xs mb-4">
                        این بخش مختص مدیر مدرسه است. شما با حساب دبیر وارد شده‌اید. برای دسترسی، لطفاً به حساب مدیر سوئیچ کنید.
                      </p>
                      <button
                        onClick={() => {
                          const principal = users.find(u => u.role === 'principal');
                          if (principal) handleSwitchUser(principal);
                        }}
                        className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all"
                      >
                        ورود با حساب مدیر مدرسه (رمز: bbp13156)
                      </button>
                    </div>
                  )
                )}

                {currentTab === 'profile' && (
                  <UserProfile
                    currentUser={currentUser}
                    allUsers={users}
                    onSwitchUser={handleSwitchUser}
                    onLogout={handleLogout}
                  />
                )}
              </>
            )}
          </div>

          {/* Bottom Navigation */}
          {!activeChat && (
            <BottomNav
              currentTab={currentTab}
              onChangeTab={setCurrentTab}
              currentUser={currentUser}
              unreadCount={unreadCount}
            />
          )}

          {/* Create Group Modal */}
          {showCreateGroupModal && (
            <CreateGroupModal
              users={users}
              onClose={() => setShowCreateGroupModal(false)}
              onCreated={handleGroupCreated}
            />
          )}
        </div>
      )}
    </MobileFrame>
  );
}
