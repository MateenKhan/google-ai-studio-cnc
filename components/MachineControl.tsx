
import React, { useState, useEffect, useRef } from 'react';
import { serialService } from '../services/serialService';
import { MachineStatus } from '../types';
import { Power, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, Crosshair, AlertCircle, Settings, Terminal } from 'lucide-react';

interface MachineControlProps {
  onClose: () => void;
  gcodeTotalSize?: { minX: number, maxX: number, minY: number, maxY: number };
}

const MachineControl: React.FC<MachineControlProps> = ({ onClose, gcodeTotalSize }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<MachineStatus>({ 
      state: 'Disconnected', 
      pos: { x: '0.000', y: '0.000', z: '0.000' },
      feed: '0',
      spindle: '0'
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [stepSize, setStepSize] = useState(10);
  const [command, setCommand] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      serialService.setCallbacks(
          (s) => {
              setStatus(s);
              setIsConnected(true);
          },
          (msg) => {
              setLogs(prev => [...prev.slice(-49), msg]);
          }
      );
  }, []);

  useEffect(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleConnect = async () => {
      try {
          await serialService.connect();
          setIsConnected(true);
          addLog('Connected to serial port.');
      } catch (e) {
          addLog('Failed to connect.');
      }
  };

  const handleDisconnect = async () => {
      await serialService.disconnect();
      setIsConnected(false);
      setStatus(prev => ({ ...prev, state: 'Disconnected' }));
      addLog('Disconnected.');
  };

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-49), msg]);

  const sendJog = (axis: string, dir: number) => {
      const cmd = `$J=G91 G21 ${axis}${dir * stepSize} F1000`; 
      serialService.send(cmd);
  };

  const sendCommand = (e: React.FormEvent) => {
      e.preventDefault();
      if (!command) return;
      serialService.send(command);
      setCommand('');
  };

  const width = gcodeTotalSize ? (gcodeTotalSize.maxX - gcodeTotalSize.minX).toFixed(2) : '0.00';
  const height = gcodeTotalSize ? (gcodeTotalSize.maxY - gcodeTotalSize.minY).toFixed(2) : '0.00';

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 w-full md:w-[350px]">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
        <h2 className="font-bold text-slate-100 flex items-center gap-2">
            <Settings size={18} /> Machine Control
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white"><AlertCircle size={18} className="rotate-45" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Connection Status */}
        <div className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="font-mono text-sm">{status.state}</span>
                </div>
                {!isConnected ? (
                    <button onClick={handleConnect} className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs rounded-md font-medium">
                        Connect
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
                        <div className="font-mono text-sky-400">{axis === 'X' ? status.pos.x : axis === 'Y' ? status.pos.y : status.pos.z}</div>
                    </div>
                ))}
            </div>
        </div>

        {/* Jog Controls */}
        <div className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase">Jog / Move</h3>
                <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700">
                    {[1, 10, 50].map(s => (
                        <button key={s} onClick={() => setStepSize(s)} className={`px-2 py-1 text-[10px] rounded ${stepSize === s ? 'bg-sky-600 text-white' : 'text-slate-400'}`}>{s}mm</button>
                    ))}
                </div>
             </div>
             
             <div className="flex gap-4">
                 <div className="flex-1 aspect-square bg-slate-900 rounded-full border border-slate-700 relative">
                     <button onClick={() => sendJog('Y', 1)} className="absolute top-2 left-1/2 -translate-x-1/2 p-2 hover:bg-slate-800 rounded-full text-slate-300"><ArrowUp size={24} /></button>
                     <button onClick={() => sendJog('Y', -1)} className="absolute bottom-2 left-1/2 -translate-x-1/2 p-2 hover:bg-slate-800 rounded-full text-slate-300"><ArrowDown size={24} /></button>
                     <button onClick={() => sendJog('X', -1)} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-800 rounded-full text-slate-300"><ArrowLeft size={24} /></button>
                     <button onClick={() => sendJog('X', 1)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-800 rounded-full text-slate-300"><ArrowRight size={24} /></button>
                     <button onClick={() => serialService.send('$H')} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-3 bg-slate-800 hover:bg-sky-600 rounded-full text-white shadow-lg border border-slate-700" title="Home"><Home size={20} /></button>
                 </div>
                 <div className="w-12 bg-slate-900 rounded-full border border-slate-700 flex flex-col items-center justify-between py-2">
                     <button onClick={() => sendJog('Z', 1)} className="p-2 hover:bg-slate-800 rounded-full text-slate-300"><ArrowUp size={20} /></button>
                     <span className="text-xs font-bold text-slate-500">Z</span>
                     <button onClick={() => sendJog('Z', -1)} className="p-2 hover:bg-slate-800 rounded-full text-slate-300"><ArrowDown size={20} /></button>
                 </div>
             </div>
             
             <div className="grid grid-cols-2 gap-2 mt-4">
                 <button onClick={() => serialService.send('G10 P0 L20 X0 Y0 Z0')} className="text-xs py-2 bg-slate-700 rounded hover:bg-slate-600 flex items-center justify-center gap-1"><Crosshair size={14} /> Zero All</button>
                 <button onClick={() => serialService.send('$X')} className="text-xs py-2 bg-slate-700 rounded hover:bg-slate-600 flex items-center justify-center gap-1"><Power size={14} /> Unlock</button>
             </div>
        </div>

        {/* Job Info */}
        {gcodeTotalSize && (
            <div className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700">
                <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">Job Dimensions</h3>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Width:</span><span className="text-slate-200">{width} mm</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Height:</span><span className="text-slate-200">{height} mm</span></div>
            </div>
        )}

        {/* Terminal */}
        <div className="bg-slate-950 rounded-xl border border-slate-700 flex flex-col h-48">
            <div className="flex-1 p-2 overflow-y-auto font-mono text-[10px] text-green-400/80 space-y-1">
                {logs.map((l, i) => <div key={i}>{l}</div>)}
                <div ref={logEndRef}></div>
            </div>
            <form onSubmit={sendCommand} className="border-t border-slate-800 p-2 flex gap-2">
                <input type="text" value={command} onChange={e => setCommand(e.target.value)} placeholder="Send..." className="flex-1 bg-transparent outline-none text-slate-200 text-xs font-mono" />
                <button type="submit" className="text-slate-400 hover:text-white"><Terminal size={14} /></button>
            </form>
        </div>
      </div>
    </div>
  );
};

export default MachineControl;
