'use client';

import React from 'react';
import { Camera, Maximize2, Shield, Activity, Bus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Detection, CameraConfig } from '@/app/page';

interface CameraGridProps {
  activePlatform: number | null;
  lastDetection: Detection | undefined;
  configs: CameraConfig[];
}

const CameraFeed = ({ stream, platform, isActive, config }: { stream?: MediaStream, platform: number, isActive: boolean, config?: CameraConfig }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => console.error(`Error playing stream P${platform}:`, err));
    }
  }, [stream, platform]);

  return (
    <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center">
      {config?.type === 'url' && config.value ? (
        <img 
          src={config.value} 
          alt={`Platform ${platform}`}
          className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 transition-all"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/error/640/360?blur=10';
          }}
        />
      ) : stream ? (
        <video 
          ref={videoRef}
          autoPlay 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 transition-all"
        />
      ) : (
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#333_1px,_transparent_1px)] bg-[length:10px_10px]" />
        </div>
      )}
      
      {/* Simulated Bus on Detection */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            className="flex flex-col items-center gap-2 z-20"
          >
            <Bus className="w-12 h-12 text-green-500" />
            <div className="bg-green-600 text-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest">
              DETECTING...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isActive && (
        <div className="flex flex-col items-center gap-1 opacity-20 group-hover:opacity-40 transition-opacity z-10">
          <Camera className="w-6 h-6 text-[#E4E3E0]" />
          <span className="font-mono text-[8px] uppercase tracking-widest text-[#E4E3E0]">FEED_P{platform}</span>
        </div>
      )}
    </div>
  );
};

const CameraGrid: React.FC<CameraGridProps> = ({ activePlatform, lastDetection, configs }) => {
  const [streams, setStreams] = React.useState<Record<number, MediaStream>>({});
  const streamsRef = React.useRef<Record<number, MediaStream>>({});
  const [error, setError] = React.useState<string | null>(null);

  const requestAccess = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      window.location.reload(); // Reload to re-enumerate devices with labels
    } catch (err) {
      setError("Camera access denied. Please check browser permissions.");
    }
  };

  React.useEffect(() => {
    let active = true;
    const newStreams: Record<number, MediaStream> = {};

    async function setupCameras() {
      // Stop existing streams first
      Object.values(streamsRef.current).forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
      streamsRef.current = {};

      for (const config of configs) {
        if (!active) break;
        if (config.type === 'device' && config.value) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { deviceId: { exact: config.value } } 
            });
            if (active) {
              newStreams[config.platform] = stream;
            } else {
              stream.getTracks().forEach(track => track.stop());
            }
          } catch (err) {
            console.error(`Error opening camera ${config.platform}:`, err);
            // If exact fails, try without exact
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { deviceId: config.value } 
              });
              if (active) newStreams[config.platform] = stream;
              else stream.getTracks().forEach(track => track.stop());
            } catch (err2) {
              console.error(`Fallback error P${config.platform}:`, err2);
            }
          }
        }
      }
      if (active) {
        streamsRef.current = newStreams;
        setStreams(newStreams);
      }
    }

    setupCameras();

    return () => {
      active = false;
      Object.values(newStreams).forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
      Object.values(streamsRef.current).forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
    };
  }, [configs]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 p-2 text-[10px] font-mono flex justify-between items-center">
          <span>{error}</span>
          <button onClick={requestAccess} className="underline">RETRY ACCESS</button>
        </div>
      )}
      
      {!Object.keys(streams).length && configs.some(c => c.type === 'device' && c.value) && !error && (
        <div className="bg-blue-500/10 border border-blue-500 text-blue-500 p-2 text-[10px] font-mono flex justify-between items-center">
          <span>INITIALIZING CAMERA FEEDS...</span>
          <button onClick={requestAccess} className="underline">FORCE REQUEST</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 h-full">
        {Array.from({ length: 10 }).map((_, i) => {
          const platform = i + 1;
          const isActive = activePlatform === platform;
          const isLastDetected = lastDetection?.platform === platform;
          const config = configs.find(c => c.platform === platform);
          const stream = streams[platform];

          return (
            <motion.div
              key={platform}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`relative aspect-video border border-[#141414] overflow-hidden group transition-all duration-300 ${isActive ? 'ring-2 ring-green-600 ring-offset-2 z-10' : ''}`}
            >
              <CameraFeed 
                stream={stream} 
                platform={platform} 
                isActive={isActive} 
                config={config} 
              />

              {/* Overlay Info */}
              <div className="absolute top-2 left-2 flex flex-col gap-1 z-30">
                <div className="flex items-center gap-2 bg-[#141414]/80 text-[#E4E3E0] px-1.5 py-0.5 rounded-sm">
                  <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                  <span className="font-mono text-[9px] uppercase tracking-widest">P{platform}</span>
                </div>
                {isActive && (
                  <div className="bg-green-600 text-white px-1.5 py-0.5 rounded-sm font-mono text-[8px] uppercase tracking-widest animate-bounce">
                    PLATE DETECTED
                  </div>
                )}
              </div>

              {/* Bottom Overlay */}
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                <button className="p-1.5 bg-[#141414]/80 text-[#E4E3E0] hover:bg-[#141414] transition-colors rounded-sm">
                  <Maximize2 className="w-3 h-3" />
                </button>
              </div>

              {/* Scanline Effect */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10 z-40">
                <div className="w-full h-[2px] bg-white/20 animate-scanline" />
              </div>

              {/* Last Detection Info */}
              {isLastDetected && !isActive && (
                <div className="absolute bottom-0 left-0 right-0 bg-[#141414]/90 text-[#E4E3E0] p-1.5 border-t border-[#E4E3E0]/20 backdrop-blur-sm z-30">
                  <div className="flex justify-between items-center font-mono text-[8px]">
                    <span className="opacity-50">LAST PLATE:</span>
                    <span className="text-green-400 font-bold">{lastDetection.plate}</span>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default CameraGrid;
