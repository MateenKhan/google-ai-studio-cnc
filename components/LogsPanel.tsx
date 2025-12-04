
import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Send, Trash2, X, Pause, Play } from 'lucide-react';
import { serialService } from '../services/serialService';

interface LogsPanelProps {
  logs: string[];
  onClose: () => void;
  onClear: () => void;
  isLogEnabled?: boolean;
  onToggleLog?: () => void;
}

const LogsPanel: React.FC<LogsPanelProps> = ({ logs, onClose, onClear, isLogEnabled = true, onToggleLog }) => {
  const [command, setCommand] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLogEnabled) {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isLogEnabled]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    serialService.send(command);
    setCommand('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 w-full">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
        <h2 className="font-bold text-slate-100 flex items-center gap-2">
            <Terminal size={18} /> Console
        </h2>
        <div className="flex gap-2">
             {onToggleLog && (
                 <button 
                    onClick={onToggleLog} 
                    className={`text-slate-400 hover:text-white ${!isLogEnabled ? 'text-yellow-500' : ''}`} 
                    title={isLogEnabled ? "Pause Logs" : "Resume Logs"}
                 >
                     {isLogEnabled ? <Pause size={16} /> : <Play size={16} />}
                 </button>
             )}
             <button onClick={onClear} className="text-slate-400 hover:text-red-400" title="Clear Logs"><Trash2 size={16} /></button>
             <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
      </div>
      
      <div className="flex-1 p-2 overflow-y-auto font-mono text-xs text-green-400/90 space-y-1 bg-slate-950 custom-scrollbar relative">
        {!isLogEnabled && (
            <div className="sticky top-0 bg-yellow-900/80 text-yellow-200 text-center py-1 mb-2 text-xs border-b border-yellow-700 backdrop-blur">
                Logs Paused
            </div>
        )}
        {logs.length === 0 && <div className="text-slate-600 italic p-2">No logs yet...</div>}
        {logs.map((l, i) => (
            <div key={i} className="break-all whitespace-pre-wrap border-b border-slate-800/30 pb-0.5">{l}</div>
        ))}
        <div ref={logEndRef}></div>
      </div>

      <form onSubmit={handleSend} className="p-2 border-t border-slate-700 bg-slate-800 flex gap-2">
         <input 
            type="text" 
            value={command} 
            onChange={e => setCommand(e.target.value)} 
            placeholder="Send G-Code command..." 
            className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-slate-200 text-sm focus:border-sky-500 outline-none font-mono"
         />
         <button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white p-2 rounded transition-colors">
             <Send size={16} />
         </button>
      </form>
    </div>
  );
};

export default LogsPanel;
