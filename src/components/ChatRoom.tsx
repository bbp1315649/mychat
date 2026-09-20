import React, { useState, useRef, useEffect } from 'react';
import { Group, User, Message } from '../types';
import { api } from '../services/api';
import { 
  ArrowRight, 
  Send, 
  Paperclip, 
  Mic, 
  Pin, 
  Smile, 
  FileText, 
  Volume2, 
  Play, 
  Pause, 
  Check, 
  CheckCheck, 
  Crown, 
  Sparkles, 
  Megaphone,
  X,
  Reply,
  Download,
  Info
} from 'lucide-react';

interface ChatRoomProps {
  chatId: string;
  chatTitle: string;
  chatAvatar: string;
  isGroup: boolean;
  groupData?: Group;
  directUser?: User;
  currentUser: User;
  messages: Message[];
  allUsers: User[];
  onBack: () => void;
  onSendMessage: (msg: Message) => void;
  onPinMessage: (messageId: string) => void;
  onReactMessage: (messageId: string, emoji: string) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  chatId,
  chatTitle,
  chatAvatar,
  isGroup,
  groupData,
  directUser,
  currentUser,
  messages,
  allUsers,
  onBack,
  onSendMessage,
  onPinMessage,
  onReactMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showReactionPickerForId, setShowReactionPickerForId] = useState<string | null>(null);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordIntervalRef = useRef<any>(null);

  const isPrincipal = currentUser.role === 'principal';
  const isAnnouncementGroup = isGroup && groupData?.isAnnouncementOnly;
  const canSend = !isAnnouncementGroup || isPrincipal || currentUser.role === 'deputy';

  // Filter messages for this chat
  const chatMessages = messages.filter(m => m.chatId === chatId);
  const pinnedMessage = chatMessages.find(m => m.isPinned);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  // Handle Send text message
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText('');
    const replyToSend = replyTarget ? {
      id: replyTarget.id,
      senderName: replyTarget.senderName,
      content: replyTarget.content,
    } : undefined;
    setReplyTarget(null);

    try {
      const msg = await api.sendMessage({
        chatId,
        senderId: currentUser.id,
        content: textToSend,
        type: 'text',
        replyTo: replyToSend,
      });
      onSendMessage(msg);
    } catch (err: any) {
      alert(err.message || 'خطا در ارسال پیام');
    }
  };

  // Simulated Voice Note Recorder
  const startRecording = () => {
    setIsRecording(true);
    setRecordTimer(0);
    recordIntervalRef.current = setInterval(() => {
      setRecordTimer(prev => prev + 1);
    }, 1000);
  };

  const stopAndSendRecording = async () => {
    clearInterval(recordIntervalRef.current);
    const duration = recordTimer || 3;
    setIsRecording(false);
    setRecordTimer(0);

    try {
      const msg = await api.sendMessage({
        chatId,
        senderId: currentUser.id,
        content: `پیام صوتی (${duration} ثانیه)`,
        type: 'voice',
        voiceDuration: duration,
      });
      onSendMessage(msg);
    } catch (err: any) {
      alert(err.message || 'خطا در ارسال پیام صوتی');
    }
  };

  const cancelRecording = () => {
    clearInterval(recordIntervalRef.current);
    setIsRecording(false);
    setRecordTimer(0);
  };

  // Send Official Circular / Announcement
  const handleSendOfficialAnnouncement = async () => {
    setShowAttachMenu(false);
    const sampleText = prompt('متن بخشنامه یا اعلان رسمی مدرسه را وارد نمایید:', 'همکاران گرامی، لطفاً لیست امتحانات مستمر و بودجه‌بندی پایه‌های آموزشی را تا پایان هفته ارسال نمایید.');
    if (!sampleText) return;

    try {
      const msg = await api.sendMessage({
        chatId,
        senderId: currentUser.id,
        content: sampleText,
        type: 'announcement',
      });
      onSendMessage(msg);
    } catch (err: any) {
      alert(err.message || 'خطا در ارسال بخشنامه');
    }
  };

  // Send Sample Educational Document
  const handleSendDocument = async () => {
    setShowAttachMenu(false);
    try {
      const msg = await api.sendMessage({
        chatId,
        senderId: currentUser.id,
        content: 'بخشنامه تقویم آموزشی و برنامه هفتگی دبیران',
        type: 'file',
        fileName: 'تقویم_اجرایی_آموزشگاه_۱۴۰۳.pdf',
        fileSize: '۲.۱ مگابایت',
      });
      onSendMessage(msg);
    } catch (err: any) {
      alert(err.message || 'خطا در ارسال فایل');
    }
  };

  // Quick Emoji reactions
  const quickEmojis = ['👍', '❤️', '👏', '🙏', '✅', '🔥'];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* Chat Header */}
      <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
            title="بازگشت"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <div 
            onClick={() => isGroup && setShowGroupInfoModal(true)}
            className="flex items-center gap-2 cursor-pointer group min-w-0"
          >
            <div className="relative shrink-0">
              <img
                src={chatAvatar}
                alt={chatTitle}
                className="w-9 h-9 rounded-xl object-cover border border-slate-700/60"
              />
              {directUser && (
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                  directUser.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                }`} />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-bold text-slate-100 truncate group-hover:text-blue-400 transition-colors">
                  {chatTitle}
                </h2>
                {isAnnouncementGroup && (
                  <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1 py-0.2 rounded font-medium border border-amber-500/30 shrink-0">
                    کانال اطلاع‌رسانی
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                {isGroup ? `${groupData?.memberIds.length || 0} عضو در گروه` : (directUser?.subject || 'همکار')}
              </p>
            </div>
          </div>
        </div>

        {isGroup && (
          <button
            onClick={() => setShowGroupInfoModal(true)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            title="مشخصات و اعضای گروه"
          >
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Pinned Message Bar */}
      {pinnedMessage && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-amber-200/90 z-10">
          <div className="flex items-center gap-2 truncate">
            <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0 rotate-45" />
            <div className="truncate text-[11px]">
              <span className="font-semibold text-amber-300 ml-1">پیام سنجاق شده:</span>
              <span className="text-amber-100">{pinnedMessage.content}</span>
            </div>
          </div>
          {isPrincipal && (
            <button
              onClick={() => onPinMessage(pinnedMessage.id)}
              className="text-[10px] text-amber-400 hover:text-amber-300 px-1.5 py-0.5 rounded hover:bg-amber-500/10 shrink-0"
              title="برداشتن سنجاق"
            >
              حذف سنجاق
            </button>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-2 text-slate-600">
              <Megaphone className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-400">پیامی در این گفتگو وجود ندارد</p>
            <p className="text-[11px] text-slate-600 mt-0.5">اولین پیام را ارسال بفرمایید</p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            const isMe = msg.senderId === currentUser.id;
            const isMsgPrincipal = msg.senderRole === 'principal';
            const isMsgDeputy = msg.senderRole === 'deputy';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-start' : 'items-end'} relative group`}
              >
                {/* Sender Name for incoming group messages */}
                {!isMe && isGroup && (
                  <div className="flex items-center gap-1.5 mb-1 mr-1">
                    <span className="text-[11px] font-semibold text-slate-300">
                      {msg.senderName}
                    </span>
                    {isMsgPrincipal && (
                      <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1 py-0.2 rounded font-medium border border-amber-500/30 flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5" />
                        مدیر
                      </span>
                    )}
                    {isMsgDeputy && (
                      <span className="bg-purple-500/20 text-purple-300 text-[9px] px-1 py-0.2 rounded font-medium border border-purple-500/30">
                        معاون
                      </span>
                    )}
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] rounded-2xl p-3 shadow-md relative transition-all ${
                    msg.type === 'announcement'
                      ? 'bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/70 border border-amber-500/40 text-amber-100 rounded-br-none'
                      : isMe
                        ? 'bg-blue-600 text-white rounded-bl-none'
                        : 'bg-slate-900 text-slate-100 border border-slate-800 rounded-br-none'
                  }`}
                >
                  {/* Reply Reference if any */}
                  {msg.replyTo && (
                    <div className={`mb-2 p-2 rounded-lg border-r-2 text-[10px] ${
                      isMe ? 'bg-blue-700/60 border-blue-300 text-blue-100' : 'bg-slate-800 border-blue-500 text-slate-300'
                    }`}>
                      <div className="font-semibold">{msg.replyTo.senderName}</div>
                      <div className="truncate opacity-80">{msg.replyTo.content}</div>
                    </div>
                  )}

                  {/* Announcement Banner */}
                  {msg.type === 'announcement' && (
                    <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-bold mb-1.5 pb-1 border-b border-amber-500/30">
                      <Megaphone className="w-3.5 h-3.5" />
                      <span>بخشنامه رسمی مدیریت مدرسه</span>
                    </div>
                  )}

                  {/* Message Content: Voice */}
                  {msg.type === 'voice' && (
                    <div className="flex items-center gap-3 py-1">
                      <button
                        onClick={() => setActiveAudioId(activeAudioId === msg.id ? null : msg.id)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow ${
                          isMe ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
                        }`}
                      >
                        {activeAudioId === msg.id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 mr-0.5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-[120px]">
                        <div className="flex items-center gap-0.5 h-6">
                          {[3, 7, 5, 8, 4, 9, 6, 8, 4, 6, 8, 5, 7, 4, 3].map((h, i) => (
                            <div
                              key={i}
                              style={{ height: `${h * 2}px` }}
                              className={`w-1 rounded-full ${
                                activeAudioId === msg.id && i < 8 
                                  ? 'bg-amber-400 animate-pulse' 
                                  : isMe ? 'bg-white/70' : 'bg-blue-400/80'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-[10px] opacity-80 mt-0.5">
                          <span>{activeAudioId === msg.id ? 'در حال پخش...' : 'پیام صوتی دبیر'}</span>
                          <span>{msg.voiceDuration || 3} ثانیه</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Message Content: File/Document */}
                  {msg.type === 'file' && (
                    <div className="flex items-center gap-2.5 p-2 bg-black/20 rounded-xl border border-white/10 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate text-slate-100">{msg.fileName}</div>
                        <div className="text-[10px] opacity-70 font-mono">{msg.fileSize}</div>
                      </div>
                      <button 
                        onClick={() => alert(`در حال دریافت فایل: ${msg.fileName}`)}
                        className="p-1 rounded-lg hover:bg-white/10 text-slate-300" 
                        title="دانلود سند"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Text content */}
                  {msg.type !== 'voice' && (
                    <p className="text-xs leading-relaxed whitespace-pre-wrap select-text">
                      {msg.content}
                    </p>
                  )}

                  {/* Footer: Time, Pin icon, Read status */}
                  <div className={`flex items-center justify-end gap-1 mt-1.5 text-[10px] ${
                    isMe ? 'text-blue-100/80' : 'text-slate-400'
                  }`}>
                    {msg.isPinned && (
                      <span title="سنجاق شده">
                        <Pin className="w-2.5 h-2.5 text-amber-400 rotate-45 mr-1" />
                      </span>
                    )}
                    <span className="font-mono">{msg.timestamp}</span>
                    {isMe && (
                      <CheckCheck className="w-3 h-3 text-blue-200" />
                    )}
                  </div>
                </div>

                {/* Reactions Display */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 px-1">
                    {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                      const hasReacted = userIds.includes(currentUser.id);
                      return (
                        <button
                          key={emoji}
                          onClick={() => onReactMessage(msg.id, emoji)}
                          className={`text-[11px] px-1.5 py-0.5 rounded-full border flex items-center gap-1 transition-all ${
                            hasReacted
                              ? 'bg-blue-600/30 border-blue-500/60 text-blue-200'
                              : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="text-[10px] font-mono">{userIds.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Action Toolbar on click / hover */}
                <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1 mt-0.5 px-1 text-slate-400">
                  <button
                    onClick={() => setReplyTarget(msg)}
                    className="p-1 hover:text-slate-200 hover:bg-slate-800 rounded"
                    title="پاسخ"
                  >
                    <Reply className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => setShowReactionPickerForId(showReactionPickerForId === msg.id ? null : msg.id)}
                    className="p-1 hover:text-slate-200 hover:bg-slate-800 rounded"
                    title="واکنش"
                  >
                    <Smile className="w-3 h-3" />
                  </button>

                  {isPrincipal && (
                    <button
                      onClick={() => onPinMessage(msg.id)}
                      className={`p-1 hover:text-amber-400 hover:bg-slate-800 rounded ${msg.isPinned ? 'text-amber-400' : ''}`}
                      title={msg.isPinned ? 'برداشتن سنجاق' : 'سنجاق کردن پیام'}
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Emoji Picker Popover */}
                {showReactionPickerForId === msg.id && (
                  <div className="bg-slate-900 border border-slate-700 shadow-xl rounded-2xl p-1.5 flex items-center gap-1 z-30 mt-1">
                    {quickEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onReactMessage(msg.id, emoji);
                          setShowReactionPickerForId(null);
                        }}
                        className="hover:scale-125 transition-transform p-1 text-base"
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowReactionPickerForId(null)}
                      className="text-slate-500 hover:text-slate-300 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview Bar */}
      {replyTarget && (
        <div className="bg-slate-900 border-t border-slate-800 px-3 py-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <Reply className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <div className="truncate text-[11px]">
              <span className="font-semibold text-blue-300 ml-1">پاسخ به {replyTarget.senderName}:</span>
              <span className="text-slate-400">{replyTarget.content}</span>
            </div>
          </div>
          <button
            onClick={() => setReplyTarget(null)}
            className="text-slate-400 hover:text-slate-200 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Attachment Options Menu */}
      {showAttachMenu && (
        <div className="bg-slate-900 border-t border-slate-800 p-3 grid grid-cols-3 gap-2 z-20">
          <button
            type="button"
            onClick={handleSendOfficialAnnouncement}
            className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex flex-col items-center gap-1.5 text-amber-300 transition-all"
          >
            <Megaphone className="w-5 h-5 text-amber-400" />
            <span className="text-[10px] font-medium">بخشنامه رسمی</span>
          </button>

          <button
            type="button"
            onClick={handleSendDocument}
            className="p-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 flex flex-col items-center gap-1.5 text-blue-300 transition-all"
          >
            <FileText className="w-5 h-5 text-blue-400" />
            <span className="text-[10px] font-medium">فایل و سند</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false);
              const text = prompt('متن کوتاه برای ارسال پیام تصویری/گزارش تدریس:', 'تصویر نمونه کار و تمرین درس');
              if (text) {
                api.sendMessage({
                  chatId,
                  senderId: currentUser.id,
                  content: text,
                  type: 'text',
                }).then(msg => onSendMessage(msg));
              }
            }}
            className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 flex flex-col items-center gap-1.5 text-emerald-300 transition-all"
          >
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <span className="text-[10px] font-medium">گزارش کلاسی</span>
          </button>
        </div>
      )}

      {/* Audio Recording State Bar */}
      {isRecording && (
        <div className="p-3 bg-rose-950/80 border-t border-rose-500/40 flex items-center justify-between text-xs text-rose-200 z-20 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></div>
            <span className="font-semibold">در حال ضبط صدای دبیر ({recordTimer} ثانیه)...</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={stopAndSendRecording}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-3 py-1 rounded-xl shadow font-medium"
            >
              ارسال صوت
            </button>
          </div>
        </div>
      )}

      {/* Bottom Message Input Bar */}
      <div className="p-2.5 bg-slate-900 border-t border-slate-800 shrink-0 z-10">
        {!canSend ? (
          <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-amber-400/90 flex items-center justify-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-400" />
            <span>در این کانال فقط مدیر و معاونین مدرسه مجاز به ارسال پیام هستند.</span>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-1.5">
            {/* Attachments Toggle */}
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className={`p-2 rounded-xl border transition-all ${
                showAttachMenu
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-950 hover:bg-slate-850 text-slate-400 border-slate-800'
              }`}
              title="پیوست بخشنامه، فایل یا گزارش"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Input field */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="پیام خود را بنویسید..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Mic / Record Voice simulation */}
            {inputText.trim().length === 0 && (
              <button
                type="button"
                onClick={startRecording}
                className="p-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl text-slate-400 hover:text-rose-400 transition-colors"
                title="ضبط پیام صوتی دبیر"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl shadow-md shadow-blue-500/20 transition-all"
              title="ارسال پیام"
            >
              <Send className="w-4 h-4 rotate-180" />
            </button>
          </form>
        )}
      </div>

      {/* Group Info Modal */}
      {showGroupInfoModal && isGroup && groupData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold text-slate-100">مشخصات و اعضای گروه</h3>
              <button
                onClick={() => setShowGroupInfoModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center mb-4">
              <img
                src={groupData.avatar}
                alt=""
                className="w-16 h-16 rounded-2xl mx-auto mb-2 object-cover border border-slate-700"
              />
              <h4 className="text-sm font-bold text-slate-100">{groupData.name}</h4>
              <p className="text-xs text-slate-400 mt-1">{groupData.description}</p>
            </div>

            <div className="mb-3">
              <div className="text-[11px] font-semibold text-slate-300 mb-2">
                فهرست اعضا ({groupData.memberIds.length} نفر):
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {groupData.memberIds.map((mId) => {
                  const member = allUsers.find(u => u.id === mId);
                  if (!member) return null;
                  return (
                    <div key={mId} className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                      <div className="flex items-center gap-2">
                        <img src={member.avatar} alt="" className="w-7 h-7 rounded-lg object-cover" />
                        <div>
                          <div className="font-medium text-slate-200">{member.fullName}</div>
                          <div className="text-[10px] text-slate-500">{member.subject}</div>
                        </div>
                      </div>
                      {member.role === 'principal' ? (
                        <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-medium">
                          مدیر
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">
                          {member.personnelCode}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setShowGroupInfoModal(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium rounded-xl"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
