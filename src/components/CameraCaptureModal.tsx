import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Video, 
  SwitchCamera, 
  X, 
  Image as ImageIcon, 
  RotateCcw, 
  Send, 
  AlertTriangle,
  Sparkles,
  Loader2,
  Square,
  Play,
  Film
} from 'lucide-react';
import { compressImage } from '../utils/imageUtils';
import { formatAudioTime } from '../utils/audioUtils';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendPhoto: (photoDataUrl: string, caption: string, fileName?: string) => Promise<void>;
  onSendVideo?: (videoDataUrl: string, caption: string, duration: number, fileName?: string) => Promise<void>;
  initialMode?: 'photo' | 'video';
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onSendPhoto,
  onSendVideo,
  initialMode = 'photo',
}) => {
  const [activeTab, setActiveTab] = useState<'photo' | 'video'>(initialMode);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);

  // Photo state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageSizeKb, setImageSizeKb] = useState<number>(0);

  // Video recording state
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoTimer, setVideoTimer] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState<Blob | null>(null);
  const [recordedVideoDuration, setRecordedVideoDuration] = useState(0);

  // Shared state
  const [caption, setCaption] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoIntervalRef = useRef<any>(null);

  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const nativeVideoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoGalleryInputRef = useRef<HTMLInputElement>(null);

  // Set initial mode on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
    }
  }, [isOpen, initialMode]);

  // Start live camera stream (with audio if video mode)
  const startCamera = async (facing: 'environment' | 'user', isVideoMode: boolean) => {
    setIsStartingCamera(true);
    setCameraError(null);

    // Stop existing stream if any
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('دستگاه یا مرورگر شما از دوربین زنده پشتیبانی نمی‌کند. لطفاً از دوربین پیش‌فرض گوشی استفاده فرمایید.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: isVideoMode ? { echoCancellation: true, noiseSuppression: true } : false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('دسترسی به دوربین/میکروفون مجاز نیست. می‌توانید از دکمه دوربین گوشی در پایین استفاده کنید.');
      } else {
        setCameraError('دوربین فعال نشد یا در برنامه دیگری در حال استفاده است. می‌توانید فایل ویدیو یا عکس را مستقیماً انتخاب کنید.');
      }
    } finally {
      setIsStartingCamera(false);
    }
  };

  // Switch rear/front camera
  const toggleFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    if (!capturedImage && !recordedVideoUrl) {
      startCamera(nextFacing, activeTab === 'video');
    }
  };

  // Stop camera stream safely
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  // Reset and restart on modal open or tab change
  useEffect(() => {
    if (isOpen && !capturedImage && !recordedVideoUrl) {
      startCamera(cameraFacing, activeTab === 'video');
    } else if (!isOpen) {
      stopCamera();
      handleResetAll();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  // Keep live preview stream attached to video element
  useEffect(() => {
    if (videoRef.current && stream && !capturedImage && !recordedVideoUrl) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, capturedImage, recordedVideoUrl]);

  // Reset all captured media
  const handleResetAll = () => {
    setCapturedImage(null);
    setRecordedVideoUrl(null);
    setRecordedVideoBlob(null);
    setRecordedVideoDuration(0);
    setCaption('');
    setIsSubmitting(false);
    setIsRecordingVideo(false);
    setVideoTimer(0);
    clearInterval(videoIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
  };

  // ----------------------------------------------------
  // PHOTO CAPTURE
  // ----------------------------------------------------
  const takeSnapshot = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.9);

      stopCamera();
      const res = await compressImage(await (await fetch(rawDataUrl)).blob());
      setCapturedImage(res.dataUrl);
      setImageSizeKb(res.sizeKb);
    } catch (e: any) {
      alert('خطا در ثبت عکس: ' + e.message);
    }
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSubmitting(true);
      stopCamera();
      const res = await compressImage(file);
      setCapturedImage(res.dataUrl);
      setImageSizeKb(res.sizeKb);
    } catch (err: any) {
      alert('خطا در پردازش تصویر: ' + err.message);
    } finally {
      setIsSubmitting(false);
      if (e.target) e.target.value = '';
    }
  };

  // ----------------------------------------------------
  // VIDEO RECORDING
  // ----------------------------------------------------
  const getSupportedVideoMime = (): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
    ];
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c)) return c;
    }
    return '';
  };

  const startVideoRecording = () => {
    if (!stream) {
      alert('دوربین فعال نیست. لطفاً مجدداً تلاش نمایید.');
      return;
    }

    try {
      const mimeType = getSupportedVideoMime();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      videoChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          videoChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        clearInterval(videoIntervalRef.current);
        const effectiveMime = recorder.mimeType || mimeType || 'video/webm';
        const finalBlob = new Blob(videoChunksRef.current, { type: effectiveMime });
        const finalUrl = URL.createObjectURL(finalBlob);
        setRecordedVideoBlob(finalBlob);
        setRecordedVideoUrl(finalUrl);
        setRecordedVideoDuration(videoTimer);
        setIsRecordingVideo(false);
        stopCamera();
      };

      recorder.start(250);
      setIsRecordingVideo(true);
      setVideoTimer(0);

      videoIntervalRef.current = setInterval(() => {
        setVideoTimer(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Video recorder error:', err);
      alert('خطا در شروع فیلم‌برداری: ' + err.message);
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(videoIntervalRef.current);
  };

  const handleVideoFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopCamera();
    const url = URL.createObjectURL(file);
    setRecordedVideoBlob(file);
    setRecordedVideoUrl(url);
    setRecordedVideoDuration(10);
    if (e.target) e.target.value = '';
  };

  // Convert Blob to Data URL
  const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Submit Photo or Video
  const handleSend = async () => {
    if (activeTab === 'photo' && capturedImage) {
      try {
        setIsSubmitting(true);
        await onSendPhoto(capturedImage, caption, 'classroom_photo.jpg');
        handleCloseModal();
      } catch (err: any) {
        alert(err.message || 'خطا در ارسال تصویر');
      } finally {
        setIsSubmitting(false);
      }
    } else if (activeTab === 'video' && recordedVideoBlob && onSendVideo) {
      try {
        setIsSubmitting(true);
        const dataUrl = await blobToDataUrl(recordedVideoBlob);
        await onSendVideo(
          dataUrl, 
          caption || 'ویدیوی کلاسی', 
          Math.max(1, recordedVideoDuration), 
          'classroom_video.webm'
        );
        handleCloseModal();
      } catch (err: any) {
        alert(err.message || 'خطا در ارسال ویدیو');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleRetake = () => {
    handleResetAll();
    startCamera(cameraFacing, activeTab === 'video');
  };

  const handleCloseModal = () => {
    stopCamera();
    handleResetAll();
    onClose();
  };

  const quickTags = [
    'گزارش کلاسی',
    'آزمایشگاه علوم',
    'فعالیت ورزشی',
    'کارگاه آموزشی',
    'تدریس مبحث جدید',
    'طرح درس',
  ];

  const handleAppendTag = (tag: string) => {
    setCaption(prev => (prev ? `${prev} - #${tag}` : `#${tag}`));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200">
      {/* Hidden Native File Inputs for Mobile Integration */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFilePicked}
        className="hidden"
      />
      <input
        ref={nativeVideoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handleVideoFilePicked}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFilePicked}
        className="hidden"
      />
      <input
        ref={videoGalleryInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoFilePicked}
        className="hidden"
      />

      <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Top Header & Mode Switcher */}
        <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-2">
            {/* Mode Tabs: Photo vs Video */}
            {!capturedImage && !recordedVideoUrl && (
              <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    if (isRecordingVideo) stopVideoRecording();
                    setActiveTab('photo');
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    activeTab === 'photo'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>عکاسی</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('video');
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    activeTab === 'video'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>فیلم‌برداری</span>
                </button>
              </div>
            )}

            {(capturedImage || recordedVideoUrl) && (
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{capturedImage ? 'پیش‌نمایش تصویر' : 'پیش‌نمایش ویدیو'}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Camera facing switch (only during live preview) */}
            {!capturedImage && !recordedVideoUrl && (
              <button
                type="button"
                onClick={toggleFacing}
                disabled={isRecordingVideo}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-40"
                title="تغییر دوربین جلو / پشت"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleCloseModal}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors"
              title="بستن"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport: Live Stream OR Preview */}
        <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center min-h-[320px]">
          {/* 1. Captured Photo Preview */}
          {capturedImage ? (
            <div className="w-full h-full flex items-center justify-center p-2 relative">
              <img
                src={capturedImage}
                alt="تصویر ثبت شده"
                className="max-h-[55vh] w-auto max-w-full object-contain rounded-2xl shadow-xl"
              />
              <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-xl text-[10px] text-emerald-400 font-mono">
                {imageSizeKb} KB - فشرده‌شده و آماده ارسال
              </div>
            </div>
          ) : recordedVideoUrl ? (
            /* 2. Recorded Video Preview */
            <div className="w-full h-full flex items-center justify-center p-2 relative">
              <video
                src={recordedVideoUrl}
                controls
                playsInline
                className="max-h-[55vh] w-auto max-w-full rounded-2xl shadow-2xl bg-black"
              />
              <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-xl text-[10px] text-rose-400 font-mono flex items-center gap-1.5">
                <Film className="w-3 h-3" />
                <span>مدت: {formatAudioTime(recordedVideoDuration)}</span>
              </div>
            </div>
          ) : (
            /* 3. Live Camera Feed */
            <div className="w-full h-full relative flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraFacing === 'user' ? '-scale-x-100' : ''}`}
              />

              {/* Live recording indicator */}
              {isRecordingVideo && (
                <div className="absolute top-4 left-4 bg-rose-600/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full flex items-center gap-2 shadow-xl animate-pulse z-20">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  <span className="font-mono text-xs font-bold">{formatAudioTime(videoTimer)}</span>
                  <span className="text-[10px]">در حال فیلم‌برداری...</span>
                </div>
              )}

              {/* Camera loading indicator */}
              {isStartingCamera && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 text-slate-300 text-xs z-10">
                  <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
                  <span>در حال فعال‌سازی دوربین...</span>
                </div>
              )}

              {/* Camera Error banner */}
              {cameraError && (
                <div className="absolute inset-x-4 top-4 bg-rose-950/90 border border-rose-500/50 p-3 rounded-2xl text-xs text-rose-200 flex flex-col gap-2 z-20 backdrop-blur-md">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{cameraError}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Controls Bar */}
        <div className="p-3 bg-slate-950 border-t border-slate-900 shrink-0">
          {capturedImage || recordedVideoUrl ? (
            /* Review and Send State */
            <div className="flex flex-col gap-2">
              {/* Quick tags */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {quickTags.map((tag, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAppendTag(tag)}
                    className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-blue-600/30 text-slate-300 hover:text-blue-300 border border-slate-800 text-[10px] whitespace-nowrap transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Caption input */}
              <input
                type="text"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder={capturedImage ? 'توضیحات عکس کلاسی (اختیاری)...' : 'توضیحات ویدیو یا گزارش تدریس...'}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-slate-800"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{capturedImage ? 'عکسبرداری مجدد' : 'فیلم‌برداری مجدد'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>در حال ارسال...</span>
                    </>
                  ) : (
                    <>
                      {/* Send icon: strictly points up-right without rotate-180 */}
                      <Send className="w-3.5 h-3.5" />
                      <span>ارسال به گفتگو</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : activeTab === 'video' ? (
            /* Video Mode Shutter Bar */
            <div className="flex items-center justify-between px-2 pt-1 pb-1">
              {/* Video from Gallery */}
              <button
                type="button"
                onClick={() => videoGalleryInputRef.current?.click()}
                disabled={isRecordingVideo}
                className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-emerald-400 flex flex-col items-center gap-1 transition-all disabled:opacity-30"
                title="انتخاب ویدیو از حافظه"
              >
                <Film className="w-5 h-5 text-emerald-400" />
                <span className="text-[9px]">فایل ویدیو</span>
              </button>

              {/* Big Red Video Record / Stop Button */}
              {isRecordingVideo ? (
                <button
                  type="button"
                  onClick={stopVideoRecording}
                  className="w-16 h-16 rounded-full border-4 border-rose-500 p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl shadow-rose-600/30 bg-rose-950 animate-pulse"
                  title="توقف فیلم‌برداری"
                >
                  <div className="w-6 h-6 rounded-md bg-rose-500 flex items-center justify-center text-white shadow">
                    <Square className="w-4 h-4 fill-current" />
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startVideoRecording}
                  disabled={isStartingCamera}
                  className="w-16 h-16 rounded-full border-4 border-white/80 p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none shadow-xl shadow-rose-600/30 bg-gradient-to-tr from-rose-600 to-red-500"
                  title="شروع فیلم‌برداری"
                >
                  <div className="w-6 h-6 rounded-full bg-white shadow-inner flex items-center justify-center">
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-600" />
                  </div>
                </button>
              )}

              {/* Native Phone Video Recorder */}
              <button
                type="button"
                onClick={() => nativeVideoInputRef.current?.click()}
                disabled={isRecordingVideo}
                className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-rose-400 flex flex-col items-center gap-1 transition-all disabled:opacity-30"
                title="فیلم‌برداری با برنامه دوربین گوشی"
              >
                <Video className="w-5 h-5 text-rose-400" />
                <span className="text-[9px]">دوربین گوشی</span>
              </button>
            </div>
          ) : (
            /* Photo Mode Shutter Bar */
            <div className="flex items-center justify-between px-2 pt-1 pb-1">
              {/* Photo from Gallery */}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-emerald-400 flex flex-col items-center gap-1 transition-all"
                title="انتخاب عکس از گالری"
              >
                <ImageIcon className="w-5 h-5 text-emerald-400" />
                <span className="text-[9px]">گالری عکس</span>
              </button>

              {/* Big Photo Shutter Button */}
              <button
                type="button"
                onClick={takeSnapshot}
                disabled={!!cameraError || isStartingCamera}
                className="w-16 h-16 rounded-full border-4 border-white/80 p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none shadow-xl shadow-blue-500/20 bg-gradient-to-tr from-blue-600 to-indigo-500"
                title="ثبت عکس"
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-blue-600 shadow-inner">
                  <Camera className="w-6 h-6" />
                </div>
              </button>

              {/* Native Phone Camera */}
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-amber-400 flex flex-col items-center gap-1 transition-all"
                title="دوربین پیش‌فرض گوشی"
              >
                <Camera className="w-5 h-5 text-amber-400" />
                <span className="text-[9px]">دوربین گوشی</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
