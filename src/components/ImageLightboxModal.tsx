import React, { useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

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
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!isOpen || !imageUrl) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `school_report_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.75));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between animate-fadeIn select-none"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div 
        className="p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white z-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          {senderAvatar && (
            <img 
              src={senderAvatar} 
              alt={senderName || ''} 
              className="w-8 h-8 rounded-full object-cover border border-white/20" 
            />
          )}
          <div>
            <div className="text-xs font-bold text-slate-100">{senderName || 'گزارش کلاسی'}</div>
            {timestamp && <div className="text-[10px] text-slate-400 font-mono">{timestamp}</div>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
            title="کوچک‌نمایی"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
            title="بزرگ‌نمایی"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRotate}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
            title="چرخش تصویر"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white transition-colors"
            title="ذخیره و دانلود عکس"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-rose-600 text-slate-200 hover:text-white transition-colors ml-1"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div 
        className="flex-1 flex items-center justify-center p-4 overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={caption || 'گزارش کلاسی'}
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transition: 'transform 0.2s ease-out',
          }}
          className="max-h-[82vh] max-w-[95vw] object-contain rounded-lg shadow-2xl"
        />
      </div>

      {/* Bottom Caption Bar */}
      {caption && (
        <div 
          className="p-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent text-center text-xs text-slate-200 max-w-2xl mx-auto z-10 w-full"
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
