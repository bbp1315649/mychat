import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor, Wifi, Battery, Signal } from 'lucide-react';

interface MobileFrameProps {
  children: React.ReactNode;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [forceMobileFrame, setForceMobileFrame] = useState(true);
  const [currentTime, setCurrentTime] = useState('۱۲:۳۰');

  useEffect(() => {
    // Check if user is on mobile screen width
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 768;
      setIsMobileDevice(isMobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    const updateClock = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${h}:${m}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 30000);

    return () => {
      window.removeEventListener('resize', checkMobile);
      clearInterval(interval);
    };
  }, []);

  // If on actual mobile device or user toggled off frame, render full viewport
  if (isMobileDevice || !forceMobileFrame) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">
        {/* Toggle to frame mode on desktop if screen > 768px */}
        {!isMobileDevice && (
          <div className="fixed top-3 left-3 z-50">
            <button
              onClick={() => setForceMobileFrame(true)}
              className="bg-slate-800/90 backdrop-blur hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-1.5 shadow-lg transition-all"
              title="تغییر به نمای گوشی موبایل"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-400" />
              <span>نمای قاب موبایل</span>
            </button>
          </div>
        )}
        {children}
      </div>
    );
  }

  // Desktop display with realistic Smartphone Frame
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 select-none">
      {/* Top bar controls */}
      <div className="w-full max-w-sm flex items-center justify-between mb-3 px-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
            نسخه موبایل بهینه
          </span>
        </div>
        <button
          onClick={() => setForceMobileFrame(false)}
          className="hover:text-slate-200 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-slate-800/50"
          title="تغییر به تمام‌صفحه"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>تمام‌صفحه</span>
        </button>
      </div>

      {/* Phone Body Mockup */}
      <div className="w-full max-w-[400px] h-[840px] max-h-[95vh] bg-slate-900 rounded-[44px] p-3 shadow-2xl border-[3px] border-slate-700/80 ring-1 ring-white/10 flex flex-col relative overflow-hidden">
        {/* Outer Phone Bezel Details */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-5 bg-slate-950 rounded-b-2xl z-40 flex items-center justify-center">
          <div className="w-12 h-1 bg-slate-800 rounded-full mb-1"></div>
          <div className="w-2.5 h-2.5 bg-slate-900 rounded-full ml-3 border border-slate-700"></div>
        </div>

        {/* Screen Container */}
        <div className="w-full h-full bg-slate-950 rounded-[34px] overflow-hidden flex flex-col relative border border-slate-800/80">
          {/* Phone Status Bar */}
          <div className="h-9 px-6 pt-1 flex items-center justify-between text-[11px] font-medium text-slate-300 z-30 shrink-0 select-none">
            <span className="tracking-tight">{currentTime}</span>
            <div className="flex items-center gap-1.5 opacity-80">
              <Signal className="w-3 h-3" />
              <Wifi className="w-3 h-3" />
              <div className="flex items-center gap-0.5">
                <Battery className="w-3.5 h-3.5 rotate-90" />
              </div>
            </div>
          </div>

          {/* Actual App Content */}
          <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
            {children}
          </div>

          {/* Home indicator bar */}
          <div className="h-4 w-full flex items-center justify-center shrink-0 bg-slate-950 pb-1">
            <div className="w-32 h-1 bg-slate-600/60 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
