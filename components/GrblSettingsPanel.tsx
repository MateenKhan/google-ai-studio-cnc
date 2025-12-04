
import React, { useState, useEffect, useRef } from 'react';
import { Settings, Save, RefreshCw, X, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';
import { serialService } from '../services/serialService';
import { GrblSetting } from '../types';

interface GrblSettingsPanelProps {
  settings: Record<string, string>;
  onClose: () => void;
  onRefresh: () => void;
}

const GRBL_DESCRIPTIONS: Record<string, string> = {
    '0': 'Step pulse, microseconds',
    '1': 'Step idle delay, milliseconds',
    '2': 'Step port invert, mask',
    '3': 'Direction port invert, mask',
    '4': 'Step enable invert, boolean',
    '5': 'Limit pins invert, boolean',
    '6': 'Probe pin invert, boolean',
    '10': 'Status report, mask',
    '11': 'Junction deviation, mm',
    '12': 'Arc tolerance, mm',
    '13': 'Report inches, boolean',
    '20': 'Soft limits, boolean',
    '21': 'Hard limits, boolean',
    '22': 'Homing cycle, boolean',
    '23': 'Homing dir invert, mask',
    '24': 'Homing feed, mm/min',
    '25': 'Homing seek, mm/min',
    '26': 'Homing debounce, milliseconds',
    '27': 'Homing pull-off, mm',
    '30': 'Max spindle speed, RPM',
    '31': 'Min spindle speed, RPM',
    '32': 'Laser mode, boolean',
    '100': 'X steps/mm',
    '101': 'Y steps/mm',
    '102': 'Z steps/mm',
    '110': 'X Max rate, mm/min',
    '111': 'Y Max rate, mm/min',
    '112': 'Z Max rate, mm/min',
    '120': 'X Acceleration, mm/sec^2',
    '121': 'Y Acceleration, mm/sec^2',
    '122': 'Z Acceleration, mm/sec^2',
    '130': 'X Max travel, mm',
    '131': 'Y Max travel, mm',
    '132': 'Z Max travel, mm',
};

// Priority settings to show at the top
const PRIORITY_SETTINGS = ['100', '101', '102', '110', '111', '112', '120', '121', '122'];

const GrblSettingsPanel: React.FC<GrblSettingsPanelProps> = ({ settings, onClose, onRefresh }) => {
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!wrapperRef.current) return;

    if (!document.fullscreenElement) {
      try {
        await wrapperRef.current.requestFullscreen();
      } catch (err) {
        console.error("Error attempting to enable fullscreen:", err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    }
  };

  // Auto-refresh on mount if empty
  useEffect(() => {
     if (Object.keys(settings).length === 0) {
         onRefresh();
     }
  }, []);

  const handleEdit = (id: string, val: string) => {
      setEditedSettings(prev => ({ ...prev, [id]: val }));
  };

  const handleSave = (id: string) => {
      const val = editedSettings[id];
      if (val !== undefined) {
          serialService.send(`$${id}=${val}`);
          // Optimistically update or wait for refresh? Let's refresh.
          setTimeout(onRefresh, 500);
          setEditedSettings(prev => {
              const next = { ...prev };
              delete next[id];
              return next;
          });
      }
  };

  const allKeys = Object.keys(settings);
  const priorityKeys = PRIORITY_SETTINGS.filter(k => allKeys.includes(k));
  const otherKeys = allKeys.filter(k => !PRIORITY_SETTINGS.includes(k)).sort((a,b) => parseInt(a) - parseInt(b));
  
  const filterKeys = (keys: string[]) => keys.filter(key => {
      if (!search) return true;
      const desc = GRBL_DESCRIPTIONS[key] || '';
      return key.includes(search) || desc.toLowerCase().includes(search.toLowerCase());
  });

  const renderRow = (key: string) => {
      const currentVal = settings[key];
      const editedVal = editedSettings[key];
      const isEdited = editedVal !== undefined && editedVal !== currentVal;
      
      return (
          <div key={key} className="bg-slate-800 p-3 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
              <div className="flex justify-between items-start mb-1">
                  <span className="font-mono text-sky-400 font-bold">${key}</span>
                  <span className="text-xs text-slate-500 text-right max-w-[70%]">{GRBL_DESCRIPTIONS[key] || 'Unknown Setting'}</span>
              </div>
              <div className="flex gap-2 mt-2">
                  <input 
                    type="text" 
                    value={editedVal !== undefined ? editedVal : currentVal} 
                    onChange={(e) => handleEdit(key, e.target.value)}
                    className={`flex-1 bg-slate-900 border rounded px-2 py-1 text-sm outline-none ${isEdited ? 'border-yellow-500 text-yellow-500' : 'border-slate-600 text-slate-200'}`}
                  />
                  {isEdited && (
                      <button onClick={() => handleSave(key)} className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded">
                          <Save size={14} />
                      </button>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div 
      ref={wrapperRef}
      className={`flex flex-col bg-slate-900 w-full ${isFullscreen ? 'fixed inset-0 z-[10000] w-screen h-screen' : 'h-full'}`}
    >
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
        <h2 className="font-bold text-slate-100 flex items-center gap-2">
            <Settings size={18} /> Firmware Settings
        </h2>
        <div className="flex gap-2">
             <button onClick={toggleFullscreen} className="p-1.5 text-slate-400 hover:text-sky-400 bg-slate-700 rounded" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
               {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
             </button>
             <button onClick={onRefresh} className="text-slate-400 hover:text-sky-400" title="Refresh $$"><RefreshCw size={18} /></button>
             <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
      </div>

      <div className="p-2 bg-slate-800 border-b border-slate-700">
          <input 
            type="text" 
            placeholder="Search settings..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-sky-500"
          />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {allKeys.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500 gap-2">
                <AlertTriangle size={32} />
                <p className="text-sm">No settings found.</p>
                <button onClick={onRefresh} className="text-sky-400 text-xs hover:underline">Try Refreshing ($$)</button>
            </div>
          )}

          {/* Common Settings Group */}
          {filterKeys(priorityKeys).length > 0 && (
             <div>
                <h3 className="text-xs font-semibold text-sky-500 uppercase tracking-wider mb-2 px-1">Motor & Calibration</h3>
                <div className="space-y-2">
                    {filterKeys(priorityKeys).map(renderRow)}
                </div>
             </div>
          )}

          {/* Other Settings Group */}
          {filterKeys(otherKeys).length > 0 && (
             <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1 mt-2">Advanced Configuration</h3>
                <div className="space-y-2">
                    {filterKeys(otherKeys).map(renderRow)}
                </div>
             </div>
          )}
      </div>
    </div>
  );
};

export default GrblSettingsPanel;
