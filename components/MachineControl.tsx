
import React, { useState } from 'react';
import { serialService } from '../services/serialService';
import { MachineStatus } from '../types';
import { Power, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, Crosshair, AlertCircle, Settings, Usb, Smartphone, ScanLine, X } from 'lucide-react';

interface MachineControlProps {
  onClose: () => void;
  gcodeTotalSize?: { minX: number, maxX: number, minY: number, maxY: number };
  machineStatus: MachineStatus;
  isConnected: boolean;
  onAddLog: (msg: string) => void;
  onDisconnect: () => void;
  jogSpeed: number;
  onJogSpeedChange: (speed: number) => void;
}

const MachineControl: React.FC<MachineControlProps> = ({ 
    onClose, 
    gcodeTotalSize, 
    machineStatus,
    isConnected,
    onAddLog,
    onDisconnect,
    jogSpeed,
    onJogSpeedChange
}) => {
  const [stepSize, setStepSize] = useState(10);
  const [jogMode, setJogMode] = useState<'STEP' | 'CONTINUOUS'>('STEP');
  const [showMobileWidget, setShowMobileWidget] = useState(false);
  
  const handleConnect = async () => {
      try {
          await serialService.connect();
          onAddLog('Connected to serial port.');
      } catch (e: any) {
          console.error(e);
          let msg = `Connect Failed: ${e.message || e}`;
          if (e.name === 'NotFoundError') {
              msg = 'Connection cancelled: No port selected.';
          } else if (e.name === 'SecurityError' || e.name === 'NotAllowedError') {
              msg = 'Permission denied. Please allow Serial access in browser settings.';
          } else if (e.message && e.message.includes('permissions policy')) {
               msg = 'Serial API blocked by host policy. Ensure "serial" permission is requested.';
          } else if (e.name === 'NetworkError' || (e.message && e.message.includes('Failed to open'))) {
              msg = 'Failed to open port. It might be in use by another tab or app.';
          }
          onAddLog(msg);
      }
  };

  const handleDisconnect = async () => {
      await serialService.disconnect();
      onDisconnect();
      onAddLog('Disconnected.');
  };

  const handleJogStart = (axis: string, dir: number) => {
      if (jogMode === 'STEP') {
          const cmd = `$J=G91 G21 ${axis}${dir * stepSize} F${jogSpeed}`; 
          serialService.send(cmd);
      } else {
          // Continuous Jog: Send large move, cancel on release
          const cmd = `$J=G91 G21 ${axis}${dir * 1000} F${jogSpeed}`; 
          serialService.send(cmd);
      }
  };

  const handleJogEnd = () => {
      if (jogMode === 'CONTINUOUS') {
          serialService.sendByte(0x85);
      }
  };

  const JogBtn = ({ axis, dir, icon: Icon, className }: { axis: string, dir: number, icon: any, className: string }) => (
      <button 
        onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handleJogStart(axis, dir);
        }}
        onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            handleJogEnd();
        }}
        onPointerLeave={handleJogEnd}
        className={className}
        style={{ touchAction: 'none' }}
      >
          <Icon size={24} />
      </button>
  );

  const handleZeroAll = () => {
      if (!isConnected) {
          onAddLog("Error: Connect to machine first.");
          return;
      }
      if (machineStatus.state === 'Alarm') {
           onAddLog("Error: Machine is in ALARM state. Unlock first.");
           return;
      }
      // G10 L20 P1 sets the current Work Coordinate System (G54 default) to 0,0,0 at current location
      // This is the standard "Zero All" behavior for CNC soft reset
      serialService.send('G90 G21'); 
      serialService.send('G10 L20 P1 X0 Y0 Z0');
      onAddLog("Command Sent: Zero All (G10 L20 P1). If coordinates don't reset, check $10 status report mask.");
  };

  // Safe dimension display
  const hasBounds = gcodeTotalSize && 
    isFinite(gcodeTotalSize.maxX) && isFinite(gcodeTotalSize.minX) &&
    isFinite(gcodeTotalSize.maxY) && isFinite(gcodeTotalSize.minY);

  const width = hasBounds ? (gcodeTotalSize.maxX - gcodeTotalSize.minX).toFixed(2) : '0.00';
  const height = hasBounds ? (gcodeTotalSize.maxY - gcodeTotalSize.minY).toFixed(2) : '0.00';

  return (
    <div className="flex flex-col h-full bg-slate-900 w-full relative">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800 shrink-0">
        <h2 className="font-bold text-slate-100 flex items-center gap-2">
            <Settings size={18} /> Machine Control
        </h2>
        <div className="flex gap-2">
             <button onClick={() => setShowMobileWidget(true)} className="text-slate-400 hover:text-white" title="Mobile Control"><Smartphone size={18} /></button>
             <button onClick={onClose} className="text-slate-400 hover:text-white"><AlertCircle size={18} className="rotate-45" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24 custom-scrollbar">
        {/* Connection Status */}
        <div className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="font-mono text-sm">{machineStatus.state}</span>
                </div>
                {!isConnected ? (
                    <button onClick={handleConnect} className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs rounded-md font-medium flex items-center gap-1">
                        <Usb size={12} /> Connect
                    </button>
                ) : (
                    <button onClick={handleDisconnect} className="px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-200 text-xs rounded-md font-medium">
                        Disconnect
                    </button>
                )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
                {['X', 'Y', 'Z'].map(axis => (
                    <div key={axis} className="bg-slate-900 p-2 rounded border border-slate-700">
                        <div className="text-xs text-slate-500">{axis}</div>
                        <div className="font-mono text-sky-400">{axis === 'X' ? machineStatus.pos.x : axis === 'Y' ? machineStatus.pos.y : machineStatus.pos.z}</div>
                    </div>
                ))}
            </div>
             <button onClick={handleZeroAll} className="w-full mt-2 text-xs py-2 bg-slate-700 rounded hover:bg-slate-600 flex items-center justify-center gap-1 text-yellow-500 border border-slate-600"><Crosshair size={14} /> Zero All Axes (G54)</button>
        </div>

        {/* Jog Controls */}
        <div className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase">Jog / Move</h3>
                <div className="flex gap-2 items-center">
                     <button 
                        onClick={() => setJogMode(prev => prev === 'STEP' ? 'CONTINUOUS' : 'STEP')}
                        className={`text-[10px] px-2 py-0.5 rounded border ${jogMode === 'CONTINUOUS' ? 'bg-orange-900/40 text-orange-400 border-orange-900' : 'bg-slate-700 text-slate-400 border-slate-600'}`}
                     >
                         {jogMode === 'CONTINUOUS' ? 'CONT.' : 'STEP'}
                     </button>
                    <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700">
                        {[1, 10, 50].map(s => (
                            <button key={s} onClick={() => setStepSize(s)} className={`px-2 py-1 text-[10px] rounded ${stepSize === s ? 'bg-sky-600 text-white' : 'text-slate-400'}`}>{s}</button>
                        ))}
                    </div>
                </div>
             </div>
             
             {/* Jog Speed Slider */}
             <div className="mb-4">
                 <div className="flex justify-between text-xs text-slate-500 mb-1">
                     <span>Jog Speed</span>
                     <span>{jogSpeed} mm/min</span>
                 </div>
                 <input 
                    type="range" 
                    min="100" 
                    max="5000" 
                    step="100" 
                    value={jogSpeed} 
                    onChange={(e) => onJogSpeedChange(Number(e.target.value))}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                 />
             </div>
             
             <div className="flex gap-4">
                 <div className="flex-1 aspect-square bg-slate-900 rounded-full border border-slate-700 relative">
                     <JogBtn axis="Y" dir={1} icon={ArrowUp} className="absolute top-2 left-1/2 -translate-x-1/2 p-2 hover:bg-slate-800 rounded-full text-slate-300 active:bg-sky-600 active:text-white" />
                     <JogBtn axis="Y" dir={-1} icon={ArrowDown} className="absolute bottom-2 left-1/2 -translate-x-1/2 p-2 hover:bg-slate-800 rounded-full text-slate-300 active:bg-sky-600 active:text-white" />
                     <JogBtn axis="X" dir={-1} icon={ArrowLeft} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-800 rounded-full text-slate-300 active:bg-sky-600 active:text-white" />
                     <JogBtn axis="X" dir={1} icon={ArrowRight} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-800 rounded-full text-slate-300 active:bg-sky-600 active:text-white" />
                     <button onClick={() => serialService.send('$H')} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-3 bg-slate-800 hover:bg-sky-600 rounded-full text-white shadow-lg border border-slate-700" title="Home"><Home size={20} /></button>
                 </div>
                 <div className="w-12 bg-slate-900 rounded-full border border-slate-700 flex flex-col items-center justify-between py-2">
                     <JogBtn axis="Z" dir={1} icon={ArrowUp} className="p-2 hover:bg-slate-800 rounded-full text-slate-300 active:bg-sky-600 active:text-white" />
                     <span className="text-xs font-bold text-slate-500">Z</span>
                     <JogBtn axis="Z" dir={-1} icon={ArrowDown} className="p-2 hover:bg-slate-800 rounded-full text-slate-300 active:bg-sky-600 active:text-white" />
                 </div>
             </div>
             
             <div className="grid grid-cols-1 gap-2 mt-4">
                 <button onClick={() => serialService.send('$X')} className="text-xs py-2 bg-slate-700 rounded hover:bg-slate-600 flex items-center justify-center gap-1"><Power size={14} /> Unlock / Reset Alarm</button>
             </div>
        </div>
      </div>

      {/* Mobile Widget Modal */}
      {showMobileWidget && (
          <div className="absolute inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
               <button onClick={() => setShowMobileWidget(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
               <ScanLine size={48} className="text-sky-400 mb-4 animate-pulse" />
               <h3 className="text-xl font-bold text-white mb-2">Mobile Control</h3>
               <p className="text-sm text-slate-400 mb-6">Scan to open on your mobile device (requires network bridge) or use the simplified view.</p>
               
               <div className="bg-white p-2 rounded-lg mb-6">
                  {/* Placeholder QR */}
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.href)}`} alt="QR Code" className="w-32 h-32" />
               </div>

               <p className="text-xs text-slate-500 mb-4">Current URL:</p>
               <div className="bg-slate-800 px-4 py-2 rounded font-mono text-sky-400 text-sm mb-4 break-all select-all">
                   {window.location.href}
               </div>

               <button onClick={() => setShowMobileWidget(false)} className="px-6 py-2 bg-slate-800 rounded-full border border-slate-700 text-slate-300 hover:bg-slate-700">Close</button>
          </div>
      )}
    </div>
  );
};

export default MachineControl;
