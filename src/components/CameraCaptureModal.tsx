import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  SwitchCamera, 
  X, 
  Image as ImageIcon, 
  RotateCcw, 
  Send, 
  Check, 
  AlertTriangle,
  Sparkles,
  Loader2
} from 'lucide-react';
import { compressImage } from '../utils/imageUtils';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendPhoto: (photoDataUrl: string, caption: string, fileName?: string) => Promise<void>;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onSendPhoto,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);

  // Captured photo preview state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageSizeKb, setImageSizeKb] = useState<number>(0);
  const [caption, setCaption] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Start in-app live camera stream
  const startCamera = async (facing: 'environment' | 'user') => {
    setIsStartingCamera(true);
    setCameraError(null);

    // Stop existing stream if any
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('دستگاه یا مرورگر شما از وب‌کم مستقیم پشتیبانی نمی‌کند. لطفاً از دکمه دوربین گوشی استفاده نمایید.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('دسترسی به دوربین توسط مرورگر مجاز نیست. می‌توانید از دکمه «عکسبرداری مستقیم با دوربین گوشی» در زیر استفاده کنید.');
      } else {
        setCameraError('دوربین فعال نشد یا در برنامه دیگری در حال استفاده است. می‌توانید از دکمه‌های مستقیم زیر برای ارسال عکس کلاسی استفاده نمایید.');
      }
    } finally {
      setIsStartingCamera(false);
    }
  };

  // Switch between rear and front cameras
  const toggleFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    if (!capturedImage) {
      startCamera(nextFacing);
    }
  };

  // Stop camera stream safely
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  // Life-cycle when modal opens / closes
  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera(cameraFacing);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Ensure video element receives stream once attached
  useEffect(() => {
    if (videoRef.current && stream && !capturedImage) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, capturedImage]);

  // Snap photo from live video feed
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

      // Draw frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.9);

      // Stop stream while reviewing snapshot
      stopCamera();

      // Compress
      const res = await compressImage(await (await fetch(rawDataUrl)).blob());
      setCapturedImage(res.dataUrl);
      setImageSizeKb(res.sizeKb);
    } catch (e: any) {
      alert('خطا در ثبت عکس: ' + e.message);
    }
  };

  // Handle image selected via native camera input or gallery
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
      alert(err.message || 'خطا در بارگذاری تصویر');
    } finally {
      setIsSubmitting(false);
      // Reset input value
      e.target.value = '';
    }
  };

  // Retake photo / clear selection
  const handleRetake = () => {
    setCapturedImage(null);
    setImageSizeKb(0);
    startCamera(cameraFacing);
  };

  // Quick tag chips
  const quickTags = [
    'گزارش آزمایشگاه',
    'تصویر تخته تدریس',
    'فعالیت کلاسی دانش‌آموزان',
    'نمونه سوال و آزمون',
    'صورتجلسه گروه آموزشی'
  ];

  const handleAppendTag = (tag: string) => {
    if (!caption) {
      setCaption(tag);
    } else {
      setCaption(prev => prev + ' - ' + tag);
    }
  };

  // Final send
  const handleSend = async () => {
    if (!capturedImage || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onSendPhoto(
        capturedImage, 
        caption.trim() || 'گزارش تصویری کلاس درس',
        `class_photo_${Date.now()}.jpg`
      );
      // Clean up and close
      setCapturedImage(null);
      setCaption('');
      stopCamera();
      onClose();
    } catch (err: any) {
      alert(err.message || 'خطا در ارسال تصویر');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    stopCamera();
    setCapturedImage(null);
    setCaption('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-3 animate-fadeIn">
      {/* Hidden file inputs for native camera & gallery picker */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFilePicked}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFilePicked}
      />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        {/* Top Header */}
        <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold">
                {capturedImage ? 'پیش‌نمایش و ارسال عکس' : 'دوربین و گزارش تصویری کلاسی'}
              </h3>
              <p className="text-[10px] text-slate-400">
                {capturedImage ? 'توضیحات مورد نظر را بنویسید و ارسال کنید' : 'ارسال تصویر تدریس، تخته کلاس و آزمایشگاه'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder or Captured Image */}
        <div className="relative bg-black flex-1 min-h-[300px] max-h-[380px] flex items-center justify-center overflow-hidden">
          {capturedImage ? (
            /* Review captured photo */
            <div className="relative w-full h-full flex items-center justify-center bg-black/80">
              <img
                src={capturedImage}
                alt="گزارش کلاسی ثبت شده"
                className="max-h-[380px] max-w-full object-contain rounded-lg"
              />
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-emerald-400 border border-emerald-500/30 font-mono flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>حجم بهینه‌شده: {imageSizeKb} KB</span>
              </div>
            </div>
          ) : cameraError ? (
            /* Error & Fallback Buttons */
            <div className="p-6 text-center text-slate-300 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs">{cameraError}</p>
              
              <div className="flex flex-col gap-2 w-full mt-2">
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>عکسبرداری مستقیم با دوربین گوشی</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span>انتخاب عکس از گالری گوشی</span>
                </button>
              </div>
            </div>
          ) : (
            /* Live Camera Stream Viewfinder */
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {isStartingCamera && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-xs text-slate-300 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  <span>در حال راه‌اندازی دوربین...</span>
                </div>
              )}

              {/* Grid overlay for framing */}
              <div className="absolute inset-0 border border-white/10 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-30">
                <div className="border-r border-b border-white/20"></div>
                <div className="border-r border-b border-white/20"></div>
                <div className="border-b border-white/20"></div>
                <div className="border-r border-b border-white/20"></div>
                <div className="border-r border-b border-white/20"></div>
                <div className="border-b border-white/20"></div>
                <div className="border-r border-white/20"></div>
                <div className="border-r border-white/20"></div>
                <div></div>
              </div>

              {/* Flip camera button */}
              <button
                type="button"
                onClick={toggleFacing}
                className="absolute top-3 left-3 p-2 rounded-xl bg-black/60 backdrop-blur-md text-white hover:bg-black/80 border border-white/20 transition-all text-xs flex items-center gap-1.5 shadow"
                title="تغییر دوربین پشت / جلو"
              >
                <SwitchCamera className="w-4 h-4 text-blue-400" />
                <span className="text-[10px]">
                  {cameraFacing === 'environment' ? 'دوربین پشت' : 'دوربین جلو'}
                </span>
              </button>

              {/* Native mobile camera fallback button on top right */}
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 backdrop-blur-md text-slate-200 hover:text-white hover:bg-black/80 border border-white/20 transition-all text-xs flex items-center gap-1 shadow"
                title="دوربین اصلی سیستم‌عامل"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px]">دوربین گوشی</span>
              </button>
            </div>
          )}
        </div>

        {/* Controls Section */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-col gap-2.5">
          {capturedImage ? (
            /* Review & Caption Bar */
            <div className="flex flex-col gap-2">
              {/* Quick tags */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-[10px] text-slate-500 shrink-0 flex items-center gap-0.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  برچسب:
                </span>
                {quickTags.map((tag, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAppendTag(tag)}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-blue-600/30 text-slate-300 hover:text-blue-300 border border-slate-700 text-[10px] whitespace-nowrap transition-colors"
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
                placeholder="توضیحات عکس یا گزارش تدریس (اختیاری)..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-slate-700/80"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>عکسبرداری مجدد</span>
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
                      <Send className="w-3.5 h-3.5 rotate-180" />
                      <span>ارسال تصویر به گفتگو</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Live Camera Shutter & Pickers */
            <div className="flex items-center justify-between px-2 pt-1 pb-1">
              {/* Gallery button */}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-emerald-400 flex flex-col items-center gap-1 transition-all"
                title="انتخاب از گالری گوشی"
              >
                <ImageIcon className="w-5 h-5 text-emerald-400" />
                <span className="text-[9px]">گالری</span>
              </button>

              {/* Large Shutter Button */}
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

              {/* Phone Camera button */}
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
