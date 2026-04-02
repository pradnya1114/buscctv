'use client';

import React from 'react';
import { Bus, MapPin, Clock, Shield, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Detection } from '@/app/page';

interface DetectionLogProps {
  detections: Detection[];
}

const DetectionLog: React.FC<DetectionLogProps> = ({ detections }) => {
  return (
    <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-2 custom-scrollbar">
      <AnimatePresence initial={false}>
        {detections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 opacity-30 gap-4">
            <Shield className="w-12 h-12" />
            <p className="font-mono text-[10px] uppercase tracking-widest">Waiting for detections...</p>
          </div>
        ) : (
          detections.map((detection, index) => (
            <motion.div
              key={detection.id}
              initial={{ opacity: 0, x: 20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: -20, height: 0 }}
              className={`border-l-2 p-3 bg-white/40 hover:bg-white/60 transition-colors group relative overflow-hidden ${index === 0 ? 'border-green-600 bg-green-50/50' : 'border-[#141414]'}`}
            >
              {/* Background Plate Simulation */}
              <div className="absolute top-0 right-0 opacity-5 group-hover:opacity-10 transition-opacity">
                <Bus className="w-16 h-16 -mr-4 -mt-4 rotate-12" />
              </div>

              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-sm ${index === 0 ? 'bg-green-600 text-white' : 'bg-[#141414] text-[#E4E3E0]'}`}>
                    <Bus className="w-3 h-3" />
                  </div>
                  <span className="font-mono text-[11px] font-bold tracking-widest">{detection.plate}</span>
                </div>
                <div className="flex items-center gap-1 opacity-50 font-mono text-[9px]">
                  <Clock className="w-3 h-3" />
                  <span>{detection.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="flex items-center gap-1.5 opacity-70">
                  <MapPin className="w-3 h-3" />
                  <span className="uppercase tracking-tighter">PLATFORM {detection.platform}</span>
                </div>
                <div className="flex items-center gap-1.5 opacity-70">
                  <Clock className="w-3 h-3" />
                  <span className="uppercase tracking-tighter">IN: {detection.timeIn}</span>
                </div>
                {detection.timeOut && (
                  <div className="flex items-center gap-1.5 text-red-600 font-bold">
                    <Clock className="w-3 h-3" />
                    <span className="uppercase tracking-tighter">OUT: {detection.timeOut}</span>
                  </div>
                )}
                {detection.from && detection.from !== 'UNKNOWN' && (
                  <div className="flex items-center gap-1.5 text-green-700 font-bold col-span-2 mt-1">
                    <span className="uppercase tracking-tighter">{detection.from} → {detection.to}</span>
                  </div>
                )}
                {(!detection.from || detection.from === 'UNKNOWN') && (
                  <div className="flex items-center gap-1.5 opacity-40 italic col-span-2 mt-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>ROUTE UNKNOWN</span>
                  </div>
                )}
              </div>

              {/* Progress Bar for Newest */}
              {index === 0 && (
                <motion.div 
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 5, ease: 'linear' }}
                  className="absolute bottom-0 left-0 h-[2px] bg-green-600"
                />
              )}
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  );
};

export default DetectionLog;
