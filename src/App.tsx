import React, { useState, useEffect, useRef } from 'react';
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
import { Crown, LogOut, Lock, School, Loader2, RotateCcw } from 'lucide-react';

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
  // Phone hardware/browser back button handling (Double-tap to exit)
  const [backExitPrompt, setBackExitPrompt] = useState<boolean>(false);
  const lastBackPressTimeRef = useRef<number>(0);
  const backExitTimerRef = useRef<any>(null);

  const appNavStateRef = useRef({
    activeChat,
    currentTab,
    showCreateGroupModal,
    currentUser,
  });

  useEffect(() => {
    appNavStateRef.current = {
      activeChat,
      currentTab,
      showCreateGroupModal,
      currentUser,
    };
  }, [activeChat, currentTab, showCreateGroupModal, currentUser]);

  const handlePhoneBack = () => {
    const { activeChat, currentTab, showCreateGroupModal, currentUser } = appNavStateRef.current;

    // If modal is open, close modal and stay in app
    if (showCreateGroupModal) {
      setShowCreateGroupModal(false);
      window.history.pushState({ app: 'school_messenger', step: 'root' }, '');
      return;
    }

    // If inside chat room, go back to chats list
    if (activeChat) {
      setActiveChat(null);
      window.history.pushState({ app: 'school_messenger', step: 'root' }, '');
      return;
    }

    // If on a different tab, go back to main chats tab
    if (currentTab !== 'chats') {
      setCurrentTab('chats');
      window.history.pushState({ app: 'school_messenger', step: 'root' }, '');
      return;
    }

    // User is on root screen (Chats list)!
    const now = Date.now();
    const diff = now - lastBackPressTimeRef.current;

    if (diff < 2000) {
      // Second press in a row within 2s: allow natural browser exit!
      if (backExitTimerRef.current) clearTimeout(backExitTimerRef.current);
      setBackExitPrompt(false);
      lastBackPressTimeRef.current = 0;

      // Exit naturally by popping history
      window.history.go(-2);
    } else {
      // First press: DO NOT EXIT! Re-push state and show prompt
      window.history.pushState({ app: 'school_messenger', step: 'root' }, '');
      lastBackPressTimeRef.current = now;
      setBackExitPrompt(true);

      if (backExitTimerRef.current) clearTimeout(backExitTimerRef.current);
      backExitTimerRef.current = setTimeout(() => {
        setBackExitPrompt(false);
        lastBackPressTimeRef.current = 0;
      }, 2000);
    }
  };

  useEffect(() => {
    // Initial history state anchor
    window.history.pushState({ app: 'school_messenger', step: 'root' }, '');

    const onPopState = () => {
      handlePhoneBack();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'BrowserBack' || e.key === 'GoBack') {
        e.preventDefault();
        handlePhoneBack();
      }
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('keydown', onKeyDown);
      if (backExitTimerRef.current) clearTimeout(backExitTimerRef.current);
    };
  }, []);

  // Load initial users and groups
  const loadData = async (userObj?: User) => {
    try {
      const uList = await api.getUsers();
      setUsers(uList);

      const targetUser = userObj || currentUser;
      const gList = await api.getGroups(targetUser?.id);
      setGroups(gList);

      // Load initial messages for groups
      const allMsgsMap = new Map<string, Message>();
      for (const g of gList) {
        const gMsgs = await api.getMessages(g.id);
        for (const m of gMsgs) {
          allMsgsMap.set(m.id, m);
        }
      }
      setMessages(Array.from(allMsgsMap.values()));
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

        // If not saved in localStorage, default to Principal account so app immediately opens
        if (!initialUser && uList.length > 0) {
          initialUser = uList.find(u => u.role === 'principal') || uList[0];
        }

        if (initialUser) {
          setCurrentUser(initialUser);
          localStorage.setItem('school_chat_active_user', JSON.stringify(initialUser));
          await loadData(initialUser);
        } else {
          setCurrentUser(null);
          localStorage.removeItem('school_chat_active_user');
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

    const unsubMsgDeleted = realtime.on('message:deleted', ({ messageId }: { messageId: string; chatId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });

    const unsubMsgEdited = realtime.on('message:edited', ({ messageId, content }: { messageId: string; content: string }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, isEdited: true } : m));
    });

    const unsubChatCleared = realtime.on('chat:cleared', ({ chatId }: { chatId: string; deletedCount: number }) => {
      setMessages(prev => prev.filter(m => m.chatId !== chatId));
    });

    const unsubAutoDeleteUpdated = realtime.on('group:auto-delete-updated', ({ groupId, autoDeleteHours }: { groupId: string; autoDeleteHours: number }) => {
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, autoDeleteHours } : g));
      setActiveChat(prev => {
        if (prev && prev.isGroup && prev.groupData?.id === groupId) {
          return {
            ...prev,
            groupData: { ...prev.groupData, autoDeleteHours },
          };
        }
        return prev;
      });
    });

    const unsubAutoPurged = realtime.on('chat:auto-purged', () => {
      // Reload messages when auto purge triggers
      api.getMessages('').then(allMsgs => {
        if (allMsgs && Array.isArray(allMsgs)) {
          setMessages(allMsgs);
        }
      }).catch(() => {});
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
      setActiveChat(prev => {
        if (prev && prev.isGroup && prev.groupData?.id === groupId) {
          return {
            ...prev,
            groupData: { ...prev.groupData, memberIds },
          };
        }
        return prev;
      });
    });

    const unsubUserCreated = realtime.on('user:created', (newUser: User) => {
      setUsers(prev => {
        if (prev.some(u => u.id === newUser.id)) return prev;
        return [...prev, newUser];
      });
    });

    const unsubUserDeleted = realtime.on('user:deleted', ({ userId }: { userId: string }) => {
      setUsers(prev => prev.filter(u => u.id !== userId));
      setGroups(prev => prev.map(g => ({
        ...g,
        memberIds: g.memberIds.filter(id => id !== userId),
      })));
      setCurrentUser(prev => {
        if (prev?.id === userId) {
          alert('حساب کاربری شما توسط مدیر آموزشگاه از سامانه حذف گردید.');
          localStorage.removeItem('school_chat_active_user');
          return null as any;
        }
        return prev;
      });
      setActiveChat(prev => {
        if (prev && !prev.isGroup && prev.directUser?.id === userId) {
          return null;
        }
        return prev;
      });
    });

    const unsubUserPass = realtime.on('user:password_updated', ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, password: newPassword } : u));
      setCurrentUser(prev => prev?.id === userId ? { ...prev, password: newPassword } : prev);
    });

    const unsubUserUpdated = realtime.on('user:updated', (updatedUser: User) => {
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      setCurrentUser(prev => {
        if (prev?.id === updatedUser.id) {
          localStorage.setItem('school_chat_active_user', JSON.stringify(updatedUser));
          return updatedUser;
        }
        return prev;
      });
      // Also update activeChat if direct chat
      setActiveChat(prev => {
        if (prev && !prev.isGroup && prev.directUser?.id === updatedUser.id) {
          return {
            ...prev,
            name: updatedUser.fullName,
            avatar: updatedUser.avatar,
            directUser: updatedUser,
          };
        }
        return prev;
      });
    });

    return () => {
      unsubMsg();
      unsubMsgDeleted();
      unsubMsgEdited();
      unsubChatCleared();
      unsubAutoDeleteUpdated();
      unsubAutoPurged();
      unsubPin();
      unsubReaction();
      unsubGroupCreated();
      unsubGroupUpdated();
      unsubGroupMembers();
      unsubUserCreated();
      unsubUserDeleted();
      unsubUserPass();
      unsubUserUpdated();
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

  // In-app logout
  const handleLogout = () => {
    if (window.confirm('آیا مایل به خروج از حساب کاربری خود هستید؟')) {
      setCurrentUser(null);
      localStorage.removeItem('school_chat_active_user');
      setActiveChat(null);
    }
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
        const map = new Map<string, Message>();
        for (const m of msgs) {
          map.set(m.id, m);
        }
        return [...others, ...Array.from(map.values())];
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
        const map = new Map<string, Message>();
        for (const m of msgs) {
          map.set(m.id, m);
        }
        return [...others, ...Array.from(map.values())];
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

  // Delete message (sender or principal)
  // Requirement: "افراد بتوانند پیام های ارسالی خود را حذف کنند . مدیر نیز بتواند پیام افراد را حذف کند"
  const handleDeleteMessage = async (messageId: string) => {
    if (!currentUser) return;
    try {
      // Optimistic update
      setMessages(prev => prev.filter(m => m.id !== messageId));
      await api.deleteMessage(messageId, currentUser.id);
    } catch (err: any) {
      console.error('Failed to delete message:', err);
      // Reload on failure if chat is active
      if (activeChat) {
        const msgs = await api.getMessages(activeChat.id);
        setMessages(msgs);
      }
    }
  };

  // Edit message (sender only)
  // Requirement: "پیامی که می فرستیم قابلیت ویرایش داشته باشه"
  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!currentUser) return;
    try {
      // Optimistic update
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent, isEdited: true } : m));
      await api.editMessage(messageId, newContent, currentUser.id);
    } catch (err: any) {
      console.error('Failed to edit message:', err);
      if (activeChat) {
        const msgs = await api.getMessages(activeChat.id);
        setMessages(msgs);
      }
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
    <MobileFrame onPhoneBack={handlePhoneBack}>
      {/* Hardware Back Button Exit Toast (Android Toast Style) */}
      {backExitPrompt && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 bg-slate-900/95 border border-slate-700/90 text-white text-xs font-semibold rounded-full shadow-2xl flex items-center gap-2.5 backdrop-blur-md animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-150 pointer-events-none ring-1 ring-white/10">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
          <span>برای خروج از برنامه، یک بار دیگر دکمه برگشت را بزنید</span>
        </div>
      )}

      {loadingInitial ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-300">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3 animate-pulse">
            <School className="w-7 h-7" />
          </div>
          <div className="text-sm font-bold text-slate-100">پیام‌رسان کادر آموزشی مدرسه</div>
          <div className="text-xs text-slate-400 mt-2 flex items-center gap-1.5 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span>در حال بارگذاری اطلاعات و گفتگوها...</span>
          </div>
        </div>
      ) : !currentUser ? (
        <AuthModal onSuccess={handleAuthSuccess} />
      ) : (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* Top Info Bar */}
          <div className="bg-slate-900/95 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between text-[11px] shrink-0">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-400">حساب فعال:</span>
              <span className="font-bold text-slate-100">{currentUser.fullName}</span>
              {currentUser.role === 'principal' ? (
                <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.5 rounded-full font-bold border border-amber-500/30 flex items-center gap-0.5">
                  <Crown className="w-2.5 h-2.5" />
                  مدیر
                </span>
              ) : (
                <span className="bg-blue-500/20 text-blue-300 text-[9px] px-1.5 py-0.5 rounded-full font-medium border border-blue-500/30">
                  {currentUser.subject}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleLogout}
                className="text-[11px] flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 transition-all active:scale-95"
                title="خروج از حساب کاربری"
              >
                <LogOut className="w-3 h-3 text-rose-400" />
                <span>خروج</span>
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
                onSendMessage={(msg) => setMessages(prev => {
                  if (prev.some(m => m.id === msg.id)) {
                    return prev.map(m => m.id === msg.id ? msg : m);
                  }
                  return [...prev, msg];
                })}
                onPinMessage={handlePinMessage}
                onReactMessage={handleReactMessage}
                onDeleteMessage={handleDeleteMessage}
                onEditMessage={handleEditMessage}
                onRefreshGroups={() => loadData(currentUser || undefined)}
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
                    onUserDeleted={() => loadData(currentUser || undefined)}
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
                      <p className="text-xs text-slate-400 max-w-xs mb-4 leading-relaxed">
                        این بخش دارای دسترسی حفاظت‌شده مدیریت آموزشگاه است. برای ورود به این بخش، باید با کد پرسنلی و رمز عبور مدیر وارد سامانه شوید.
                      </p>
                      <button
                        onClick={handleLogout}
                        className="py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>خروج و ورود با حساب مدیر</span>
                      </button>
                    </div>
                  )
                )}

                {currentTab === 'profile' && (
                  <UserProfile
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onProfileUpdated={(updated) => {
                      setCurrentUser(updated);
                      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
                      localStorage.setItem('school_chat_active_user', JSON.stringify(updated));
                    }}
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
