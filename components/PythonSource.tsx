'use client';

import React, { useState } from 'react';
import { Copy, Check, Terminal, FileCode, Play, Shield, Cpu, Activity } from 'lucide-react';

const PYTHON_CODE = `import cv2
import threading
import time
import csv
import pyttsx3
import easyocr
import numpy as np
from ultralytics import YOLO

# --- CONFIGURATION ---
# 0 is usually laptop camera, 1-3 are external webcams
CAMERA_SOURCES = [0, 1, 2, 3]  
PLATFORMS = [f"Platform {i+1}" for i in range(len(CAMERA_SOURCES))]
FRAME_SKIP = 10
OCR_READER = easyocr.Reader(['en'])
YOLO_MODEL = YOLO('yolov8n.pt') 
ROUTE_DB_FILE = 'bus_routes.csv'

# --- SHARED STATE ---
last_seen_plates = {p: {"plate": None, "time": 0} for p in PLATFORMS}
speech_lock = threading.Lock()
engine = pyttsx3.init()

# --- UTILITIES ---
def clean_plate_text(text):
    """Corrects common OCR errors and validates Indian format."""
    corrections = {'O': '0', 'I': '1', 'Z': '2', 'S': '5', 'B': '8'}
    text = "".join([corrections.get(c, c) for c in text.upper() if c.isalnum()])
    # Basic Indian format check: MH12AB1234
    if len(text) >= 8 and text[:2].isalpha():
        return text
    return None

def load_route_db():
    routes = {}
    try:
        with open(ROUTE_DB_FILE, mode='r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                routes[row['plate']] = (row['from'], row['to'])
    except FileNotFoundError:
        print(f"Warning: {ROUTE_DB_FILE} not found. Using empty DB.")
    return routes

ROUTE_DB = load_route_db()

def announce(plate, platform):
    """Thread-safe Marathi voice announcement."""
    with speech_lock:
        route = ROUTE_DB.get(plate)
        if route:
            msg = f"बस {route[0]} ते {route[1]} जाणारी बस {platform} वर आहे"
        else:
            msg = f"बस क्रमांक {plate} {platform} वर आहे"
        
        print(f"[VOICE] {msg}")
        
        # --- MARATHI VOICE SELECTION ---
        # To find Marathi voice index:
        # voices = engine.getProperty('voices')
        # for i, v in enumerate(voices): print(i, v.name)
        # engine.setProperty('voice', voices[INDEX].id)
        
        engine.say(msg)
        engine.runAndWait()

# --- CORE PROCESSING ---
class CameraProcessor(threading.Thread):
    def __init__(self, source, platform_id):
        super().__init__()
        self.source = source
        self.platform = platform_id
        self.cap = cv2.VideoCapture(source)
        self.running = True
        self.frame_count = 0
        self.current_frame = None

    def run(self):
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                print(f"[ERROR] Camera {self.platform} disconnected.")
                time.sleep(5)
                self.cap = cv2.VideoCapture(self.source)
                continue

            self.frame_count += 1
            if self.frame_count % FRAME_SKIP == 0:
                self.process_frame(frame)
            
            self.current_frame = cv2.resize(frame, (640, 360))

    def process_frame(self, frame):
        # 1. Detect Objects (Vehicles/Plates)
        results = YOLO_MODEL(frame, verbose=False)
        
        for r in results:
            for box in r.boxes:
                # Filter for 'license plate' class if using specialized model
                # Here we simulate cropping the detected region
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                plate_crop = frame[y1:y2, x1:x2]
                
                # 2. OCR Recognition
                ocr_results = OCR_READER.readtext(plate_crop)
                for (_, text, conf) in ocr_results:
                    if conf > 0.5:
                        plate = clean_plate_text(text)
                        if plate:
                            self.handle_detection(plate)

    def handle_detection(self, plate):
        now = time.time()
        last = last_seen_plates[self.platform]
        
        # 3. Smart Logic: Avoid duplicates within 10s
        if plate != last["plate"] or (now - last["time"] > 10):
            last_seen_plates[self.platform] = {"plate": plate, "time": now}
            print(f"[DETECTED] {plate} at {self.platform}")
            threading.Thread(target=announce, args=(plate, self.platform)).start()

    def stop(self):
        self.running = False
        self.cap.release()

# --- MAIN SYSTEM ---
def start_system():
    processors = []
    for i, src in enumerate(CAMERA_SOURCES):
        p = CameraProcessor(src, PLATFORMS[i])
        p.start()
        processors.push(p)

    print("--- SMART BUS CCTV SYSTEM ACTIVE ---")
    
    try:
        while True:
            # Create CCTV Grid Layout
            frames = [p.current_frame for p in processors if p.current_frame is not None]
            if len(frames) == 10:
                # 2x5 Grid
                top_row = np.hstack(frames[:5])
                bottom_row = np.hstack(frames[5:])
                grid = np.vstack([top_row, bottom_row])
                
                cv2.imshow("Smart Bus CCTV Dashboard", grid)
            
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    finally:
        for p in processors:
            p.stop()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    start_system()
`;

const PythonSource: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(PYTHON_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col border border-[#141414] bg-[#1e1e1e] text-[#d4d4d4] rounded-sm overflow-hidden shadow-2xl">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#141414]">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          </div>
          <div className="h-4 w-[1px] bg-white/10 mx-2" />
          <div className="flex items-center gap-2 text-[11px] font-mono opacity-70">
            <FileCode className="w-3 h-3" />
            <span>smart_bus_cctv.py</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-[10px] font-mono opacity-50 uppercase tracking-widest">
            <div className="flex items-center gap-1">
              <Cpu className="w-3 h-3" />
              <span>Python 3.10</span>
            </div>
            <div className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              <span>UTF-8</span>
            </div>
          </div>
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1 bg-white/10 hover:bg-white/20 transition-colors rounded-sm text-[11px] font-mono"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'COPIED' : 'COPY CODE'}
          </button>
        </div>
      </div>

      {/* Code Area */}
      <div className="flex-1 overflow-auto p-6 font-mono text-[13px] leading-relaxed custom-scrollbar selection:bg-blue-500/30">
        <pre className="whitespace-pre">
          {PYTHON_CODE.split('\n').map((line, i) => (
            <div key={i} className="flex group">
              <span className="w-12 text-right pr-4 opacity-20 select-none group-hover:opacity-40 transition-opacity">{i + 1}</span>
              <span className={
                line.startsWith('#') ? 'text-green-500/70 italic' :
                line.includes('def ') || line.includes('class ') ? 'text-blue-400' :
                line.includes('import ') || line.includes('from ') ? 'text-purple-400' :
                line.includes('"') || line.includes("'") ? 'text-orange-300' :
                'text-gray-300'
              }>
                {line}
              </span>
            </div>
          ))}
        </pre>
      </div>

      {/* Terminal Footer */}
      <div className="bg-[#141414] p-3 border-t border-white/5 flex items-center gap-4">
        <div className="flex items-center gap-2 text-green-500 font-mono text-[10px] uppercase tracking-widest">
          <Terminal className="w-3 h-3" />
          <span>Terminal Ready</span>
        </div>
        <div className="flex-1 h-[1px] bg-white/5" />
        <div className="flex items-center gap-2 text-white/30 font-mono text-[10px] uppercase tracking-widest">
          <Play className="w-3 h-3" />
          <span>Run Script</span>
        </div>
      </div>
    </div>
  );
};

export default PythonSource;
