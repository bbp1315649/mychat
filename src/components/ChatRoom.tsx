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
  Info,
  UserMinus,
  Camera,
  Maximize2,
  Image as ImageIcon,
  Trash2,
  Loader2,
  Video,
  Film,
  Languages,
  ArrowLeftRight,
  Copy,
  CheckCircle2,
  RotateCcw,
  Clock,
  Eraser,
  Sliders,
  AlertTriangle,
  Timer,
  Pencil,
  Minimize2
} from 'lucide-react';
import { CameraCaptureModal } from './CameraCaptureModal';
import { ImageLightboxModal } from './ImageLightboxModal';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { 
  startAudioRecording, 
  ActiveRecorder, 
  generateSyntheticVoiceWav, 
  formatAudioTime 
} from '../utils/audioUtils';
import { 
  startSpeechToText, 
  SpeechRecognitionController, 
  SCHOOL_VOICE_TEMPLATES 
} from '../utils/speechToText';

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
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => Promise<void> | void;
  onRefreshGroups?: () => void;
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
  onDeleteMessage,
  onEditMessage,
  onRefreshGroups,
}) => {
  const [inputText, setInputText] = useState('');
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editToast, setEditToast] = useState<string | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const [isExpandedInput, setIsExpandedInput] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<Message | null>(null);
  const [isDeletingMsg, setIsDeletingMsg] = useState(false);

  // Persian <-> English Translator State for typing box and messages
  const [showTranslator, setShowTranslator] = useState(false);
  const [translateTargetLang, setTranslateTargetLang] = useState<'en' | 'fa'>('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationResult, setTranslationResult] = useState<{
    original: string;
    translated: string;
    targetLang: string;
  } | null>(null);
  const [previousPersianText, setPreviousPersianText] = useState<string | null>(null);
  const [copiedTranslation, setCopiedTranslation] = useState(false);
  const [translateToast, setTranslateToast] = useState<string | null>(null);
  const [messageTranslations, setMessageTranslations] = useState<Record<string, { translated: string; loading?: boolean }>>({});

  const handleTranslateInput = async (textToTranslate?: string, targetOverride?: 'en' | 'fa') => {
    const raw = textToTranslate !== undefined ? textToTranslate : inputText;
    if (!raw.trim()) return;

    const target = targetOverride || translateTargetLang;
    setIsTranslating(true);
    try {
      const res = await api.translate(raw.trim(), target);
      setTranslationResult({
        original: raw.trim(),
        translated: res.translatedText,
        targetLang: res.targetLang,
      });
    } catch (err: any) {
      console.warn('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleQuickTranslate = async () => {
    if (!inputText.trim()) return;
    setIsTranslating(true);
    try {
      const hasPersian = /[\u0600-\u06FF]/.test(inputText);
      const target = hasPersian ? 'en' : 'fa';
      const original = inputText;
      const res = await api.translate(original.trim(), target);
      if (res && res.translatedText) {
        setPreviousPersianText(original);
        setInputText(res.translatedText);
        setTranslationResult({
          original,
          translated: res.translatedText,
          targetLang: target,
        });
        setTranslateToast(target === 'en' ? 'متن به انگلیسی ترجمه شد' : 'متن به فارسی ترجمه شد');
        setTimeout(() => setTranslateToast(null), 3000);
      }
    } catch (err: any) {
      console.warn('Quick translate error:', err);
      setTranslateToast('خطا در ترجمه متن');
      setTimeout(() => setTranslateToast(null), 3000);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslateMessage = async (msgId: string, content: string) => {
    if (messageTranslations[msgId]?.translated) {
      // Toggle off if already showing
      setMessageTranslations(prev => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
      return;
    }

    setMessageTranslations(prev => ({
      ...prev,
      [msgId]: { translated: '', loading: true },
    }));

    try {
      const hasPersian = /[\u0600-\u06FF]/.test(content);
      const target = hasPersian ? 'en' : 'fa';
      const res = await api.translate(content, target);
      setMessageTranslations(prev => ({
        ...prev,
        [msgId]: { translated: res.translatedText, loading: false },
      }));
    } catch (err) {
      setMessageTranslations(prev => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
    }
  };

  // Handle message deletion
  // Requirement: "افراد بتوانند پیام های ارسالی خود را حذف کنند . مدیر نیز بتواند پیام افراد را حذف کند"
  const handleConfirmDeleteMessage = async () => {
    if (!deleteConfirmMsg) return;
    setIsDeletingMsg(true);
    try {
      if (onDeleteMessage) {
        await onDeleteMessage(deleteConfirmMsg.id);
      } else {
        await api.deleteMessage(deleteConfirmMsg.id, currentUser.id);
      }
      setDeleteConfirmMsg(null);
    } catch (err: any) {
      console.error('Failed to delete message:', err);
    } finally {
      setIsDeletingMsg(false);
    }
  };
  const [activeLightboxImage, setActiveLightboxImage] = useState<{
    url: string;
    senderName?: string;
    senderAvatar?: string;
    caption?: string;
    timestamp?: string;
  } | null>(null);
  const [showReactionPickerForId, setShowReactionPickerForId] = useState<string | null>(null);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [showAutoDeleteModal, setShowAutoDeleteModal] = useState(false);
  const [selectedAutoDeleteHours, setSelectedAutoDeleteHours] = useState<number>(groupData?.autoDeleteHours || 0);
  const [isSavingAutoDelete, setIsSavingAutoDelete] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [cameraModalMode, setCameraModalMode] = useState<'photo' | 'video'>('photo');
  const [showStickerDrawer, setShowStickerDrawer] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copiedToastText, setCopiedToastText] = useState<string | null>(null);
  const longPressTimerRef = useRef<any>(null);
  const isLongPressTriggeredRef = useRef<boolean>(false);

  // Copy text to clipboard with haptic feedback & animated toast
  // Requirement: "میخوام متن هایی که ارسال میشه . در چت با نگه داشتن دست روی متن کپی شود"
  const handleCopyMessageText = (text: string, messageId: string) => {
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      // Haptic feedback if supported on mobile
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try {
          window.navigator.vibrate(50);
        } catch {
          // ignore
        }
      }

      setCopiedMessageId(messageId);
      setCopiedToastText('متن پیام کپی شد');
      setTimeout(() => {
        setCopiedMessageId(null);
        setCopiedToastText(null);
      }, 2000);
    } catch (err) {
      console.warn('Failed to copy text:', err);
    }
  };

  // Long-press start handler for touch & mouse
  const handleStartLongPress = (text: string, messageId: string) => {
    isLongPressTriggeredRef.current = false;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      handleCopyMessageText(text, messageId);
    }, 500); // 500ms standard long-press duration
  };

  // Long-press cancel handler
  const handleCancelLongPress = () => {
    clearTimeout(longPressTimerRef.current);
  };

  // Send photo captured via camera or selected from device
  const handleSendPhoto = async (photoDataUrl: string, caption: string, fileName?: string) => {
    setIsSending(true);
    try {
      const msg = await api.sendMessage({
        chatId,
        senderId: currentUser.id,
        content: caption,
        type: 'image',
        fileUrl: photoDataUrl,
        fileName: fileName || 'classroom_report.jpg',
      });
      onSendMessage(msg);
    } finally {
      setIsSending(false);
    }
  };

  // Send video captured via camera or selected from device
  const handleSendVideo = async (videoDataUrl: string, caption: string, duration: number, fileName?: string) => {
    setIsSending(true);
    try {
      const msg = await api.sendMessage({
        chatId,
        senderId: currentUser.id,
        content: caption,
        type: 'video',
        fileUrl: videoDataUrl,
        fileName: fileName || 'classroom_video.webm',
        videoDuration: duration,
      });
      onSendMessage(msg);
    } finally {
      setIsSending(false);
    }
  };

  // Direct sticker send
  const handleSendDirectSticker = async (stickerText: string) => {
    setIsSending(true);
    setShowStickerDrawer(false);
    try {
      const msg = await api.sendMessage({
        chatId,
        senderId: currentUser.id,
        content: stickerText,
        type: 'text',
      });
      onSendMessage(msg);
    } catch (e: any) {
      console.error('Failed to send sticker:', e);
    } finally {
      setIsSending(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordIntervalRef = useRef<any>(null);
  const activeRecorderRef = useRef<ActiveRecorder | null>(null);
  const audioLevelIntervalRef = useRef<any>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const [speechTranscript, setSpeechTranscript] = useState<string>('');
  const [translatedSpeechEnglish, setTranslatedSpeechEnglish] = useState<string>('');
  const [isTranslatingVoice, setIsTranslatingVoice] = useState<boolean>(false);
  const [voiceTypingTargetLang, setVoiceTypingTargetLang] = useState<'fa' | 'en'>('fa');
  const speechControllerRef = useRef<SpeechRecognitionController | null>(null);
  const voiceTypingInitialTextRef = useRef<string>('');
  const [isVoiceTyping, setIsVoiceTyping] = useState<boolean>(false);
  const [showVoiceTemplates, setShowVoiceTemplates] = useState<boolean>(false);

  // Auto-translate spoken Persian voice to English in real time
  // Requirement: "مثلا فارسی صحبت بکنیم انگلیسی ترجمه و ارسال بشه"
  useEffect(() => {
    if (!speechTranscript.trim()) {
      setTranslatedSpeechEnglish('');
      return;
    }

    const timer = setTimeout(async () => {
      setIsTranslatingVoice(true);
      try {
        const res = await api.translate(speechTranscript.trim(), 'en', 'fa');
        if (res && res.translatedText) {
          setTranslatedSpeechEnglish(res.translatedText);
        }
      } catch (err) {
        console.warn('Realtime voice translation error:', err);
      } finally {
        setIsTranslatingVoice(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [speechTranscript]);

  // Principal removes member from this group
  // Requirement: "مدیر قابلیت حذف افراد ... از گروه را داشته باشد"
  const handleRemoveMemberFromCurrentGroup = async (userId: string, memberName: string) => {
    if (!groupData) return;
    if (!window.confirm(`آیا از حذف «${memberName}» از گروه «${groupData.name}» اطمینان دارید؟`)) {
      return;
    }

    try {
      const updatedMembers = await api.removeGroupMember(groupData.id, userId);
      groupData.memberIds = updatedMembers;
      if (onRefreshGroups) {
        onRefreshGroups();
      }
    } catch (err: any) {
      alert(err.message || 'خطا در حذف عضو از گروه');
    }
  };

  const isPrincipal = currentUser.role === 'principal';
  const isAnnouncementGroup = isGroup && groupData?.isAnnouncementOnly;
  const canSend = !isAnnouncementGroup || isPrincipal || currentUser.role === 'deputy';

  // Sync autoDeleteHours when groupData updates
  useEffect(() => {
    if (groupData && groupData.autoDeleteHours !== undefined) {
      setSelectedAutoDeleteHours(groupData.autoDeleteHours);
    }
  }, [groupData?.autoDeleteHours]);

  // Handle Clearing Chat History (Principal only)
  // Requirement: "مدیر این امکان را داشته باشد که سابقه چت ها رو پاک کند یا مدت تنظیم کند اتومات حذف شود"
  const handleConfirmClearHistory = async () => {
    if (!isPrincipal) return;
    setIsClearingHistory(true);
    try {
      await api.clearChatHistory(chatId, currentUser.id);
      setShowClearHistoryModal(false);
      setCopiedToastText('تمامی سابقه پیام‌های این گفتگو پاکسازی شد');
      setTimeout(() => setCopiedToastText(null), 2500);
    } catch (err: any) {
      alert(err.message || 'خطا در پاکسازی سابقه گفتگو');
    } finally {
      setIsClearingHistory(false);
    }
  };

  // Handle Setting Auto-Delete Duration (Principal only)
  // Requirement: "مدیر این امکان را داشته باشد که سابقه چت ها رو پاک کند یا مدت تنظیم کند اتومات حذف شود"
  const handleSaveAutoDelete = async () => {
    if (!isPrincipal || !groupData) return;
    setIsSavingAutoDelete(true);
    try {
      await api.setGroupAutoDelete(groupData.id, selectedAutoDeleteHours, currentUser.id);
      groupData.autoDeleteHours = selectedAutoDeleteHours;
      setShowAutoDeleteModal(false);
      if (onRefreshGroups) onRefreshGroups();
      setCopiedToastText(
        selectedAutoDeleteHours === 0
          ? 'حذف خودکار پیام‌ها غیرفعال شد'
          : `حذف خودکار برای پیام‌های قدیمی‌تر از ${formatAutoDeleteHours(selectedAutoDeleteHours)} تنظیم شد`
      );
      setTimeout(() => setCopiedToastText(null), 3000);
    } catch (err: any) {
      alert(err.message || 'خطا در ذخیره تنظیمات حذف خودکار');
    } finally {
      setIsSavingAutoDelete(false);
    }
  };

  // Helper to format auto delete duration in Persian
  const formatAutoDeleteHours = (hours: number): string => {
    if (!hours || hours === 0) return 'خاموش (بدون حذف)';
    if (hours === 1) return '۱ ساعت';
    if (hours === 6) return '۶ ساعت';
    if (hours === 12) return '۱۲ ساعت';
    if (hours === 24) return '۲۴ ساعت (۱ روز)';
    if (hours === 48) return '۴۸ ساعت (۲ روز)';
    if (hours === 168) return '۷ روز (یک هفته)';
    if (hours === 720) return '۳۰ روز (یک ماه)';
    return `${hours} ساعت`;
  };

  // Filter and deduplicate messages for this chat to guarantee strictly unique keys
  const chatMessages = React.useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of messages) {
      if (m.chatId === chatId) {
        map.set(m.id, m);
      }
    }
    return Array.from(map.values());
  }, [messages, chatId]);

  const pinnedMessage = chatMessages.find(m => m.isPinned);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  // Handle Send text message or Save edited message
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const textToSend = inputText.trim();

    // If currently editing an existing message
    if (editingMessage) {
      const msgIdToEdit = editingMessage.id;
      setIsSending(true);
      setInputText('');
      setEditingMessage(null);

      try {
        if (onEditMessage) {
          await onEditMessage(msgIdToEdit, textToSend);
        } else {
          await api.editMessage(msgIdToEdit, textToSend, currentUser.id);
        }
        setEditToast('پیام با موفقیت ویرایش شد');
        setTimeout(() => setEditToast(null), 3000);
      } catch (err: any) {
        alert(err.message || 'خطا در ویرایش پیام');
        setInputText(textToSend);
      } finally {
        setIsSending(false);
      }
      return;
    }

    setIsSending(true);
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
      setInputText(textToSend); // Restore unsent message
    } finally {
      setIsSending(false);
    }
  };

  // Real Microphone Audio Recording with Live Speech-to-Text
  const startRecording = async () => {
    setMicNotice(null);
    setSpeechTranscript('');
    setShowVoiceTemplates(false);

    // Initialize native Speech-to-Text in parallel
    try {
      speechControllerRef.current = startSpeechToText({
        lang: 'fa-IR',
        onResult: (transcript) => {
          setSpeechTranscript(transcript);
        },
        onError: (err) => {
          console.warn('SpeechRecognition error:', err);
        }
      });
    } catch (e) {
      console.warn('SpeechToText init notice:', e);
    }

    try {
      const recorder = await startAudioRecording();
      activeRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordTimer(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordTimer(prev => prev + 1);
      }, 1000);

      audioLevelIntervalRef.current = setInterval(() => {
        if (activeRecorderRef.current) {
          setAudioLevel(activeRecorderRef.current.getAudioLevel());
        }
      }, 100);
    } catch (err: any) {
      console.warn('Microphone error or fallback:', err);
      setMicNotice(err.message || 'دسترسی به میکروفون میسر نشد، حالت شبیه‌ساز صوتی فعال شد.');
      // Start fallback recorder with timer
      setIsRecording(true);
      setRecordTimer(0);
      recordIntervalRef.current = setInterval(() => {
        setRecordTimer(prev => prev + 1);
      }, 1000);
    }
  };

  // Convert Voice to Written Text and Send Directly
  // Requirement: "پیام صوتی بفرستیم به متن نوشتاری تبدیل و ارسال بشه"
  const stopAndSendAsText = async (customText?: string) => {
    clearInterval(recordIntervalRef.current);
    clearInterval(audioLevelIntervalRef.current);
    setIsRecording(false);
    setRecordTimer(0);
    setAudioLevel(0);
    setIsSendingVoice(true);

    if (activeRecorderRef.current) {
      try {
        await activeRecorderRef.current.stop();
      } catch (e) {
        // ignore
      }
      activeRecorderRef.current = null;
    }
    if (speechControllerRef.current) {
      speechControllerRef.current.stop();
      speechControllerRef.current = null;
    }

    const textToSend = (customText || speechTranscript).trim() || 'سلام و درود، پیام صوتی تبدیل‌شده به متن نوشتاری';

    try {
      const msg = await api.sendMessage({
        chatId,
        senderId: currentUser.id,
        content: textToSend,
        type: 'text',
        isVoiceTranscribed: true,
      });
      onSendMessage(msg);
      setSpeechTranscript('');
      setShowVoiceTemplates(false);
    } catch (err: any) {
      console.error('Failed to send converted voice text:', err);
      alert(err.message || 'خطا در ارسال متن صوتی');
    } finally {
      setIsSendingVoice(false);
    }
  };

  // Convert Spoken Persian Voice to English Translation and Send Directly
  // Requirement: "مثلا فارسی صحبت بکنیم انگلیسی ترجمه و ارسال بشه"
  const stopAndSendAsEnglish = async (mode: 'english-only' | 'bilingual' = 'english-only') => {
    clearInterval(recordIntervalRef.current);
    clearInterval(audioLevelIntervalRef.current);
    setIsRecording(false);
    setRecordTimer(0);
    setAudioLevel(0);
    setIsSendingVoice(true);

    if (activeRecorderRef.current) {
      try {
        await activeRecorderRef.current.stop();
      } catch (e) {
        // ignore
      }
      activeRecorderRef.current = null;
    }
    if (speechControllerRef.current) {
      speechControllerRef.current.stop();
      speechControllerRef.current = null;
    }

    const rawPersian = speechTranscript.trim() || 'سلام و خسته نباشید همکار گرامی';
    let englishText = translatedSpeechEnglish.trim();

    // If English translation hasn't finished yet, translate now on the fly
    if (!englishText) {
      try {
        const res = await api.translate(rawPersian, 'en', 'fa');
        if (res && res.translatedText) {
          englishText = res.translatedText;
        }
      } catch (err) {
        console.warn('Failed to translate speech on send:', err);
      }
    }

    const effectiveEnglish = englishText || rawPersian;
    const finalContent = mode === 'bilingual'
      ? `${effectiveEnglish}\n──────────────\nمتن گفتار فارسی: ${rawPersian}`
      : effectiveEnglish;

    try {
      const msg = await api.sendMessage({
        chatId,
        senderId: currentUser.id,
        content: finalContent,
        type: 'text',
        isVoiceTranscribed: true,
        isVoiceTranslated: true,
        originalSpokenText: rawPersian,
      });
      onSendMessage(msg);
      setSpeechTranscript('');
      setTranslatedSpeechEnglish('');
      setShowVoiceTemplates(false);
    } catch (err: any) {
      console.error('Failed to send translated voice text:', err);
      alert(err.message || 'خطا در ارسال ترجمه انگلیسی پیام صوتی');
    } finally {
      setIsSendingVoice(false);
    }
  };

  // Send Audio Recording along with written transcript
  const stopAndSendRecording = async () => {
    clearInterval(recordIntervalRef.current);
    clearInterval(audioLevelIntervalRef.current);
    const duration = Math.max(1, recordTimer);
    setIsRecording(false);
    setRecordTimer(0);
    setAudioLevel(0);
    setIsSendingVoice(true);

    if (speechControllerRef.current) {
      speechControllerRef.current.stop();
      speechControllerRef.current = null;
    }

    try {
      let audioDataUrl = '';
      if (activeRecorderRef.current) {
        const result = await activeRecorderRef.current.stop();
        audioDataUrl = result.dataUrl;
        activeRecorderRef.current = null;
      } else {
        // Generate real audible voice wave
        audioDataUrl = generateSyntheticVoiceWav(duration);
      }

      const transcript = speechTranscript.trim();

      const msg = await api.sendMessage({
        chatId,
        senderId: currentUser.id,
        content: transcript || `پیام صوتی (${duration} ثانیه)`,
        type: 'voice',
        fileUrl: audioDataUrl,
        voiceDuration: duration,
        voiceTranscript: transcript || undefined,
        isVoiceTranscribed: !!transcript,
      });
      onSendMessage(msg);
      setSpeechTranscript('');
      setShowVoiceTemplates(false);
    } catch (err: any) {
      console.error('Failed to send voice message:', err);
      alert(err.message || 'خطا در ارسال پیام صوتی');
    } finally {
      setIsSendingVoice(false);
      activeRecorderRef.current = null;
    }
  };

  const cancelRecording = () => {
    clearInterval(recordIntervalRef.current);
    clearInterval(audioLevelIntervalRef.current);
    if (activeRecorderRef.current) {
      activeRecorderRef.current.cancel();
      activeRecorderRef.current = null;
    }
    if (speechControllerRef.current) {
      speechControllerRef.current.cancel();
      speechControllerRef.current = null;
    }
    setIsRecording(false);
    setRecordTimer(0);
    setAudioLevel(0);
    setMicNotice(null);
    setSpeechTranscript('');
    setShowVoiceTemplates(false);
  };

  // Transfer transcribed speech into input box for editing/translation
  const transferSpeechToInput = (lang: 'fa' | 'en' = 'fa') => {
    const textToInsert = lang === 'en'
      ? (translatedSpeechEnglish.trim() || 'Hello, dear colleagues.')
      : (speechTranscript.trim() || 'سلام و خسته نباشید همکاران گرامی');
    setInputText(prev => prev ? `${prev} ${textToInsert}` : textToInsert);
    cancelRecording();
  };

  // Direct Voice Typing into input box (Persian or Live English Translation)
  const toggleVoiceTyping = () => {
    if (isVoiceTyping) {
      if (speechControllerRef.current) {
        speechControllerRef.current.stop();
        speechControllerRef.current = null;
      }
      setIsVoiceTyping(false);
      voiceTypingInitialTextRef.current = '';
    } else {
      setIsVoiceTyping(true);
      voiceTypingInitialTextRef.current = inputText.trim();
      const controller = startSpeechToText({
        lang: 'fa-IR',
        onResult: async (transcript) => {
          const initial = voiceTypingInitialTextRef.current;
          if (voiceTypingTargetLang === 'en') {
            try {
              const res = await api.translate(transcript, 'en', 'fa');
              const enText = res.translatedText || transcript;
              setInputText(initial ? `${initial} ${enText}` : enText);
            } catch {
              setInputText(initial ? `${initial} ${transcript}` : transcript);
            }
          } else {
            setInputText(initial ? `${initial} ${transcript}` : transcript);
          }
        },
        onError: (err) => {
          console.warn('Voice typing error:', err);
          setIsVoiceTyping(false);
          voiceTypingInitialTextRef.current = '';
        },
        onEnd: () => {
          setIsVoiceTyping(false);
          voiceTypingInitialTextRef.current = '';
        }
      });
      speechControllerRef.current = controller;
      if (!controller.isSupported) {
        setIsVoiceTyping(false);
        voiceTypingInitialTextRef.current = '';
        alert('مرورگر شما از تایپ صوتی خودکار پشتیبانی نمی‌کند یا دسترسی به میکروفون محدود است.');
      }
    }
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

  // Helper to detect if a message is pure stickers/emojis
  const isStickerOnly = (text?: string): boolean => {
    if (!text) return false;
    const trimmed = text.trim();
    const emojiRegex = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\u200d|\ufe0f|\u20e3){1,6}$/u;
    return emojiRegex.test(trimmed);
  };

  // Quick Emoji reactions (enlarged & education-themed)
  const quickEmojis = ['👍', '❤️', '👏', '🙏', '✅', '🔥', '🎉', '🌹', '💯', '🌸', '💐', '📚', '🎓', '⭐'];

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

        <div className="flex items-center gap-1">
          {/* Principal Special Tools: Clear Chat History & Auto-Delete Settings */}
          {isPrincipal && (
            <>
              {isGroup && (
                <button
                  type="button"
                  onClick={() => setShowAutoDeleteModal(true)}
                  className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-[11px] ${
                    groupData?.autoDeleteHours && groupData.autoDeleteHours > 0
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700/60'
                  }`}
                  title="تنظیم مدت زمان حذف خودکار پیام‌ها"
                >
                  <Timer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {groupData?.autoDeleteHours && groupData.autoDeleteHours > 0
                      ? `حذف خودکار: ${formatAutoDeleteHours(groupData.autoDeleteHours)}`
                      : 'حذف خودکار'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowClearHistoryModal(true)}
                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-200 border border-rose-500/30 transition-all flex items-center gap-1 text-[11px]"
                title="پاکسازی سابقه پیام‌های این گفتگو توسط مدیر"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">پاکسازی تاریخچه</span>
              </button>
            </>
          )}

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
            const isMedia = msg.type === 'image' || msg.type === 'video' || (msg.fileUrl && (msg.fileUrl.startsWith('data:image') || msg.fileUrl.match(/\.(jpg|jpeg|png|webp|gif)/i)));
            const isSticker = isStickerOnly(msg.content);

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

                {/* Message Bubble - Thinner subtle frame for media, sticker support, with long-press to copy */}
                <div
                  onMouseDown={() => {
                    const textToCopy = msg.content || msg.voiceTranscript || '';
                    if (textToCopy) handleStartLongPress(textToCopy, msg.id);
                  }}
                  onMouseUp={handleCancelLongPress}
                  onMouseLeave={handleCancelLongPress}
                  onTouchStart={() => {
                    const textToCopy = msg.content || msg.voiceTranscript || '';
                    if (textToCopy) handleStartLongPress(textToCopy, msg.id);
                  }}
                  onTouchEnd={handleCancelLongPress}
                  onTouchCancel={handleCancelLongPress}
                  onContextMenu={(e) => {
                    // Prevent default context menu on long press and trigger copy
                    const textToCopy = msg.content || msg.voiceTranscript || '';
                    if (textToCopy && !isMedia) {
                      e.preventDefault();
                      handleCopyMessageText(textToCopy, msg.id);
                    }
                  }}
                  className={`max-w-[85%] rounded-2xl shadow-md relative transition-all cursor-pointer select-text ${
                    copiedMessageId === msg.id ? 'ring-2 ring-emerald-400 scale-[1.01]' : ''
                  } ${
                    isMedia ? 'p-1.5' : isSticker ? 'p-1 bg-transparent shadow-none' : 'p-3'
                  } ${
                    msg.type === 'announcement'
                      ? 'bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/70 border border-amber-500/40 text-amber-100 rounded-br-none'
                      : isSticker
                        ? 'text-slate-100'
                        : isMe
                          ? isMedia
                            ? 'bg-blue-600/70 border border-blue-400/30 text-white rounded-bl-none'
                            : 'bg-blue-600 text-white rounded-bl-none'
                          : isMedia
                            ? 'bg-slate-900 border border-slate-800 text-slate-100 rounded-br-none'
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

                  {/* Message Content: Real Voice Message Player with Transcript */}
                  {msg.type === 'voice' && (
                    <div className="space-y-1.5">
                      <VoiceMessagePlayer
                        audioUrl={msg.fileUrl}
                        duration={msg.voiceDuration || 3}
                        messageId={msg.id}
                        isMe={isMe}
                        isActive={activeAudioId === msg.id}
                        onPlay={(id) => setActiveAudioId(id)}
                        onPause={() => setActiveAudioId(null)}
                      />
                      {msg.voiceTranscript && (
                        <div className="p-2 rounded-xl bg-black/25 border border-white/10 text-xs text-slate-100">
                          <div className="flex items-center justify-between text-[10px] text-slate-300 mb-1">
                            <span className="flex items-center gap-1 text-emerald-300 font-bold">
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              <span>متن گفتار صوتی:</span>
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed select-text font-medium text-slate-100 text-[11px]">
                            {msg.voiceTranscript}
                          </p>
                        </div>
                      )}
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

                  {/* Message Content: Image / Classroom Photo (Slim frame) */}
                  {(msg.type === 'image' || (msg.fileUrl && (msg.fileUrl.startsWith('data:image') || msg.fileUrl.match(/\.(jpg|jpeg|png|webp|gif)/i)))) && (
                    <div 
                      onClick={() => setActiveLightboxImage({
                        url: msg.fileUrl || '',
                        senderName: msg.senderName,
                        senderAvatar: msg.senderAvatar,
                        caption: msg.content,
                        timestamp: msg.timestamp
                      })}
                      onTouchStart={(e) => {
                        if (e.touches.length === 2) {
                          setActiveLightboxImage({
                            url: msg.fileUrl || '',
                            senderName: msg.senderName,
                            senderAvatar: msg.senderAvatar,
                            caption: msg.content,
                            timestamp: msg.timestamp
                          });
                        }
                      }}
                      className="rounded-xl overflow-hidden relative group cursor-pointer bg-black/40 select-none shadow-sm"
                      title="لمس برای بزرگ‌نمایی و تغییر اندازه با دو انگشت"
                    >
                      <img
                        src={msg.fileUrl}
                        alt={msg.content || 'تصویر گزارش کلاسی'}
                        className="w-full max-h-72 object-cover rounded-lg group-hover:scale-[1.01] transition-all duration-200"
                        loading="lazy"
                      />
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[9px] text-white flex items-center gap-1 border border-white/20 shadow">
                        <Camera className="w-3 h-3 text-blue-400" />
                        <span>گزارش کلاسی</span>
                      </div>
                      <div className="absolute bottom-2 left-2 p-1.5 rounded-lg bg-black/70 backdrop-blur-sm text-amber-300 opacity-90 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] shadow border border-white/10">
                        <Maximize2 className="w-3 h-3" />
                        <span>بزرگ‌نمایی دو انگشتی</span>
                      </div>
                    </div>
                  )}

                  {/* Message Content: Video / Classroom Clip */}
                  {msg.type === 'video' && msg.fileUrl && (
                    <div className="rounded-xl overflow-hidden relative bg-black shadow-md">
                      <video
                        src={msg.fileUrl}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full max-h-72 object-contain rounded-lg bg-black"
                      />
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[9px] text-white flex items-center gap-1 border border-white/20 shadow pointer-events-none">
                        <Video className="w-3 h-3 text-rose-400" />
                        <span>ویدیوی کلاسی</span>
                        {msg.videoDuration && (
                          <span className="font-mono text-slate-300">({formatAudioTime(msg.videoDuration)})</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Text content / Caption / Large Sticker */}
                  {msg.type !== 'voice' && msg.content && (
                    <>
                      {msg.isVoiceTranslated ? (
                        <div className="flex flex-col gap-1 mb-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-cyan-300 font-bold opacity-95">
                            <Languages className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>ترجمه اختصاصی از گفتار فارسی به انگلیسی</span>
                          </div>
                          {msg.originalSpokenText && (
                            <div className="text-[10px] text-slate-300 bg-black/25 px-2 py-1 rounded-lg border border-white/10" dir="rtl">
                              <span className="text-slate-400 font-normal">گفتار اولیه فارسی: </span>
                              <span className="font-medium text-slate-200">«{msg.originalSpokenText}»</span>
                            </div>
                          )}
                        </div>
                      ) : msg.isVoiceTranscribed ? (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-300 font-semibold mb-1 opacity-90">
                          <Sparkles className="w-3 h-3 text-emerald-400" />
                          <span>ارسال شده با تبدیل گفتار به متن</span>
                        </div>
                      ) : null}
                      {isSticker ? (
                        <div className="text-5xl sm:text-6xl py-2 px-1 text-center select-text hover:scale-110 active:scale-95 transition-transform cursor-pointer leading-none">
                          {msg.content}
                        </div>
                      ) : (
                        <p
                          dir={msg.isVoiceTranslated ? 'ltr' : 'auto'}
                          className={`text-xs leading-relaxed whitespace-pre-wrap select-text ${isMedia ? 'px-1.5 pt-1.5 pb-0.5' : ''} ${msg.isVoiceTranslated ? 'font-sans tracking-wide text-slate-100' : ''}`}
                        >
                          {msg.content}
                        </p>
                      )}
                    </>
                  )}

                  {/* Optional Message Translation Card */}
                  {messageTranslations[msg.id]?.loading && (
                    <div className="mt-2 pt-1.5 border-t border-white/10 text-[10px] text-indigo-300 flex items-center gap-1.5 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>در حال ترجمه متن...</span>
                    </div>
                  )}
                  {messageTranslations[msg.id]?.translated && (
                    <div className="mt-2 pt-1.5 border-t border-white/15 text-xs text-indigo-100 bg-black/25 p-2 rounded-xl border border-indigo-400/20" dir="ltr">
                      <div className="text-[9px] text-indigo-300 font-bold mb-0.5 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Languages className="w-3 h-3 text-indigo-400" />
                          <span>Translation:</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(messageTranslations[msg.id].translated);
                          }}
                          className="hover:text-white p-0.5"
                          title="کپی ترجمه"
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      <div className="font-sans text-[11px] leading-relaxed select-text font-normal text-slate-100">
                        {messageTranslations[msg.id].translated}
                      </div>
                    </div>
                  )}

                  {/* Footer: Time, Pin icon, Read status */}
                  <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                    isMedia ? 'px-1.5 pb-0.5' : ''
                  } ${
                    isMe ? (isSticker ? 'text-slate-400' : 'text-blue-100/80') : 'text-slate-400'
                  }`}>
                    {msg.isPinned && (
                      <span title="سنجاق شده">
                        <Pin className="w-2.5 h-2.5 text-amber-400 rotate-45 mr-1" />
                      </span>
                    )}
                    {msg.isEdited && (
                      <span className="text-[9px] opacity-80 font-medium flex items-center gap-0.5 text-amber-300/90" title="این پیام ویرایش شده است">
                        <Pencil className="w-2.5 h-2.5" />
                        <span>ویرایش‌شده</span>
                      </span>
                    )}
                    <span className="font-mono">{msg.timestamp}</span>
                    {isMe && (
                      <CheckCheck className="w-3 h-3 text-blue-200" />
                    )}
                  </div>
                </div>

                {/* Reactions Display (Larger and bolder stickers) */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5 px-0.5">
                    {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                      const hasReacted = userIds.includes(currentUser.id);
                      return (
                        <button
                          key={emoji}
                          onClick={() => onReactMessage(msg.id, emoji)}
                          className={`px-2 py-0.5 rounded-full border flex items-center gap-1.5 transition-all shadow-sm ${
                            hasReacted
                              ? 'bg-blue-600/30 border-blue-500/70 text-blue-200'
                              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-base sm:text-lg leading-none">{emoji}</span>
                          <span className="text-[11px] font-mono font-bold">{userIds.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Action Toolbar on click / hover */}
                <div className="opacity-70 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1 mt-0.5 px-1 text-slate-400">
                  <button
                    onClick={() => setReplyTarget(msg)}
                    className="p-1 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                    title="پاسخ"
                  >
                    <Reply className="w-3 h-3" />
                  </button>

                  {/* Edit message button (only for sender's own text or announcement message) */}
                  {isMe && (!msg.type || msg.type === 'text' || msg.type === 'announcement') && !isSticker && (
                    <button
                      onClick={() => {
                        setEditingMessage(msg);
                        setReplyTarget(null);
                        setInputText(msg.content);
                        setTimeout(() => messageInputRef.current?.focus(), 50);
                      }}
                      className={`p-1 rounded transition-colors ${
                        editingMessage?.id === msg.id
                          ? 'text-amber-400 bg-amber-500/20'
                          : 'hover:text-amber-300 hover:bg-slate-800'
                      }`}
                      title="ویرایش پیام ارسال شده"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}

                  {/* Copy message button */}
                  {(msg.content || msg.voiceTranscript) && !isSticker && (
                    <button
                      onClick={() => handleCopyMessageText(msg.content || msg.voiceTranscript || '', msg.id)}
                      className={`p-1 rounded transition-colors ${
                        copiedMessageId === msg.id
                          ? 'text-emerald-400 bg-emerald-500/20'
                          : 'hover:text-slate-200 hover:bg-slate-800'
                      }`}
                      title="کپی متن پیام (یا نگه داشتن دست روی متن)"
                    >
                      {copiedMessageId === msg.id ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}

                  {/* Translation action button for text messages */}
                  {msg.content && msg.type !== 'voice' && !isSticker && (
                    <button
                      onClick={() => handleTranslateMessage(msg.id, msg.content)}
                      className={`p-1 rounded transition-colors ${
                        messageTranslations[msg.id]
                          ? 'text-indigo-400 bg-indigo-500/20'
                          : 'hover:text-indigo-300 hover:bg-slate-800'
                      }`}
                      title="ترجمه متن پیام به انگلیسی یا فارسی"
                    >
                      <Languages className="w-3 h-3" />
                    </button>
                  )}

                  <button
                    onClick={() => setShowReactionPickerForId(showReactionPickerForId === msg.id ? null : msg.id)}
                    className="p-1 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                    title="واکنش"
                  >
                    <Smile className="w-3 h-3" />
                  </button>

                  {isPrincipal && (
                    <button
                      onClick={() => onPinMessage(msg.id)}
                      className={`p-1 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors ${msg.isPinned ? 'text-amber-400' : ''}`}
                      title={msg.isPinned ? 'برداشتن سنجاق' : 'سنجاق کردن پیام'}
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                  )}

                  {/* Delete message button (Sender can delete own message, Principal can delete any message) */}
                  {(isMe || isPrincipal) && (
                    <button
                      onClick={() => setDeleteConfirmMsg(msg)}
                      className="p-1 text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      title={isMe ? 'حذف پیام ارسالی من' : 'حذف پیام کاربر (توسط مدیر)'}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Emoji Picker Popover (Enlarged) */}
                {showReactionPickerForId === msg.id && (
                  <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl rounded-2xl p-2 flex items-center gap-1.5 z-30 mt-1 animate-in fade-in zoom-in-95">
                    {quickEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onReactMessage(msg.id, emoji);
                          setShowReactionPickerForId(null);
                        }}
                        className="hover:scale-135 active:scale-95 transition-transform p-1 text-2xl leading-none"
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowReactionPickerForId(null)}
                      className="text-slate-500 hover:text-slate-300 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
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

      {/* Editing Message Banner */}
      {editingMessage && (
        <div className="bg-amber-950/70 border-t border-amber-500/40 px-3 py-2 flex items-center justify-between text-xs backdrop-blur-md animate-in slide-in-from-bottom-1">
          <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
            <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              <Pencil className="w-3.5 h-3.5" />
            </div>
            <div className="truncate text-[11px] flex-1">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <span>ویرایش پیام</span>
                <span className="text-[10px] text-amber-400/80 font-normal">(برای لغو، دکمه انصراف یا Esc را بزنید)</span>
              </div>
              <div className="text-slate-300 truncate text-[10px] opacity-90 mt-0.5">{editingMessage.content}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsExpandedInput(prev => !prev)}
              className="text-amber-300 hover:text-amber-200 px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 transition-colors flex items-center gap-1 text-[11px] font-medium"
              title={isExpandedInput ? "کوچک کردن کادر" : "بزرگ کردن کادر برای ویرایش راحت‌تر"}
            >
              {isExpandedInput ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isExpandedInput ? "نمای عادی" : "کادر بزرگ"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingMessage(null);
                setInputText('');
                setIsExpandedInput(false);
              }}
              className="text-slate-300 hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1 text-[11px] font-medium"
              title="انصراف از ویرایش پیام"
            >
              <span>انصراف</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Attachment Options Menu */}
      {showAttachMenu && (
        <div className="bg-slate-900 border-t border-slate-800 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 z-20">
          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false);
              setCameraModalMode('photo');
              setShowCameraModal(true);
            }}
            className="p-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 flex flex-col items-center gap-1.5 text-blue-300 transition-all group"
          >
            <Camera className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-medium">عکس کلاسی</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false);
              setCameraModalMode('video');
              setShowCameraModal(true);
            }}
            className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 flex flex-col items-center gap-1.5 text-rose-300 transition-all group"
          >
            <Video className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-medium">فیلم‌برداری و ویدیو</span>
          </button>

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
            className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 flex flex-col items-center gap-1.5 text-emerald-300 transition-all"
          >
            <FileText className="w-5 h-5 text-emerald-400" />
            <span className="text-[10px] font-medium">فایل و سند</span>
          </button>
        </div>
      )}

      {/* Stickers and Praise Badges Drawer */}
      {showStickerDrawer && (
        <div className="bg-slate-900 border-t border-slate-800 p-3 z-20 animate-in slide-in-from-bottom duration-150">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800 text-xs font-semibold text-slate-300">
            <div className="flex items-center gap-1.5">
              <Smile className="w-4 h-4 text-amber-400" />
              <span>استیکرها و نشان‌های تشویقی کادر آموزشی</span>
            </div>
            <button
              onClick={() => setShowStickerDrawer(false)}
              className="text-slate-400 hover:text-slate-200 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Praise Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none">
            {['عالی 👏', 'خسته نباشید 🌹', 'آفرین ⭐', 'تایید شد ✅', 'با تشکر 🙏', 'موفق باشید 🎓', 'درجه یک 💯'].map((praise, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendDirectSticker(praise)}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-blue-600/30 text-slate-200 hover:text-blue-300 border border-slate-700 text-xs whitespace-nowrap transition-all active:scale-95 shadow-sm"
              >
                {praise}
              </button>
            ))}
          </div>

          {/* Large Stickers Grid */}
          <div className="grid grid-cols-7 sm:grid-cols-9 gap-2 max-h-40 overflow-y-auto p-1">
            {[
              '👍', '❤️', '👏', '🙏', '✅', '🔥', '🎉',
              '🌹', '🌸', '💐', '📚', '🎓', '✍️', '🏫',
              '💯', '⭐', '🏆', '🥇', '✨', '👌', '🤝',
              '💪', '🎯', '📝', '🔔', '📢', '💡', '⏰'
            ].map((stk, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendDirectSticker(stk)}
                className="text-3xl sm:text-4xl p-1.5 hover:scale-130 active:scale-95 transition-transform flex items-center justify-center rounded-xl hover:bg-slate-800/80"
                title="ارسال استیکر"
              >
                {stk}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Audio Recording State Bar with Live Speech-to-Text */}
      {isRecording && (
        <div className="p-3 bg-slate-900/98 border-t border-indigo-500/50 flex flex-col gap-2.5 text-xs text-slate-200 z-30 shadow-2xl backdrop-blur-md">
          {/* Top row: Recording status, timer, audio level waveform, and templates toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center">
                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping absolute" />
                <span className="w-3.5 h-3.5 rounded-full bg-rose-500" />
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-rose-300 font-mono text-sm">
                    {formatAudioTime(recordTimer)}
                  </span>
                  <span className="text-[11px] text-slate-300 font-medium">
                    {micNotice ? 'در حال ضبط صدا...' : 'در حال شنیدن و تبدیل گفتار به متن فارسی...'}
                  </span>
                </div>

                {/* Dynamic waveform responding to microphone audio level */}
                <div className="flex items-center gap-1 mt-1 h-3">
                  {[12, 24, 40, 65, 85, 95, 80, 60, 45, 30, 18, 28, 50, 75, 90, 65, 35].map((baseH, idx) => {
                    const scale = Math.max(0.25, audioLevel / 100);
                    const h = Math.max(3, Math.min(14, Math.round((baseH * scale) / 6)));
                    return (
                      <div
                        key={idx}
                        style={{ height: `${h}px` }}
                        className="w-[2.5px] bg-rose-400 rounded-full transition-all duration-75"
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowVoiceTemplates(prev => !prev)}
                className="px-2 py-1 text-[10px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="مشاهده نمونه جملات آماده مدرسه"
              >
                جملات نمونه
              </button>

              <button
                type="button"
                onClick={cancelRecording}
                disabled={isSendingVoice}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                title="لغو و حذف ضبط"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick School Voice Templates (if toggled) */}
          {showVoiceTemplates && (
            <div className="p-2.5 bg-slate-950/90 rounded-xl border border-slate-800 space-y-1.5 animate-in fade-in">
              <div className="text-[10px] text-slate-400 font-medium">
                برای تست سریع تبدیل صدا به متن، روی یکی از نمونه‌های زیر کلیک کنید:
              </div>
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                {SCHOOL_VOICE_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSpeechTranscript(tmpl);
                      setShowVoiceTemplates(false);
                    }}
                    className="text-[11px] text-right p-1.5 bg-slate-800/80 hover:bg-indigo-600/30 text-slate-200 hover:text-indigo-200 rounded-lg border border-slate-700/60 transition-colors leading-relaxed"
                  >
                    «{tmpl}»
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dual-Card Live Speech & English Translation Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Card 1: Spoken Persian Box */}
            <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] text-slate-300 mb-1">
                <span className="flex items-center gap-1 font-bold text-amber-300">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>متن گفتار شما (فارسی):</span>
                </span>
                {speechTranscript && (
                  <button
                    type="button"
                    onClick={() => transferSpeechToInput('fa')}
                    className="text-slate-400 hover:text-indigo-300 flex items-center gap-0.5 text-[10px]"
                    title="انتقال متن فارسی به کادر پیام"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>انتقال متن</span>
                  </button>
                )}
              </div>
              <p className="text-slate-100 min-h-[22px] leading-relaxed font-medium">
                {speechTranscript ? (
                  `«${speechTranscript}»`
                ) : (
                  <span className="text-slate-500 italic text-[11px]">
                    فارسی صحبت کنید تا متن و ترجمه انگلیسی آن آماده شود...
                  </span>
                )}
              </p>
            </div>

            {/* Card 2: Live English Translation Box */}
            <div className="p-2.5 rounded-xl bg-slate-950/90 border border-indigo-500/40 flex flex-col justify-between" dir="ltr">
              <div className="flex items-center justify-between text-[10px] text-indigo-300 mb-1">
                <span className="flex items-center gap-1 font-bold text-indigo-300">
                  <Languages className="w-3.5 h-3.5 text-cyan-400" />
                  <span>English Translation (ترجمه):</span>
                </span>
                {translatedSpeechEnglish && (
                  <button
                    type="button"
                    onClick={() => transferSpeechToInput('en')}
                    className="text-indigo-300 hover:text-white flex items-center gap-0.5 text-[10px]"
                    title="انتقال ترجمه انگلیسی به کادر پیام"
                  >
                    <span>Insert EN</span>
                  </button>
                )}
              </div>
              <p className="text-indigo-100 min-h-[22px] leading-relaxed font-sans text-[11px]">
                {translatedSpeechEnglish ? (
                  `"${translatedSpeechEnglish}"`
                ) : isTranslatingVoice ? (
                  <span className="text-indigo-400/80 italic flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin inline" />
                    Translating to English...
                  </span>
                ) : (
                  <span className="text-slate-600 italic">
                    {speechTranscript ? 'Generating English...' : 'English translation appears here live...'}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action buttons: Translate to English & Send / Bilingual / Persian Text / Voice */}
          <div className="flex items-center justify-end gap-1.5 pt-1 flex-wrap">
            {/* Main Highlight Action: Speak Persian -> Translate to English and Send */}
            <button
              type="button"
              onClick={() => stopAndSendAsEnglish('english-only')}
              disabled={isSendingVoice}
              className="py-1.5 px-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl shadow-md shadow-indigo-600/30 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              title="ترجمه خودکار گفتار شما به انگلیسی و ارسال مستقیم"
            >
              {isSendingVoice ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Languages className="w-3.5 h-3.5 text-cyan-300" />
              )}
              <span>ترجمه به انگلیسی و ارسال</span>
            </button>

            {/* Bilingual Action: English + Original Persian */}
            <button
              type="button"
              onClick={() => stopAndSendAsEnglish('bilingual')}
              disabled={isSendingVoice}
              className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-200 rounded-xl border border-indigo-500/40 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
              title="ارسال هر دو متن انگلیسی و گفتار اولیه فارسی با هم"
            >
              <span>ارسال دوزبانه (FA+EN)</span>
            </button>

            {/* Action 3: Send converted voice as Persian text */}
            <button
              type="button"
              onClick={() => stopAndSendAsText()}
              disabled={isSendingVoice}
              className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
              title="ارسال به صورت متن فارسی"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>ارسال متن فارسی</span>
            </button>

            {/* Action 4: Send Audio + Transcript */}
            <button
              type="button"
              onClick={stopAndSendRecording}
              disabled={isSendingVoice}
              className="py-1.5 px-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md shadow-rose-600/30 text-xs font-bold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
              title="ارسال فایل صوتی همراه با متن پیاده‌سازی‌شده"
            >
              <Send className="w-3.5 h-3.5" />
              <span>ارسال صوت</span>
            </button>
          </div>
        </div>
      )}

      {/* Persian <-> English Translator Drawer */}
      {showTranslator && (
        <div className="bg-slate-900 border-t border-indigo-500/40 p-3 max-h-80 overflow-y-auto space-y-2.5 z-20 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Languages className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-100">مترجم هوشمند فارسی ⇄ انگلیسی کادر تایپ</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const nextLang = translateTargetLang === 'en' ? 'fa' : 'en';
                  setTranslateTargetLang(nextLang);
                  if (inputText.trim()) {
                    handleTranslateInput(inputText.trim(), nextLang);
                  }
                }}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors"
                title="تغییر جهت ترجمه"
              >
                <ArrowLeftRight className="w-3 h-3 text-indigo-400" />
                <span>{translateTargetLang === 'en' ? 'فارسی به انگلیسی' : 'انگلیسی به فارسی'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTranslator(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Current Translation Preview & Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>متن در حال ترجمه:</span>
              <button
                type="button"
                onClick={() => handleTranslateInput(inputText)}
                disabled={!inputText.trim() || isTranslating}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 disabled:opacity-40"
              >
                {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
                <span>{isTranslating ? 'در حال ترجمه...' : 'ترجمه متن فعلی'}</span>
              </button>
            </div>

            {translationResult ? (
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-2 shadow-inner">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>نتیجه ترجمه ({translationResult.targetLang === 'en' ? 'انگلیسی' : 'فارسی'}):</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(translationResult.translated);
                      setCopiedTranslation(true);
                      setTimeout(() => setCopiedTranslation(false), 2000);
                    }}
                    className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[10px]"
                    title="کپی ترجمه"
                  >
                    {copiedTranslation ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedTranslation ? 'کپی شد' : 'کپی'}</span>
                  </button>
                </div>

                <div
                  className={`text-xs p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 select-all font-sans leading-relaxed ${
                    translationResult.targetLang === 'en' ? 'text-left font-mono' : 'text-right'
                  }`}
                  dir={translationResult.targetLang === 'en' ? 'ltr' : 'rtl'}
                >
                  {translationResult.translated}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviousPersianText(inputText);
                      setInputText(translationResult.translated);
                    }}
                    className="flex-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1"
                  >
                    <span>جایگزینی در کادر تایپ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInputText(prev => prev.trim() ? `${prev}\n${translationResult.translated}` : translationResult.translated);
                    }}
                    className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 border border-slate-700"
                    title="ارسال دو زبانه (افزودن ترجمه به انتهای متن)"
                  >
                    <span>+ افزودن به متن</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                متن پیام خود را در کادر پایین بنویسید یا یکی از عبارات پرکاربرد کادر زیر را انتخاب کنید:
              </div>
            )}
          </div>

          {/* Quick Ready School Phrases */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>جملات کاربردی کادر آموزشی مدرسه (با ترجمه آنی):</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-0.5">
              {[
                { fa: 'لطفاً تکالیف جلسه قبل را ارسال فرمایید.', en: "Please submit last session's homework assignments." },
                { fa: 'جلسه شورای دبیران فردا ساعت ۱۰ برگزار می‌شود.', en: "The teachers' council meeting will be held tomorrow at 10 AM." },
                { fa: 'نمرات آزمون مستمر در سامانه ثبت گردید.', en: 'Continuous assessment exam scores have been recorded in the system.' },
                { fa: 'حضور و غیاب دانش‌آموزان به دقت ثبت شد.', en: 'Student attendance has been recorded accurately.' },
                { fa: 'خسته نباشید و خدا قوت به همه همکاران گرامی.', en: 'Well done and more power to all esteemed colleagues.' },
                { fa: 'لطفاً گزارش ماهانه کلاس خود را تحویل دهید.', en: 'Please submit your monthly classroom report.' }
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (translateTargetLang === 'en') {
                      setInputText(item.en);
                      setPreviousPersianText(item.fa);
                      setTranslationResult({ original: item.fa, translated: item.en, targetLang: 'en' });
                    } else {
                      setInputText(item.fa);
                      setTranslationResult({ original: item.en, translated: item.fa, targetLang: 'fa' });
                    }
                  }}
                  className="text-[11px] p-2 rounded-xl bg-slate-950 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-indigo-200 transition-all text-right flex flex-col gap-0.5"
                  title="کلیک برای درج ترجمه انگلیسی"
                >
                  <span className="font-medium truncate">{item.fa}</span>
                  <span className="text-[10px] text-indigo-400/80 font-mono truncate" dir="ltr">{item.en}</span>
                </button>
              ))}
            </div>
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
          <div>
            {/* Quick Live Translate Chip Bar when typing */}
            {inputText.trim().length > 0 && (
              <div className="flex items-center justify-between pb-1.5 px-0.5 text-[11px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleQuickTranslate}
                    disabled={isTranslating}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 font-semibold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 text-[11px]"
                    title="ترجمه فوری کلمات تایپ شده"
                  >
                    {isTranslating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    ) : (
                      <Languages className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>
                      {isTranslating
                        ? 'در حال ترجمه...'
                        : /[\u0600-\u06FF]/.test(inputText)
                        ? 'ترجمه به انگلیسی'
                        : 'ترجمه به فارسی'}
                    </span>
                  </button>

                  {previousPersianText && (
                    <button
                      type="button"
                      onClick={() => {
                        setInputText(previousPersianText);
                        setPreviousPersianText(null);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 text-[10px] transition-all"
                      title="بازگردانی متن اولیه"
                    >
                      <RotateCcw className="w-2.5 h-2.5 text-slate-400" />
                      <span>بازگردانی متن قبلی</span>
                    </button>
                  )}

                  {translateToast && (
                    <span className="text-[10px] text-emerald-400 font-bold animate-in fade-in flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      {translateToast}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowTranslator(prev => !prev);
                    setShowStickerDrawer(false);
                    setShowAttachMenu(false);
                    if (!showTranslator && inputText.trim()) {
                      handleTranslateInput(inputText.trim());
                    }
                  }}
                  className="text-indigo-400 hover:text-indigo-300 text-[10px] flex items-center gap-1 transition-colors font-medium"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{showTranslator ? 'بستن پنل مترجم' : 'پنل مترجم پیشرفته'}</span>
                </button>
              </div>
            )}

            {/* Voice Typing Active Indicator Banner */}
            {isVoiceTyping && (
              <div className="px-3 py-2 bg-indigo-950/95 border-b border-indigo-500/40 flex items-center justify-between text-xs text-indigo-200 backdrop-blur-md animate-in slide-in-from-bottom-2 mb-1.5 rounded-xl gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-[11px] font-medium">
                    {voiceTypingTargetLang === 'en'
                      ? '🎙️ فارسی صحبت کنید، ترجمه انگلیسی همزمان در کادر درج می‌شود...'
                      : '🎙️ در حال شنیدن گفتار شما و تایپ به زبان فارسی...'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex items-center bg-slate-900 border border-indigo-400/30 rounded-lg p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setVoiceTypingTargetLang('fa')}
                      className={`px-2 py-0.5 rounded-md transition-colors ${
                        voiceTypingTargetLang === 'fa'
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      فارسی
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoiceTypingTargetLang('en')}
                      className={`px-2 py-0.5 rounded-md transition-colors flex items-center gap-1 ${
                        voiceTypingTargetLang === 'en'
                          ? 'bg-blue-600 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="ترجمه همزمان گفتار فارسی به انگلیسی"
                    >
                      <Languages className="w-3 h-3 text-cyan-300" />
                      <span>ترجمه انگلیسی</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={toggleVoiceTyping}
                    className="px-2.5 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition-colors"
                  >
                    اتمام
                  </button>
                </div>
              </div>
            )}

            {/* Edit Toast Banner */}
            {editToast && (
              <div className="mb-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs text-emerald-300 animate-in fade-in slide-in-from-bottom-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold text-[11px]">{editToast}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditToast(null)}
                  className="text-emerald-400/70 hover:text-emerald-200 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <form onSubmit={handleSend} className="space-y-1.5">
              {/* Main Input Box with Textarea */}
              <div className="relative flex flex-col bg-slate-950 border border-slate-800 rounded-2xl focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all shadow-inner">
                {/* Textarea */}
                <textarea
                  ref={messageInputRef}
                  value={inputText}
                  rows={isExpandedInput ? 5 : (editingMessage ? 3 : 2)}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && editingMessage) {
                      setEditingMessage(null);
                      setInputText('');
                      setIsExpandedInput(false);
                    } else if (e.key === 'Enter' && !e.shiftKey) {
                      // On desktop (non-touch) pressing Enter without Shift submits; on mobile users can use Shift+Enter or tap the big send button
                      if (window.innerWidth > 768) {
                        e.preventDefault();
                        handleSend();
                      }
                    }
                  }}
                  placeholder={
                    editingMessage
                      ? 'ویرایش پیام... متن اصلاح‌شده را با راحتی بنویسید (Shift+Enter برای خط بعد)'
                      : 'پیام خود را بنویسید یا با صوت بگویید (Shift+Enter برای خط بعد)...'
                  }
                  className={`w-full rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none transition-colors resize-none leading-relaxed ${
                    editingMessage
                      ? 'bg-amber-950/25 border-b border-amber-500/30 text-amber-50'
                      : 'bg-transparent'
                  }`}
                  style={{
                    minHeight: isExpandedInput ? '140px' : (editingMessage ? '72px' : '44px'),
                    maxHeight: isExpandedInput ? '260px' : '150px'
                  }}
                />

                {/* Sub-bar inside textarea container: expand button & char count if long */}
                <div className="flex items-center justify-between px-2.5 py-1 text-[10px] text-slate-400 border-t border-slate-900/80 bg-slate-950/40 rounded-b-2xl">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsExpandedInput(prev => !prev)}
                      className="text-slate-400 hover:text-slate-200 flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-slate-800/60 transition-colors"
                      title={isExpandedInput ? "کوچک کردن کادر" : "بزرگ کردن کادر برای ویرایش راحت‌تر در موبایل"}
                    >
                      {isExpandedInput ? (
                        <>
                          <Minimize2 className="w-3 h-3 text-indigo-400" />
                          <span>کوچک کردن کادر</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3 h-3 text-indigo-400" />
                          <span>بزرگ‌نمایی کادر تایپ</span>
                        </>
                      )}
                    </button>
                    {inputText.length > 50 && (
                      <span className="text-slate-400 font-mono text-[9px]">
                        {inputText.length} کاراکتر
                      </span>
                    )}
                  </div>

                  {editingMessage && (
                    <span className="text-amber-400 text-[10px] font-medium flex items-center gap-1">
                      <Pencil className="w-2.5 h-2.5" />
                      <span>حالت ویرایش</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom Actions Row: Tools + Voice + Big Send Button */}
              <div className="flex items-center justify-between gap-1">
                {/* Left Tools */}
                <div className="flex items-center gap-1 flex-wrap">
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

                  {/* Direct Camera / Video Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setCameraModalMode('photo');
                      setShowCameraModal(true);
                    }}
                    className="p-2 bg-slate-950 hover:bg-slate-850 hover:text-blue-400 text-slate-400 border border-slate-800 rounded-xl transition-colors"
                    title="عکاسی و فیلم‌برداری کلاسی"
                  >
                    <Camera className="w-4 h-4" />
                  </button>

                  {/* Persian <-> English Translator Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowTranslator(!showTranslator);
                      setShowStickerDrawer(false);
                      setShowAttachMenu(false);
                      if (!showTranslator && inputText.trim()) {
                        handleTranslateInput(inputText.trim());
                      }
                    }}
                    className={`p-2 rounded-xl border transition-all flex items-center justify-center relative ${
                      showTranslator
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                        : 'bg-slate-950 hover:bg-slate-850 hover:text-indigo-300 text-slate-400 border-slate-800'
                    }`}
                    title="مترجم فارسی به انگلیسی در هنگام تایپ"
                  >
                    <Languages className="w-4 h-4" />
                    <span className="absolute -top-1 -right-1 text-[8px] bg-indigo-500 text-white font-mono px-1 rounded-full border border-slate-900 font-bold scale-90">
                      EN
                    </span>
                  </button>

                  {/* Sticker Drawer Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowStickerDrawer(!showStickerDrawer);
                      setShowTranslator(false);
                      setShowAttachMenu(false);
                    }}
                    className={`p-2 rounded-xl border transition-all ${
                      showStickerDrawer
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        : 'bg-slate-950 hover:bg-slate-850 text-slate-400 border-slate-800'
                    }`}
                    title="استیکرها و نشان‌های تشویقی"
                  >
                    <Smile className="w-4 h-4" />
                  </button>

                  {/* Voice Typing / Speech-to-Text Button */}
                  <button
                    type="button"
                    onClick={toggleVoiceTyping}
                    className={`p-2 rounded-xl border transition-all relative ${
                      isVoiceTyping
                        ? 'bg-rose-600 text-white border-rose-500 animate-pulse shadow-md shadow-rose-500/30'
                        : 'bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-indigo-400 border-slate-800'
                    }`}
                    title={isVoiceTyping ? 'توقف تبدیل صوت به متن' : (voiceTypingTargetLang === 'en' ? 'تایپ صوتی و ترجمه همزمان به انگلیسی' : 'تایپ صوتی زنده (تبدیل گفتار به متن)')}
                  >
                    <Mic className={`w-4 h-4 ${isVoiceTyping ? 'animate-bounce text-white' : ''}`} />
                    {voiceTypingTargetLang === 'en' && (
                      <span className="absolute -top-1 -right-1 text-[8px] bg-blue-500 text-white font-mono px-1 rounded-full border border-slate-900 font-bold scale-90">
                        EN
                      </span>
                    )}
                  </button>

                  {/* Record Voice Note (with transcription and audio) */}
                  {!editingMessage && inputText.trim().length === 0 && !isVoiceTyping && (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="p-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl text-slate-400 hover:text-rose-400 transition-colors"
                      title="ضبط پیام صوتی (با قابلیت تبدیل به متن نوشتاری و ارسال)"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Right Send or Save Button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {editingMessage && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMessage(null);
                        setInputText('');
                        setIsExpandedInput(false);
                      }}
                      className="px-2.5 py-2 text-slate-300 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors text-xs font-medium"
                      title="انصراف از ویرایش"
                    >
                      انصراف
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className={`px-3 py-2 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 font-bold ${
                      editingMessage
                        ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                        : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
                    }`}
                    title={editingMessage ? 'ذخیره پیام ویرایش شده' : 'ارسال پیام'}
                  >
                    {editingMessage ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span className="text-xs">ذخیره</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span className="text-xs hidden sm:inline">ارسال</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
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
                {Array.from(new Set(groupData.memberIds || [])).map((mId) => {
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
                      <div className="flex items-center gap-2">
                        {member.role === 'principal' ? (
                          <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-medium">
                            مدیر
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-mono">
                              {member.personnelCode}
                            </span>
                            {currentUser.role === 'principal' && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMemberFromCurrentGroup(member.id, member.fullName)}
                                className="p-1 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 bg-rose-500/10 border border-rose-500/20 transition-all flex items-center gap-1 text-[10px] px-2 py-0.5"
                                title={`حذف ${member.fullName} از این گروه`}
                              >
                                <UserMinus className="w-3 h-3" />
                                <span>حذف از گروه</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Principal Admin Controls inside Group Info */}
            {isPrincipal && (
              <div className="mb-3 pt-2 border-t border-slate-800/80 space-y-2">
                <div className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>تنظیمات ویژه مدیر:</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowGroupInfoModal(false);
                      setShowAutoDeleteModal(true);
                    }}
                    className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/70 text-[11px] text-amber-200 hover:text-amber-100 flex flex-col items-center gap-1 transition-all"
                  >
                    <Timer className="w-4 h-4 text-amber-400" />
                    <span>تنظیم حذف خودکار</span>
                    <span className="text-[9px] text-slate-400">
                      {groupData.autoDeleteHours && groupData.autoDeleteHours > 0
                        ? formatAutoDeleteHours(groupData.autoDeleteHours)
                        : 'غیرفعال'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowGroupInfoModal(false);
                      setShowClearHistoryModal(true);
                    }}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-[11px] text-rose-300 hover:text-rose-100 flex flex-col items-center gap-1 transition-all"
                  >
                    <Eraser className="w-4 h-4 text-rose-400" />
                    <span>پاکسازی سابقه گفتگو</span>
                    <span className="text-[9px] text-rose-400/70">حذف تمامی پیام‌ها</span>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowGroupInfoModal(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium rounded-xl"
            >
              بستن
            </button>
          </div>
        </div>
      )}

      {/* Camera Capture & Classroom Photo/Video Modal */}
      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onSendPhoto={handleSendPhoto}
        onSendVideo={handleSendVideo}
        initialMode={cameraModalMode}
      />

      {/* Fullscreen Photo Lightbox Modal */}
      <ImageLightboxModal
        isOpen={!!activeLightboxImage}
        onClose={() => setActiveLightboxImage(null)}
        imageUrl={activeLightboxImage?.url || ''}
        senderName={activeLightboxImage?.senderName}
        senderAvatar={activeLightboxImage?.senderAvatar}
        caption={activeLightboxImage?.caption}
        timestamp={activeLightboxImage?.timestamp}
      />

      {/* Copy Feedback Toast Banner */}
      {copiedToastText && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 text-emerald-300 shadow-2xl px-4 py-2 rounded-2xl flex items-center gap-2 text-xs font-bold shadow-emerald-950/50">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{copiedToastText}</span>
          </div>
        </div>
      )}

      {/* Delete Message Confirmation Modal (No window.confirm, safe for all iframes) */}
      {deleteConfirmMsg && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-xs w-full shadow-2xl text-center space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-100">حذف پیام</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                {deleteConfirmMsg.senderId === currentUser.id
                  ? 'آیا از حذف این پیام ارسالی خود اطمینان دارید؟ این پیام برای تمامی همکاران در این گفتگو حذف خواهد شد.'
                  : `آیا از حذف این پیام ارسالی از طرف «${deleteConfirmMsg.senderName}» اطمینان دارید؟`}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmDeleteMessage}
                disabled={isDeletingMsg}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingMsg ? 'در حال حذف...' : 'تأیید و حذف'}</span>
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmMsg(null)}
                disabled={isDeletingMsg}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Entire Chat History Confirmation Modal (Principal Only) */}
      {/* Requirement: "مدیر این امکان را داشته باشد که سابقه چت ها رو پاک کند یا مدت تنظیم کند اتومات حذف شود" */}
      {showClearHistoryModal && isPrincipal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-5 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-13 h-13 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100 flex items-center justify-center gap-1.5">
                <span>پاکسازی کامل سابقه گفتگو</span>
                <Crown className="w-4 h-4 text-amber-400" />
              </h4>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                آیا از پاک کردن تمامی پیام‌های ردوبدل شده در <strong className="text-white font-semibold">«{chatTitle}»</strong> اطمینان دارید؟
              </p>
              <p className="text-[11px] text-rose-400/90 mt-1.5 bg-rose-950/40 border border-rose-900/50 rounded-xl p-2">
                ⚠️ توجه: تمامی متن‌ها، صداها، تصاویر و فایل‌های این گفتگو برای کلیه اعضا بلافاصله و برای همیشه حذف خواهد شد.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmClearHistory}
                disabled={isClearingHistory}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
              >
                {isClearingHistory ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال پاکسازی...</span>
                  </>
                ) : (
                  <>
                    <Eraser className="w-4 h-4" />
                    <span>تأیید و پاکسازی کامل سابقه</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowClearHistoryModal(false)}
                disabled={isClearingHistory}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Delete (Self-Destruct) Settings Modal (Principal Only) */}
      {/* Requirement: "مدیر این امکان را داشته باشد که سابقه چت ها رو پاک کند یا مدت تنظیم کند اتومات حذف شود" */}
      {showAutoDeleteModal && isPrincipal && isGroup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Timer className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1">
                    <span>تنظیم زمان حذف خودکار پیام‌ها</span>
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{chatTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAutoDeleteModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              پیام‌های ارسالی پس از سپری شدن این مدت، به صورت خودکار و دائمی از این گروه حذف می‌شوند:
            </p>

            {/* Durations options */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {[
                { hours: 0, label: 'خاموش (پیام‌ها حذف نشوند)', desc: 'پیام‌ها در سابقه گروه حفظ می‌گردند' },
                { hours: 1, label: '۱ ساعت', desc: 'حذف خودکار ۱ ساعت پس از ارسال' },
                { hours: 6, label: '۶ ساعت', desc: 'مناسب مکالمات موقت روزانه' },
                { hours: 12, label: '۱۲ ساعت', desc: 'حذف خودکار پس از ۱۲ ساعت' },
                { hours: 24, label: '۲۴ ساعت (۱ روز)', desc: 'پاکسازی پیام‌های روز قبل' },
                { hours: 48, label: '۴۸ ساعت (۲ روز)', desc: 'حفظ پیام‌ها تا ۲ روز' },
                { hours: 168, label: '۷ روز (یک هفته)', desc: 'پاکسازی خودکار هفتگی' },
                { hours: 720, label: '۳۰ روز (یک ماه)', desc: 'پاکسازی خودکار ماهانه' },
              ].map((opt) => (
                <div
                  key={opt.hours}
                  onClick={() => setSelectedAutoDeleteHours(opt.hours)}
                  className={`p-2.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    selectedAutoDeleteHours === opt.hours
                      ? 'bg-amber-500/15 border-amber-500/60 text-amber-200 shadow-sm'
                      : 'bg-slate-950/70 border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      selectedAutoDeleteHours === opt.hours
                        ? 'border-amber-400 bg-amber-400'
                        : 'border-slate-600'
                    }`}>
                      {selectedAutoDeleteHours === opt.hours && (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{opt.label}</div>
                      <div className="text-[10px] text-slate-400">{opt.desc}</div>
                    </div>
                  </div>
                  {opt.hours > 0 && (
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleSaveAutoDelete}
                disabled={isSavingAutoDelete}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                {isSavingAutoDelete ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                    <span>در حال ذخیره...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-slate-950" />
                    <span>ذخیره تنظیمات حذف خودکار</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowAutoDeleteModal(false)}
                disabled={isSavingAutoDelete}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
