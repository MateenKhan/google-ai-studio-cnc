
import React, { useState } from 'react';
import { Calculator, X } from 'lucide-react';

interface CalibrationHelperProps {
  onClose: () => void;
}

const CalibrationHelper: React.FC<CalibrationHelperProps> = ({ onClose }) => {
  const [currentSteps, setCurrentSteps] = useState<number>(250);
  const [commandedDist, setCommandedDist] = useState<number>(100);
  const [actualDist, setActualDist] = useState<number>(100);

  const newSteps = (currentSteps * (commandedDist / actualDist)) || 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
       <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
           <div className="bg-slate-900 p-4 flex justify-between items-center border-b border-slate-700">
               <h3 className="text-white font-semibold flex items-center gap-2">
                   <Calculator size={18} className="text-sky-400"/> Calibrate Steps
               </h3>
               <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18}/></button>
           </div>
           
           <div className="p-6 space-y-4">
               <div>
                   <label className="text-xs text-slate-400 block mb-1">Current Steps/mm ($100-102)</label>
                   <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={currentSteps} onChange={e => setCurrentSteps(parseFloat(e.target.value))} />
               </div>
               <div className="flex gap-4">
                   <div className="flex-1">
                       <label className="text-xs text-slate-400 block mb-1">Commanded (mm)</label>
                       <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={commandedDist} onChange={e => setCommandedDist(parseFloat(e.target.value))} />
                   </div>
                   <div className="flex-1">
                       <label className="text-xs text-slate-400 block mb-1">Actual (mm)</label>
                       <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={actualDist} onChange={e => setActualDist(parseFloat(e.target.value))} />
                   </div>
               </div>
               
               <div className="bg-sky-900/20 border border-sky-900/50 p-4 rounded text-center">
                   <div className="text-xs text-slate-400 mb-1">New Steps/mm Value</div>
                   <div className="text-2xl font-mono text-sky-400 font-bold">{newSteps.toFixed(3)}</div>
               </div>
           </div>
       </div>
    </div>
  );
};

export default CalibrationHelper;
