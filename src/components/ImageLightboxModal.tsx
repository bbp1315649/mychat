import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw,
  Maximize, 
  Minimize, 
  Move,
  RefreshCw
} from 'lucide-react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  senderName?: string;
  senderAvatar?: string;
  caption?: string;
  timestamp?: string;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  senderName,
  senderAvatar,
  caption,
  timestamp,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showHint, setShowHint] = useState(true);

  // References for touch pinch & pan tracking
  const containerRef = useRef<HTMLDivElement>(null);
  const initialPinchDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTapRef = useRef<number>(0);

  // Auto-hide hint after 4 seconds
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setRotation(0);
      setShowHint(true);
      const timer = setTimeout(() => setShowHint(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, imageUrl]);

  // Reset zoom & pan
  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.35, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => {
      const next = Math.max(prev - 0.35, 0.75);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Two-Finger Pinch-to-Zoom & Pan Handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      // Two-finger pinch start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      initialPinchDistRef.current = dist;
      initialScaleRef.current = scale;
      setShowHint(false);
    } else if (e.touches.length === 1) {
      // Single finger drag / pan when zoomed
      const t = e.touches[0];
      panStartRef.current = { x: t.clientX, y: t.clientY };
      initialPosRef.current = { ...position };

      // Double-tap detection
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        // Double tap toggle
        if (scale > 1.2) {
          handleReset();
        } else {
          setScale(2.5);
        }
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && initialPinchDistRef.current !== null) {
      // Pinch to zoom in / out
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = currentDist / initialPinchDistRef.current;
      const targetScale = Math.min(Math.max(initialScaleRef.current * ratio, 0.5), 5);
      setScale(targetScale);
    } else if (e.touches.length === 1 && scale > 1.05) {
      // Pan the zoomed image
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - panStartRef.current.x;
      const dy = t.clientY - panStartRef.current.y;
      setPosition({
        x: initialPosRef.current.x + dx,
        y: initialPosRef.current.y + dy,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      initialPinchDistRef.current = null;
    }
    if (e.touches.length === 0) {
      // Snap back if zoomed out below 1x
      if (scale < 1) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    }
  };

  // Mouse wheel zoom for laptop/desktop users
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.2 : -0.2;
    setScale(prev => {
      const next = Math.min(Math.max(prev + zoomFactor, 0.75), 5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
    setShowHint(false);
  };

  // Mouse drag handlers for desktop
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
    initialPosRef.current = { ...position };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    if (scale <= 1) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPosition({
      x: initialPosRef.current.x + dx,
      y: initialPosRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `school_image_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || !imageUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div 
        className="p-3 bg-gradient-to-b from-black/90 to-transparent flex items-center justify-between text-white z-20 shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          {senderAvatar && (
            <img 
              src={senderAvatar} 
              alt={senderName || ''} 
              className="w-8 h-8 rounded-full object-cover border border-white/20 shadow" 
            />
          )}
          <div>
            <div className="text-xs font-bold text-slate-100">{senderName || 'تصویر گزارش آموزشی'}</div>
            {timestamp && <div className="text-[10px] text-slate-400 font-mono">{timestamp}</div>}
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1.5">
          {/* Zoom Percentage Pill */}
          <button
            type="button"
            onClick={handleReset}
            className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-xl text-[11px] font-mono font-bold text-amber-300 transition-colors"
            title="بازنشانی اندازه تصویر"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
            title="کوچک‌نمایی (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
            title="بزرگ‌نمایی (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleRotate}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
            title="چرخش ۹۰ درجه"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="p-2 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white transition-colors"
            title="دانلود و ذخیره عکس"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-rose-600 text-slate-200 hover:text-white transition-colors ml-1"
            title="بستن (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Interactive Stage with Touch Pinch-to-Zoom */}
      <div 
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-2 overflow-hidden relative touch-none cursor-grab active:cursor-grabbing"
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <img
          src={imageUrl}
          alt={caption || 'تصویر آموزشی'}
          draggable={false}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: isDragging || initialPinchDistRef.current ? 'none' : 'transform 0.15s ease-out',
            touchAction: 'none',
          }}
          className="max-h-[80vh] max-w-[95vw] object-contain rounded-lg shadow-2xl pointer-events-auto select-none"
        />

        {/* Floating Touch Guidance Pill */}
        {showHint && (
          <div className="absolute bottom-6 bg-black/75 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full text-xs text-amber-300 flex items-center gap-2 shadow-xl animate-bounce pointer-events-none">
            <Move className="w-4 h-4 text-amber-400" />
            <span>با باز و بسته کردن دو انگشت اندازه تصویر را تغییر دهید (Pinch to Zoom)</span>
          </div>
        )}
      </div>

      {/* Bottom Caption Bar */}
      {caption && (
        <div 
          className="p-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent text-center text-xs text-slate-200 max-w-2xl mx-auto z-10 w-full shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-right">
            <span className="text-blue-400 font-semibold ml-1">توضیحات:</span>
            <span>{caption}</span>
          </div>
        </div>
      )}
    </div>
  );
};
