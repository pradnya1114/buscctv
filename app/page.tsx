'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, Bus, MapPin, Volume2, Code, Terminal, Activity, Shield, Settings, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Tesseract from 'tesseract.js';
import CameraGrid from '@/components/CameraGrid';
import DetectionLog from '@/components/DetectionLog';
import PythonSource from '@/components/PythonSource';

// Types
export interface Detection {
  id: string;
  plate: string;
  platform: number;
  timestamp: Date;
  timeIn: string;
  timeOut?: string;
  from?: string;
  to?: string;
  missCount?: number;
}

export interface CameraConfig {
  platform: number;
  type: 'device' | 'url' | 'none';
  value: string;
  label?: string;
}

export default function SmartBusCCTV() {
  const [mounted, setMounted] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [activePlatform, setActivePlatform] = useState<number | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [routeDb, setRouteDb] = useState<Record<string, { from: string; to: string }>>({});
  const [csvInput, setCsvInput] = useState('');
  const [cameraConfigs, setCameraConfigs] = useState<CameraConfig[]>(
    Array.from({ length: 10 }, (_, i) => ({
      platform: i + 1,
      type: 'none',
      value: '',
    }))
  );
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [voiceRate, setVoiceRate] = useState<number>(0.9);
  const [voicePitch, setVoicePitch] = useState<number>(1.0);
  const [sarvamApiKey, setSarvamApiKey] = useState<string>('');
  const [useSarvam, setUseSarvam] = useState<boolean>(false);
  const [sarvamSpeaker, setSarvamSpeaker] = useState<string>('vidya');
  const [sarvamModel, setSarvamModel] = useState<string>('bulbul:v3');
  const [showAdminControls, setShowAdminControls] = useState(false);

  // TRIPLE TAP DETECTION - Works on both desktop and mobile!
  useEffect(() => {
    let tapCount = 0;
    let tapTimer: NodeJS.Timeout;
    let lastTapPosition = { x: 0, y: 0 };
    
    const handleTripleTap = (e: MouseEvent | TouchEvent) => {
      // Get tap/click position
      let clientX, clientY;
      if (e instanceof TouchEvent && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if (e instanceof MouseEvent) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else {
        return;
      }
      
      // Check if tap is within 50px of last tap (for intentional triple tap)
      const distance = Math.sqrt(
        Math.pow(clientX - lastTapPosition.x, 2) + 
        Math.pow(clientY - lastTapPosition.y, 2)
      );
      
      // Reset if too far from last tap
      if (distance > 50 && tapCount > 0) {
        tapCount = 0;
        if (tapTimer) clearTimeout(tapTimer);
      }
      
      tapCount++;
      lastTapPosition = { x: clientX, y: clientY };
      
      // Clear previous timer
      if (tapTimer) clearTimeout(tapTimer);
      
      // Set timer to reset tap count after 500ms
      tapTimer = setTimeout(() => {
        if (tapCount === 3) {
          // TRIPLE TAP DETECTED - Toggle admin controls!
          setShowAdminControls(prev => !prev);
          
          // Optional: Add haptic feedback on mobile
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(50);
          }
          
          // Visual feedback (optional)
          const indicator = document.createElement('div');
          indicator.textContent = '🔧 ADMIN MODE ' + (!showAdminControls ? 'ON' : 'OFF');
          indicator.style.position = 'fixed';
          indicator.style.bottom = '100px';
          indicator.style.left = '50%';
          indicator.style.transform = 'translateX(-50%)';
          indicator.style.backgroundColor = '#141414';
          indicator.style.color = '#E4E3E0';
          indicator.style.padding = '8px 16px';
          indicator.style.borderRadius = '4px';
          indicator.style.fontSize = '12px';
          indicator.style.fontFamily = 'monospace';
          indicator.style.zIndex = '9999';
          indicator.style.pointerEvents = 'none';
          document.body.appendChild(indicator);
          setTimeout(() => indicator.remove(), 1500);
        }
        tapCount = 0;
      }, 500);
    };
    
    // Also support keyboard '1' key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1') {
        setShowAdminControls(prev => !prev);
        e.preventDefault();
      }
    };
    
    // Add event listeners for both mouse and touch
    window.addEventListener('click', handleTripleTap);
    window.addEventListener('touchstart', handleTripleTap);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('click', handleTripleTap);
      window.removeEventListener('touchstart', handleTripleTap);
      window.removeEventListener('keydown', handleKeyDown);
      if (tapTimer) clearTimeout(tapTimer);
    };
  }, [showAdminControls]);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      
      // Try to load saved settings from localStorage
      const savedVoice = localStorage.getItem('smart_bus_voice');
      const savedRate = localStorage.getItem('smart_bus_voice_rate');
      const savedPitch = localStorage.getItem('smart_bus_voice_pitch');
      const savedSarvamKey = localStorage.getItem('smart_bus_sarvam_key');
      const savedUseSarvam = localStorage.getItem('smart_bus_use_sarvam');
      const savedSarvamSpeaker = localStorage.getItem('smart_bus_sarvam_speaker');
      const savedSarvamModel = localStorage.getItem('smart_bus_sarvam_model');
      
      if (savedVoice) setSelectedVoiceURI(savedVoice);
      if (savedRate) setVoiceRate(parseFloat(savedRate));
      if (savedPitch) setVoicePitch(parseFloat(savedPitch));
      if (savedSarvamKey) setSarvamApiKey(savedSarvamKey);
      if (savedUseSarvam) setUseSarvam(savedUseSarvam === 'true');
      if (savedSarvamSpeaker) setSarvamSpeaker(savedSarvamSpeaker);
      if (savedSarvamModel) setSarvamModel(savedSarvamModel);
      
      if (!savedVoice) {
        // Default to Marathi if available
        const marathiVoice = voices.find(v => v.lang === 'mr-IN') || 
                           voices.find(v => v.lang.includes('mr')) || 
                           voices.find(v => v.name.toLowerCase().includes('marathi'));
        if (marathiVoice) {
          setSelectedVoiceURI(marathiVoice.voiceURI);
        }
      }
    };

    if (typeof window !== 'undefined') {
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Load routes from CSV on startup
  const loadRoutes = useCallback(async () => {
    try {
      const response = await fetch('/api/routes');
      if (response.ok) {
        const data = await response.json();
        if (Object.keys(data).length > 0) {
          setRouteDb(data);
        }
      }
    } catch (err) {
      console.error("Failed to load routes from CSV:", err);
    }
  }, []);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  // Fetch available devices
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        setAvailableDevices(devices.filter(d => d.kind === 'videoinput'));
      });
    }
  }, []);

  // Voice Announcement (Marathi Simulation)
  const announce = useCallback(async (detection: Detection) => {
    if (isMuted || detection.id === 'init' || typeof window === 'undefined') return;

    let text = '';
    // More natural announcement style (Lakshya dya...)
    if (detection.from && detection.to && detection.from !== 'UNKNOWN') {
      text = `कृपया लक्ष द्या, ${detection.from} हून ${detection.to} कडे जाणारी गाडी क्रमांक ${detection.plate}, प्लॅटफॉर्म क्रमांक ${detection.platform} वर येत आहे.`;
    } else {
      text = `कृपया लक्ष द्या, गाडी क्रमांक ${detection.plate}, प्लॅटफॉर्म क्रमांक ${detection.platform} वर येत आहे.`;
    }

    // Use Sarvam AI if enabled and key is provided
    const apiKey = sarvamApiKey || process.env.NEXT_PUBLIC_SARVAM_API_KEY;
    if (useSarvam && apiKey) {
      try {
        const response = await fetch('https://api.sarvam.ai/text-to-speech/stream', {
          method: 'POST',
          headers: {
            'api-subscription-key': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: text,
            target_language_code: "mr-IN", // Using Marathi for Sarvam
            speaker: sarvamSpeaker, // Use selected speaker
            model: sarvamModel, // Use selected model
            pace: voiceRate,
            speech_sample_rate: 22050,
            output_audio_codec: "mp3",
            enable_preprocessing: true
          })
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.play();
          return;
        } else {
          console.error("Sarvam AI Error:", await response.text());
          // Fallback to browser TTS if Sarvam fails
        }
      } catch (err) {
        console.error("Sarvam AI Fetch Error:", err);
        // Fallback to browser TTS
      }
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    const speak = () => {
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.voiceURI === selectedVoiceURI) || 
                    voices.find(v => v.lang === 'mr-IN') || 
                    voices.find(v => v.lang.includes('mr'));
      
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = 'mr-IN';
      }
      
      utterance.rate = voiceRate;
      utterance.pitch = voicePitch;
      
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = speak;
    } else {
      speak();
    }
  }, [isMuted, selectedVoiceURI, voiceRate, voicePitch, sarvamApiKey, useSarvam, sarvamSpeaker, sarvamModel]);

  const handleCsvImport = async () => {
    // Improved parser: handle newlines or multiple entries separated by spaces/commas
    const entries = csvInput.split(/[\n\r]+|(?<=\w)\s+(?=[A-Z]{2}\d)/);
    const newDb: Record<string, { from: string; to: string }> = {};
    
    entries.forEach(entry => {
      const parts = entry.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        const [plate, from, to] = parts;
        newDb[plate.toUpperCase().replace(/\s+/g, '')] = { from, to };
      }
    });

    if (Object.keys(newDb).length > 0) {
      setRouteDb(prev => ({ ...prev, ...newDb }));
      setCsvInput('');
      
      // Optional: Try to save to server if we had an endpoint for it
      // For now, just update local state
      alert(`Successfully imported ${Object.keys(newDb).length} routes!`);
    } else {
      alert("Invalid format. Please use: PLATE, FROM, TO (one per line or separated by space)");
    }
  };

  const [isScanning, setIsScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [lastDetectedPlates, setLastDetectedPlates] = useState<Record<number, string>>({});
  const [lastOcrResult, setLastOcrResult] = useState<string>('');
  const activeDetections = useRef<Record<number, Detection>>({});

  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const schedulerRef = useRef<Tesseract.Scheduler | null>(null);

  useEffect(() => {
    const initScheduler = async () => {
      const scheduler = Tesseract.createScheduler();
      
      // Initialize 2 workers for parallel processing
      const createAndAddWorker = async () => {
        const worker = await Tesseract.createWorker('eng', 1, {
          workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@v5.0.0/dist/worker.min.js',
          langPath: 'https://tessdata.projectnaptha.com/4.0.0',
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0/tesseract-core.wasm.js',
        });
        
        // Whitelist alphanumeric characters for speed and accuracy
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        });
        
        scheduler.addWorker(worker);
        return worker;
      };

      await Promise.all([createAndAddWorker(), createAndAddWorker()]);
      schedulerRef.current = scheduler;
    };
    
    initScheduler();
    
    return () => {
      schedulerRef.current?.terminate();
    };
  }, []);

  const handleBusDeparture = useCallback(async (platform: number) => {
    if (activeDetections.current[platform]) {
      const departingBus = activeDetections.current[platform];
      const timeOut = new Date().toLocaleTimeString();
      departingBus.timeOut = timeOut;
      
      // Update detections state to show timeOut
      setDetections(prev => prev.map(d => 
        d.id === departingBus.id ? { ...d, timeOut } : d
      ));
      
      // Log to CSV on server
      try {
        await fetch('/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(departingBus)
        });
      } catch (err) {
        console.error("Failed to log departure:", err);
      }
      
      delete activeDetections.current[platform];
      setLastDetectedPlates(prev => ({ ...prev, [platform]: '' }));
    }
  }, []);

  const scanFeeds = useCallback(async (isAuto = false) => {
    if (isScanning || !schedulerRef.current) return;
    setIsScanning(true);
    setLastScanTime(new Date());
    
    try {
      // Find all active video elements AND image elements (for IP cameras)
      const feeds = Array.from(document.querySelectorAll('video, img.object-cover'));
      if (feeds.length === 0) {
        if (!isAuto) alert("No active camera feeds found to scan.");
        setIsScanning(false);
        return;
      }

      // Process all feeds in parallel using the scheduler
      await Promise.all(feeds.map(async (feed) => {
        // Skip if it's not a valid feed (e.g. placeholder images)
        if (feed instanceof HTMLImageElement && !feed.src.startsWith('http')) return;
        if (feed instanceof HTMLImageElement && feed.src.includes('picsum.photos')) return;

        // Find which platform this feed belongs to
        const platformContainer = feed.closest('.relative');
        const platformText = platformContainer?.querySelector('.font-mono.text-\\[9px\\]')?.textContent;
        const platform = platformText ? parseInt(platformText.replace('P', '')) : 1;

        // SPEED OPTIMIZATION: Force a smaller canvas size for OCR
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(feed as unknown as CanvasImageSource, 0, 0, 640, 360);
        const imageData = canvas.toDataURL('image/jpeg', 0.6); // Lower quality for speed

        // OCR using scheduler (will automatically pick an available worker)
        const result = await schedulerRef.current!.addJob('recognize', imageData);
        
        // Clean up the detected text
        const rawText = result.data.text.toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .replace(/[OI]/g, (m) => m === 'O' ? '0' : '1')
          .replace(/L/g, '1')
          .replace(/S/g, '5')
          .replace(/B/g, '8')
          .replace(/Z/g, '2');
          
        setLastOcrResult(rawText);

        // Try to find a plate in the text
        const platesInDb = Object.keys(routeDb);
        let detectedPlate = 'NONE';

        for (const plate of platesInDb) {
          const normalizedPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '')
            .replace(/[OI]/g, (m) => m === 'O' ? '0' : '1')
            .replace(/L/g, '1')
            .replace(/S/g, '5')
            .replace(/B/g, '8')
            .replace(/Z/g, '2');
          
          if (rawText.includes(normalizedPlate)) {
            detectedPlate = plate;
            break;
          }
        }
        
        if (detectedPlate === 'NONE') {
          const plateMatch = rawText.match(/[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}/);
          if (plateMatch) detectedPlate = plateMatch[0];
        }
        
        if (detectedPlate !== 'NONE' && detectedPlate.length > 4) {
          if (activeDetections.current[platform]) {
            activeDetections.current[platform].missCount = 0;
          }

          if (detectedPlate !== lastDetectedPlates[platform]) {
            const route = routeDb[detectedPlate];
            const now = new Date();
            const timeStr = now.toLocaleTimeString();
            
            const newDetection: Detection = {
              id: Math.random().toString(36).substr(2, 9),
              plate: detectedPlate,
              platform,
              timestamp: now,
              timeIn: timeStr,
              from: route?.from || 'UNKNOWN',
              to: route?.to || 'UNKNOWN',
              missCount: 0
            };

            if (activeDetections.current[platform]) {
              await handleBusDeparture(platform);
            }

            setDetections(prev => [newDetection, ...prev].slice(0, 50));
            setActivePlatform(platform);
            announce(newDetection);
            
            activeDetections.current[platform] = newDetection;
            setLastDetectedPlates(prev => ({ ...prev, [platform]: detectedPlate }));
          }
        } else if (detectedPlate === 'NONE' || detectedPlate.length < 5) {
          if (activeDetections.current[platform]) {
            // Immediate departure if plate is not detected (user requested no buffer)
            await handleBusDeparture(platform);
          }
        }
      }));
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, routeDb, announce, lastDetectedPlates, handleBusDeparture]);

  // Simulation Logic - REMOVED to prevent false detections
  // const triggerDetection = useCallback((silent = false) => { ... });

  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect (cascading renders)
    const timer = setTimeout(() => {
      setMounted(true);
      
      // Initial log
      setDetections([{
        id: 'init',
        plate: 'SYSTEM_BOOT',
        platform: 0,
        timestamp: new Date(),
        timeIn: new Date().toLocaleTimeString()
      }]);
    }, 0);

    const scanInterval = setInterval(() => {
      if (autoScan) {
        scanFeeds(true);
      }
    }, 5000); // Scan every 5 seconds in auto mode

    return () => {
      clearTimeout(timer);
      clearInterval(scanInterval);
    };
  }, [autoScan, scanFeeds]);

  const updateCameraConfig = (platform: number, config: Partial<CameraConfig>) => {
    setCameraConfigs(prev => {
      const newConfigs = prev.map(c => 
        c.platform === platform ? { ...c, ...config } : c
      );
      
      // If camera is disabled, trigger departure for any bus on this platform
      const updatedConfig = newConfigs.find(c => c.platform === platform);
      if (updatedConfig?.type === 'none' && activeDetections.current[platform]) {
        handleBusDeparture(platform);
      }
      
      return newConfigs;
    });
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-4 flex justify-between items-center bg-[#E4E3E0] sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-[#141414] p-2 rounded-sm">
            <Shield className="w-6 h-6 text-[#E4E3E0]" />
          </div>
          <div>
            <h1 className="font-serif italic text-xl leading-none">Smart Bus CCTV System</h1>
            <p className="text-[10px] uppercase tracking-widest opacity-50 font-mono">Multi-Platform Surveillance v2.4</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 font-mono text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
              <span>SYSTEM ACTIVE</span>
            </div>
            <div className="flex items-center gap-2 opacity-50">
              <Activity className="w-3 h-3" />
              <span>CPU: 12%</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => announce({
                id: 'test',
                plate: 'TEST-1234',
                platform: 1,
                timestamp: new Date(),
                timeIn: new Date().toLocaleTimeString(),
                from: 'पुणे',
                to: 'मुंबई'
              })}
              className="flex items-center gap-2 px-4 py-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors font-mono text-xs"
            >
              <Volume2 className="w-4 h-4" />
              TEST MARATHI VOICE
            </button>
            <div className="flex flex-col items-end">
              <button 
                onClick={() => setAutoScan(!autoScan)}
                className={`flex items-center gap-2 px-4 py-2 border border-[#141414] transition-all font-mono text-xs ${autoScan ? 'bg-red-600 text-white border-red-600' : 'hover:bg-[#141414] hover:text-[#E4E3E0]'}`}
              >
                <Activity className={`w-4 h-4 ${autoScan ? 'animate-pulse' : ''}`} />
                {autoScan ? 'AUTO SCAN: ON' : 'AUTO SCAN: OFF'}
              </button>
              {lastScanTime && (
                <div className="flex flex-col items-end mt-1">
                  <span className="text-[8px] font-mono opacity-40">
                    LAST SCAN: {lastScanTime.toLocaleTimeString()}
                  </span>
                  {lastOcrResult && (
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-mono text-red-600 font-bold">
                        OCR: {lastOcrResult.slice(0, 15)}
                      </span>
                      <span className={`text-[8px] font-mono ${Object.keys(routeDb).some(p => lastOcrResult.includes(p.replace(/[^A-Z0-9]/g, ''))) ? 'text-green-600' : 'text-amber-600 opacity-50'}`}>
                        {Object.keys(routeDb).some(p => lastOcrResult.includes(p.replace(/[^A-Z0-9]/g, ''))) ? '✓ DB MATCH FOUND' : '✗ NO DB MATCH'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button 
              onClick={() => scanFeeds(false)}
              disabled={isScanning}
              className={`flex items-center gap-2 px-4 py-2 border border-[#141414] transition-colors font-mono text-xs ${isScanning && !autoScan ? 'bg-[#141414] text-[#E4E3E0] animate-pulse' : 'hover:bg-[#141414] hover:text-[#E4E3E0]'}`}
            >
              <Camera className={`w-4 h-4 ${isScanning && !autoScan ? 'animate-spin' : ''}`} />
              {isScanning && !autoScan ? 'SCANNING...' : 'SCAN ONCE'}
            </button>
            {showAdminControls && (
              <>
                <button 
                  onClick={() => setDetections([])}
                  className="flex items-center gap-2 px-4 py-2 border border-[#141414] hover:bg-red-600 hover:text-white transition-colors font-mono text-xs"
                >
                  CLEAR LOG
                </button>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 border border-[#141414] transition-colors ${showSettings ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414] hover:text-[#E4E3E0]'}`}
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setShowSource(!showSource)}
                  className="flex items-center gap-2 px-4 py-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors font-mono text-xs"
                >
                  <Code className="w-4 h-4" />
                  {showSource ? 'VIEW CCTV' : 'PYTHON SOURCE'}
                </button>
              </>
            )}
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
            >
              <Volume2 className={`w-4 h-4 ${isMuted ? 'opacity-30' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Camera Grid or Source */}
        <div className="lg:col-span-8 space-y-4">
          <AnimatePresence mode="wait">
            {showSource ? (
              <motion.div
                key="source"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-[calc(100vh-140px)]"
              >
                <PythonSource />
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
              >
                <CameraGrid 
                  activePlatform={activePlatform} 
                  lastDetection={detections[0]} 
                  configs={cameraConfigs}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Logs & Settings */}
        <div className="lg:col-span-4 space-y-4">
          {showSettings ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="border border-[#141414] p-4 bg-white/50 backdrop-blur-sm h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-4 border-b border-[#141414] pb-2">
                <h2 className="font-serif italic text-sm">Camera Configuration</h2>
                <Settings className="w-3 h-3 opacity-50" />
              </div>
              
              <div className="space-y-6">
                {/* Voice Selection Section */}
                <div className="space-y-3 border-b border-[#141414] pb-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest">Announcement Voice</h3>
                    <Volume2 className="w-3 h-3 opacity-50" />
                  </div>
                  
                  <div className="space-y-4">
                    {/* Sarvam AI Toggle */}
                    <div className="flex items-center justify-between bg-white border border-[#141414] p-2">
                      <label className="text-[10px] font-mono font-bold uppercase">Use Sarvam AI (High Quality)</label>
                      <input 
                        type="checkbox" 
                        checked={useSarvam}
                        onChange={(e) => {
                          setUseSarvam(e.target.checked);
                          localStorage.setItem('smart_bus_use_sarvam', e.target.checked.toString());
                        }}
                        className="w-4 h-4 accent-[#141414]"
                      />
                    </div>

                    {useSarvam && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase opacity-60">Sarvam API Key</label>
                          <input 
                            type="password"
                            value={sarvamApiKey}
                            onChange={(e) => {
                              setSarvamApiKey(e.target.value);
                              localStorage.setItem('smart_bus_sarvam_key', e.target.value);
                            }}
                            placeholder="Enter Sarvam AI API Key"
                            className="w-full bg-white border border-[#141414] text-[10px] font-mono px-2 py-2"
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase opacity-60">Sarvam Speaker</label>
                          <select 
                            value={sarvamSpeaker}
                            onChange={(e) => {
                              setSarvamSpeaker(e.target.value);
                              localStorage.setItem('smart_bus_sarvam_speaker', e.target.value);
                            }}
                            className="w-full bg-white border border-[#141414] text-[10px] font-mono px-2 py-2"
                          >
                            <option value="vidya">Vidya (Marathi Female)</option>
                            <option value="anushka">Anushka (Hindi/Marathi Female)</option>
                            <option value="ritu">Ritu (Female)</option>
                            <option value="priya">Priya (Female)</option>
                            <option value="neha">Neha (Female)</option>
                            <option value="abhilash">Abhilash (Male)</option>
                            <option value="rahul">Rahul (Male)</option>
                            <option value="rohan">Rohan (Male)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase opacity-60">Sarvam Model</label>
                          <select 
                            value={sarvamModel}
                            onChange={(e) => {
                              setSarvamModel(e.target.value);
                              localStorage.setItem('smart_bus_sarvam_model', e.target.value);
                            }}
                            className="w-full bg-white border border-[#141414] text-[10px] font-mono px-2 py-2"
                          >
                            <option value="bulbul:v3">Bulbul v3 (Latest)</option>
                            <option value="bulbul:v2">Bulbul v2</option>
                            <option value="bulbul:v3-beta">Bulbul v3-beta</option>
                          </select>
                        </div>
                        <p className="text-[8px] opacity-50 font-mono">Get your key from api.sarvam.ai</p>
                      </div>
                    )}

                    {!useSarvam && (
                      <div className="space-y-2">
                        <select 
                          value={selectedVoiceURI}
                          onChange={(e) => {
                            setSelectedVoiceURI(e.target.value);
                            localStorage.setItem('smart_bus_voice', e.target.value);
                          }}
                          className="w-full bg-white border border-[#141414] text-[10px] font-mono px-2 py-2"
                        >
                          <option value="">DEFAULT MARATHI</option>
                          {availableVoices.map(voice => (
                            <option key={voice.voiceURI} value={voice.voiceURI}>
                              {voice.name} ({voice.lang})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono uppercase opacity-60">Speed: {voiceRate.toFixed(1)}</label>
                        <input 
                          type="range" min="0.5" max="2" step="0.1"
                          value={voiceRate}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setVoiceRate(val);
                            localStorage.setItem('smart_bus_voice_rate', val.toString());
                          }}
                          className="w-full h-1 bg-[#141414] rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono uppercase opacity-60">Pitch: {voicePitch.toFixed(1)}</label>
                        <input 
                          type="range" min="0.5" max="2" step="0.1"
                          value={voicePitch}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setVoicePitch(val);
                            localStorage.setItem('smart_bus_voice_pitch', val.toString());
                          }}
                          className="w-full h-1 bg-[#141414] rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] opacity-60 font-mono italic">
                    Tip: Sarvam AI provides high-quality Indian voices. Browser TTS is free but lower quality.
                  </p>
                </div>

                {/* CSV Import Section */}
                <div className="space-y-3 border-b border-[#141414] pb-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest">Bulk Route Import</h3>
                    <Bus className="w-3 h-3 opacity-50" />
                  </div>
                  <p className="text-[9px] opacity-60 font-mono">Paste CSV data: PLATE, FROM, TO (one per line)</p>
                  <textarea 
                    value={csvInput}
                    onChange={(e) => setCsvInput(e.target.value)}
                    placeholder="MH12AB1234, Pune, Mumbai&#10;MH14CD5678, Nashik, Aurangabad"
                    className="w-full h-24 bg-white border border-[#141414] text-[10px] font-mono p-2 resize-none"
                  />
                  <button 
                    onClick={handleCsvImport}
                    className="w-full bg-[#141414] text-[#E4E3E0] py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-black transition-colors"
                  >
                    IMPORT ROUTES
                  </button>
                  <div className="flex justify-between items-center text-[9px] font-mono">
                    <p className="opacity-40 italic">Currently loaded: {Object.keys(routeDb).length} routes</p>
                    <button 
                      onClick={() => loadRoutes()}
                      className="text-blue-600 hover:underline font-bold"
                    >
                      RELOAD CSV
                    </button>
                    <p className={Object.keys(routeDb).length > 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                      {Object.keys(routeDb).length > 0 ? "✓ BACKEND DATA LOADED" : "✗ NO BACKEND DATA"}
                    </p>
                  </div>
                  <a 
                    href="/api/log" 
                    download 
                    className="w-full border border-[#141414] text-[#141414] py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors text-center block"
                  >
                    DOWNLOAD DETECTIONS LOG (CSV)
                  </a>
                </div>

                {cameraConfigs.map((config) => (
                  <div key={config.platform} className="space-y-2 border-b border-[#141414]/10 pb-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest">Platform {config.platform}</span>
                      <select 
                        value={config.type}
                        onChange={(e) => updateCameraConfig(config.platform, { type: e.target.value as any, value: '' })}
                        className="bg-transparent border border-[#141414] text-[10px] font-mono px-2 py-1"
                      >
                        <option value="none">DISABLED</option>
                        <option value="device">HARDWARE DEVICE</option>
                        <option value="url">IP CAMERA URL</option>
                      </select>
                    </div>

                    {config.type === 'device' && (
                      <div className="space-y-1">
                        <select 
                          value={config.value}
                          onChange={(e) => updateCameraConfig(config.platform, { value: e.target.value })}
                          className="w-full bg-white border border-[#141414] text-[10px] font-mono px-2 py-2"
                        >
                          <option value="">SELECT CAMERA...</option>
                          {availableDevices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${device.deviceId.slice(0, 5)}`}</option>
                          ))}
                        </select>
                        {config.value && cameraConfigs.filter(c => c.type === 'device' && c.value === config.value).length > 1 && (
                          <p className="text-[9px] text-amber-600 font-mono leading-tight">
                            ⚠️ This camera is already in use by another platform. Most cameras only support one stream at a time.
                          </p>
                        )}
                      </div>
                    )}

                    {config.type === 'url' && (
                      <input 
                        type="text"
                        placeholder="http://ip-address:port/video"
                        value={config.value}
                        onChange={(e) => updateCameraConfig(config.platform, { value: e.target.value })}
                        className="w-full bg-white border border-[#141414] text-[10px] font-mono px-2 py-2"
                      />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <>
              <div className="border border-[#141414] p-4 bg-white/50 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4 border-b border-[#141414] pb-2">
                  <h2 className="font-serif italic text-sm">Real-time Detection Log</h2>
                  <Terminal className="w-3 h-3 opacity-50" />
                </div>
                <DetectionLog detections={detections} />
              </div>

              <div className="border border-[#141414] p-4 bg-[#141414] text-[#E4E3E0]">
                <h3 className="font-mono text-[10px] uppercase tracking-widest mb-4 opacity-70">Platform Status</h3>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`aspect-square border border-[#E4E3E0]/20 flex flex-col items-center justify-center gap-1 transition-colors ${activePlatform === i + 1 ? 'bg-green-600 border-green-400' : ''}`}
                    >
                      <span className="text-[10px] font-mono">P{i + 1}</span>
                      <div className={`w-1 h-1 rounded-full ${activePlatform === i + 1 ? 'bg-white' : 'bg-green-500'}`} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer Status Bar */}
      <footer className="fixed bottom-0 w-full border-t border-[#141414] bg-[#E4E3E0] px-4 py-1 flex justify-between items-center font-mono text-[9px] uppercase tracking-tighter opacity-70">
        <div className="flex gap-4">
          <span>LATENCY: 42MS</span>
          <span>STORAGE: 84% FREE</span>
          <span>CAMERAS: 10/10 ONLINE</span>
        </div>
        <div className="flex gap-4">
          {mounted && (
            <>
              <span>{new Date().toLocaleDateString()}</span>
              <span>{new Date().toLocaleTimeString()}</span>
            </>
          )}
        </div>
      </footer>
      
      {/* Visual hint for mobile users (optional - remove if you want it hidden) */}
      <div className="fixed bottom-20 right-4 opacity-30 md:hidden">
        <div className="bg-[#141414] text-[#E4E3E0] text-[8px] px-2 py-1 rounded font-mono">
          Triple tap anywhere
        </div>
      </div>
    </div>
  );
}