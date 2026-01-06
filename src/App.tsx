import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, Pause, RotateCcw, Plus, Minus,
  Volume2, VolumeX, BookOpen,
  TrendingUp, Check, X, Brain,
  Lock, BarChart2, CheckCircle,
  NotebookPen, Layers, Trash2
} from 'lucide-react';

// --- CONSTANTS & TYPES ---
const SRS_INTERVALS = { 0: 1, 1: 2, 2: 7, 3: 30 };

const HIFZ_METHODS = [
  { id: '7x', title: '7x Takror', desc: 'Har bir oyatni 7 marta o\'qing, so\'ng keyingisi bilan ulang.' },
  { id: '10-5-3', title: '10-5-3 Usuli', desc: '10 marta o\'qish, 5 marta yoddan, 3 marta tekshirish.' },
  { id: 'linking', title: 'Satr Ulash', desc: 'Har bir satrni avvalgisi bilan bog\'lab, zanjir hosil qiling.' },
  { id: 'shadowing', title: 'Audio Soya', desc: 'Qorini eshitib, 1 soniya kechikish bilan qaytaring.' }
];

const METHOD_GUIDANCE = {
  '7x': ["Yetti marta o'qidingizmi? Endi ko'zni yumib ko'ring.", "Keyingi oyatga o'tishdan oldin avvalgisini qo'shing.", "Takrorlash - hifzning onasidir."],
  '10-5-3': ["10 marta mushafga qarab, diqqat bilan o'qing.", "Endi 5 marta yoddan urinib ko'ring.", "3 marta xatolarni tekshirib, to'g'rilang."],
  'linking': ["Oxirgi so'zni keyingi oyat boshi bilan bog'lang.", "Zanjir uzilmasligi kerak.", "Satrlar orasidagi ma'no o'tishiga e'tibor bering."],
  'shadowing': ["Qori ovoziga diqqat qiling, ohangni oling.", "Talaffuzni aynan o'xshatishga harakat qiling.", "Tezlashmang, qori bilan hamnafas bo'ling."]
};

const MOTIVATIONS = {
  hifz: ["Bismillah. Niyatni yangilang, Alloh oson qilsin.", "Hozirgi mashaqqat - ertangi tojingizdir.", "Har bir harf uchun 10 savob yozilmoqda.", "Farishtalar sizni o'rab olishiga izn bering."],
  murojaat: ["Eski darsni mustahkamlash - yangisidan muhimroq.", "Qur'on qalbda tursa - u nurdir.", "Oyat boshlarini mustahkamlang.", "Bugungi murojaat - ertangi xotirjamlik."],
  tilovat: ["Qalb shifosi boshlanmoqda.", "Tajvid qoidalariga e'tibor bering.", "Alloh bilan suhbatlashayotgandek o'qing."]
};

// --- AUDIO ---
let audioCtx = null;
const getAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
};

const playBeep = async (enabled) => {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) { console.error(e); }
};

const vibrateDevice = () => {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
};

// --- APP COMPONENT ---
const App = () => {
  const [mode, setMode] = useState('hifz');
  const [timerDuration, setTimerDuration] = useState(20);
  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [isActive, setIsActive] = useState(false);
  const [endTime, setEndTime] = useState(null);
  const [pausedTimeLeft, setPausedTimeLeft] = useState(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [motivation, setMotivation] = useState("");

  const [hifzMethod, setHifzMethod] = useState('7x');
  const [showJournal, setShowJournal] = useState(false);
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalInput, setJournalInput] = useState({ today: '', difficult: '', intention: '' });

  const lastSecondRef = useRef(null);

  const [srsItems, setSrsItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");

  const [stats, setStats] = useState({ sessions: 0, minutes: 0 });
  const [showHistory, setShowHistory] = useState(false);

  // INIT
  useEffect(() => {
    const savedSrs = localStorage.getItem('hifz_srs');
    if (savedSrs) setSrsItems(JSON.parse(savedSrs));

    const savedSettings = localStorage.getItem('hifz_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSoundEnabled(parsed.soundEnabled ?? true);
      setTimerDuration(parsed.duration ?? 20);
      if (parsed.hifzMethod) setHifzMethod(parsed.hifzMethod);
    }

    const savedJournal = localStorage.getItem('hifz_journal');
    if (savedJournal) setJournalEntries(JSON.parse(savedJournal));

    updateStats();
    setMotivation(MOTIVATIONS.hifz[0]);

    // Session Restore
    const savedSession = localStorage.getItem('hifz_active_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session.isActive && session.endTime) {
          const now = Date.now();
          if (session.endTime > now) {
            setMode(session.mode);
            setTimerDuration(session.duration);
            setEndTime(session.endTime);
            setIsActive(true);
            setHifzMethod(session.hifzMethod || '7x');
            if(session.selectedItemId) setSelectedItemId(session.selectedItemId);
          } else {
            // Finished while closed
            setMode(session.mode);
            setTimerDuration(session.duration);
            setTimeLeft(0);
            setIsActive(false);
            setEndTime(null);
            setShowFinishModal(true);
            setHifzMethod(session.hifzMethod || '7x');
            if(session.selectedItemId) setSelectedItemId(session.selectedItemId);
            localStorage.removeItem('hifz_active_session');
          }
        } else if (!session.isActive && session.pausedTimeLeft) {
          setMode(session.mode);
          setTimerDuration(session.duration);
          setTimeLeft(Math.ceil(session.pausedTimeLeft / 1000));
          setPausedTimeLeft(session.pausedTimeLeft);
          setHifzMethod(session.hifzMethod || '7x');
          if(session.selectedItemId) setSelectedItemId(session.selectedItemId);
        }
      } catch (e) { localStorage.removeItem('hifz_active_session'); }
    }
  }, []);

  useEffect(() => { localStorage.setItem('hifz_srs', JSON.stringify(srsItems)); }, [srsItems]);
  useEffect(() => { localStorage.setItem('hifz_journal', JSON.stringify(journalEntries)); }, [journalEntries]);

  // Persist Session
  useEffect(() => {
    if (isActive && endTime) {
      localStorage.setItem('hifz_active_session', JSON.stringify({ isActive: true, endTime, mode, duration: timerDuration, hifzMethod, selectedItemId }));
    } else if (!isActive && pausedTimeLeft) {
      localStorage.setItem('hifz_active_session', JSON.stringify({ isActive: false, pausedTimeLeft, mode, duration: timerDuration, hifzMethod, selectedItemId }));
    } else {
      localStorage.removeItem('hifz_active_session');
    }
  }, [isActive, endTime, pausedTimeLeft, mode, timerDuration, hifzMethod, selectedItemId]);

  const updateStats = () => {
    const today = new Date().toLocaleDateString('uz-UZ');
    const allStats = JSON.parse(localStorage.getItem('hifz_stats') || '{}');
    const todayStats = allStats[today] || { sessions: 0, minutes: 0 };
    setStats(todayStats);
  };

  // Timer Loop
  useEffect(() => {
    let interval;
    if (isActive && endTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.ceil((endTime - now) / 1000);
        if (remaining <= 0) {
          completeTimer();
        } else {
          setTimeLeft(remaining);
          if (lastSecondRef.current !== remaining) {
            if (remaining % 45 === 0) rotateMotivation();
            lastSecondRef.current = remaining;
          }
        }
      }, 200);
    }
    return () => clearInterval(interval);
  }, [isActive, endTime, mode]);

  const rotateMotivation = () => {
    let pool = MOTIVATIONS[mode] || MOTIVATIONS['hifz'];
    if (mode === 'hifz' && hifzMethod && METHOD_GUIDANCE[hifzMethod]) {
      if (Math.random() > 0.5) pool = METHOD_GUIDANCE[hifzMethod];
    }
    const random = pool[Math.floor(Math.random() * pool.length)];
    setMotivation(random);
  };

  const startTimer = () => {
    const now = Date.now();
    let durationMs = timeLeft * 1000;
    if (pausedTimeLeft !== null && Math.ceil(pausedTimeLeft / 1000) === timeLeft) {
      durationMs = pausedTimeLeft;
    }
    setEndTime(now + durationMs);
    setIsActive(true);
    setPausedTimeLeft(null);
    playBeep(soundEnabled && false);
  };

  const pauseTimer = () => {
    if (endTime) {
      const now = Date.now();
      const remainingMs = Math.max(0, endTime - now);
      setPausedTimeLeft(remainingMs);
      setTimeLeft(Math.ceil(remainingMs / 1000));
    }
    setIsActive(false);
    setEndTime(null);
  };

  const resetTimer = () => {
    setIsActive(false);
    setEndTime(null);
    setTimeLeft(timerDuration * 60);
    setPausedTimeLeft(null);
    lastSecondRef.current = null;
    setSelectedItemId(null);
    localStorage.removeItem('hifz_active_session');
    setMotivation(MOTIVATIONS[mode][0]);
  };

  const completeTimer = () => {
    setIsActive(false);
    setEndTime(null);
    setTimeLeft(0);
    setPausedTimeLeft(null);
    localStorage.removeItem('hifz_active_session');
    playBeep(soundEnabled);
    vibrateDevice();
    setShowFinishModal(true);
  };

  const adjustTime = (delta) => {
    if (isActive) return;
    const newDur = Math.min(180, Math.max(1, timerDuration + delta));
    setTimerDuration(newDur);
    setTimeLeft(newDur * 60);
    setPausedTimeLeft(null);
    localStorage.setItem('hifz_settings', JSON.stringify({ duration: newDur, soundEnabled, hifzMethod }));
  };

  const changeHifzMethod = (methodId) => {
    setHifzMethod(methodId);
    localStorage.setItem('hifz_settings', JSON.stringify({ duration: timerDuration, soundEnabled, hifzMethod: methodId }));
    if (!isActive && mode === 'hifz') {
      const guidance = METHOD_GUIDANCE[methodId];
      if (guidance) setMotivation(guidance[0]);
    }
  };

  const saveJournalEntry = () => {
    if (!journalInput.today.trim()) return;
    const newEntry = { id: Date.now().toString(), date: new Date().toISOString(), ...journalInput };
    setJournalEntries([newEntry, ...journalEntries]);
    setJournalInput({ today: '', difficult: '', intention: '' });
  };
  const deleteJournalEntry = (id) => setJournalEntries(journalEntries.filter(e => e.id !== id));

  const dueItems = useMemo(() => {
    const now = Date.now();
    return srsItems.filter(item => item.nextReview <= now).sort((a, b) => a.nextReview - b.nextReview);
  }, [srsItems]);

  const addItem = () => {
    if (!newItemTitle.trim()) return;
    const newItem = { id: Date.now().toString(), title: newItemTitle, level: 0, nextReview: Date.now(), lastReview: 0 };
    setSrsItems([...srsItems, newItem]);
    setNewItemTitle("");
    setShowAddItem(false);
  };

  const handleFinishRating = (rating) => {
    const today = new Date().toLocaleDateString('uz-UZ');
    const allStats = JSON.parse(localStorage.getItem('hifz_stats') || '{}');
    if (!allStats[today]) allStats[today] = { sessions: 0, minutes: 0, history: [] };
    allStats[today].sessions += 1;
    allStats[today].minutes += timerDuration;
    allStats[today].history.push({ date: new Date().toISOString(), mode, duration: timerDuration, rating });
    localStorage.setItem('hifz_stats', JSON.stringify(allStats));
    updateStats();

    if (selectedItemId) {
      const itemIndex = srsItems.findIndex(i => i.id === selectedItemId);
      if (itemIndex > -1) {
        const item = srsItems[itemIndex];
        let newLevel = item.level;
        if (rating === 'hard') newLevel = 0;
        else if (rating === 'normal') newLevel = Math.min(3, item.level + 1);
        else if (rating === 'easy') newLevel = Math.min(3, item.level + 2);

        const newItems = [...srsItems];
        newItems[itemIndex] = { ...item, level: newLevel, nextReview: Date.now() + (SRS_INTERVALS[newLevel] * 86400000), lastReview: Date.now() };
        setSrsItems(newItems);
      }
    }
    setShowFinishModal(false);
    resetTimer();
  };

  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  const getProgress = () => { const total = timerDuration * 60; return total > 0 ? ((total - timeLeft) / total) * 100 : 0; };

  return (
    <div className="min-h-screen flex flex-col items-center relative text-white font-sans selection:bg-emerald-500/30 overflow-hidden bg-slate-950">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute top-[-20%] left-[-20%] w-[80vw] h-[80vw] bg-emerald-900/30 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[70vw] h-[70vw] bg-blue-900/30 rounded-full blur-[100px]" style={{animationDelay: '2s'}}></div>
      </div>

      <header className="w-full max-w-md p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <BookOpen className="text-emerald-400 w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight">Hifz<span className="text-emerald-400">Coach</span></h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowJournal(true)} className="p-2 rounded-full bg-slate-800/50 border border-white/5 text-slate-400 hover:text-white transition"><NotebookPen size={20} /></button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-full bg-slate-800/50 border border-white/5 text-slate-400 hover:text-white transition">{soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
          <button onClick={() => setShowHistory(true)} className="p-2 rounded-full bg-slate-800/50 border border-white/5 text-slate-400 hover:text-white transition"><BarChart2 size={20} /></button>
        </div>
      </header>

      <div className="w-full max-w-md px-6 z-10 mb-6">
        <div className="flex p-1 bg-slate-800/50 rounded-2xl border border-white/5 backdrop-blur-sm shadow-lg">
          {['hifz', 'murojaat', 'tilovat'].map((m) => (
            <button key={m} onClick={() => { if(!isActive) { setMode(m); resetTimer(); } }} className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all capitalize ${mode === m ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'} ${isActive ? 'opacity-50 cursor-not-allowed' : ''}`}>{m}</button>
          ))}
        </div>
      </div>

      <main className="w-full max-w-md px-6 z-10 flex-1 flex flex-col">
        {mode === 'hifz' && !isActive && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-4">
             <div className="flex items-center gap-2 mb-3 text-slate-300">
               <Layers size={16} className="text-emerald-400" />
               <span className="text-xs font-bold uppercase tracking-wider">Hifz Uslubi</span>
             </div>
             <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6 snap-x">
               {HIFZ_METHODS.map(m => (
                 <button key={m.id} onClick={() => changeHifzMethod(m.id)} className={`flex-shrink-0 w-64 p-4 rounded-xl border text-left transition-all snap-center shadow-sm relative overflow-hidden group ${hifzMethod === m.id ? 'bg-emerald-900/40 border-emerald-500/50 ring-1 ring-emerald-500/30' : 'bg-slate-800/40 border-white/5 hover:bg-slate-800/60'}`}>
                   <div className="flex justify-between items-start mb-2"><span className={`font-bold ${hifzMethod === m.id ? 'text-emerald-400' : 'text-slate-200'}`}>{m.title}</span>{hifzMethod === m.id && <CheckCircle size={16} className="text-emerald-400" />}</div>
                   <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
                 </button>
               ))}
             </div>
          </div>
        )}

        {mode === 'murojaat' && !isActive && timeLeft === timerDuration * 60 && !selectedItemId ? (
          <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold flex items-center gap-2"><Brain className="text-emerald-400 w-5 h-5" />Bugungi Reja</h2><button onClick={() => setShowAddItem(true)} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-emerald-400"><Plus size={18} /></button></div>
            {showAddItem && (<div className="mb-4 p-3 glass-card rounded-xl flex gap-2"><input type="text" value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} placeholder="Sura nomi" className="flex-1 bg-transparent border-b border-slate-600 focus:border-emerald-500 outline-none pb-1 text-sm"/><button onClick={addItem} className="text-emerald-400 font-bold text-sm">SAQLASH</button></div>)}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pb-20">
              {dueItems.length === 0 ? (<div className="text-center py-10 text-slate-500"><CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>Bugun takrorlash uchun hech narsa yo'q.</p></div>) : (dueItems.map(item => (<div key={item.id} className="p-4 glass-card rounded-xl flex justify-between items-center group active:scale-98 transition-transform"><div><h3 className="font-bold text-slate-200">{item.title}</h3><div className="flex items-center gap-2 mt-1"><span className={`text-[10px] px-2 py-0.5 rounded-full ${item.level === 0 ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>Daraja {item.level}</span></div></div><button onClick={() => { setSelectedItemId(item.id); setMode('murojaat'); setTimerDuration(15); setTimeLeft(15*60); setMotivation(`Murojaat: ${item.title}`); }} className="p-3 bg-emerald-600 rounded-lg text-white shadow-lg hover:bg-emerald-500"><Play size={16} fill="currentColor" /></button></div>)))}
              <div className="mt-4"><button onClick={() => { setSelectedItemId(null); setMode('murojaat'); setTimerDuration(20); setTimeLeft(20*60); }} className="w-full py-3 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 transition text-sm font-medium">Erkin Takrorlash</button></div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center relative">
             <div className="relative w-72 h-72 flex items-center justify-center mb-8">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="#1e293b" strokeWidth="3" />
                  <circle cx="60" cy="60" r="54" fill="none" stroke={mode === 'hifz' ? '#10b981' : mode === 'murojaat' ? '#3b82f6' : '#f59e0b'} strokeWidth="4" strokeLinecap="round" strokeDasharray="339.292" strokeDashoffset={339.292 * (1 - getProgress() / 100)} className="transition-[stroke-dashoffset] duration-300 ease-linear drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]"/>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className={`text-xs font-bold uppercase tracking-widest mb-2 px-2 py-1 rounded border ${isActive ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/20' : 'text-slate-500 border-transparent'}`}>{isActive ? (selectedItemId ? 'SRS REVIEW' : 'NIYAT & AMAL') : 'TAYYORMISIZ?'}</span>
                  <div className="text-6xl font-bold tracking-tighter tabular-nums font-sans text-white drop-shadow-xl">{formatTime(timeLeft)}</div>
                  {!isActive && (
                    <div className="flex items-center gap-4 mt-6">
                      <button onClick={() => adjustTime(-1)} disabled={isActive} className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white flex items-center justify-center disabled:opacity-50 transition active:scale-90"><Minus size={18} /></button>
                      <span className="text-xs text-slate-500 font-medium tracking-wider">DAQIQA</span>
                      <button onClick={() => adjustTime(1)} disabled={isActive} className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white flex items-center justify-center disabled:opacity-50 transition active:scale-90"><Plus size={18} /></button>
                    </div>
                  )}
                </div>
             </div>
             <div className="w-full glass-card p-5 rounded-2xl mb-8 relative overflow-hidden text-center min-h-[90px] flex items-center justify-center shadow-lg border-t border-white/10">
               <div className={`absolute top-0 left-0 w-1 h-full ${mode === 'hifz' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
               <p className="text-slate-100 font-serif text-lg leading-relaxed animate-in fade-in px-2">"{motivation}"</p>
             </div>
             <div className="flex items-center gap-6 mb-8">
               <button onClick={resetTimer} className="p-4 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition active:rotate-[-45deg] duration-200"><RotateCcw size={24} /></button>
               <button onClick={isActive ? pauseTimer : startTimer} className={`p-6 rounded-2xl shadow-xl transform transition-all duration-300 active:scale-95 flex items-center gap-3 font-bold text-lg border-2 ${isActive ? 'bg-amber-500/10 border-amber-500 text-amber-500 hover:bg-amber-500/20' : 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/50 hover:bg-emerald-500'}`}>{isActive ? (<>PAUZA <Pause fill="currentColor" /></>) : (<>BOSHLASH <Play fill="currentColor" /></>)}</button>
               <button onClick={() => setIsFocusMode(true)} className="p-4 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 transition"><Lock size={24} /></button>
             </div>
          </div>
        )}
      </main>

      <footer className="w-full py-4 text-center border-t border-white/5 flex flex-col items-center gap-1">
        <p className="text-xs text-slate-600">Bugun: <span className="text-emerald-500 font-bold">{stats.minutes} daq</span> • {stats.sessions} sessiya</p>
        <p className="text-[10px] text-slate-700 font-medium opacity-50 tracking-wide">Made by Muhammad Daler</p>
      </footer>

      {showJournal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold flex items-center gap-2 text-white"><NotebookPen className="text-emerald-400" />Hifz Jurnali</h2><button onClick={() => setShowJournal(false)} className="text-slate-500 hover:text-white bg-slate-800 p-1 rounded-full"><X size={20} /></button></div>
             <div className="bg-slate-800/40 p-4 rounded-xl border border-white/5 mb-6"><h3 className="text-xs font-bold uppercase text-slate-400 mb-3 tracking-wider">Bugungi Qayd</h3><div className="space-y-3"><input type="text" value={journalInput.today} onChange={e => setJournalInput({...journalInput, today: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-emerald-500 outline-none" placeholder="Bugun: (Mulk 1-10)"/><input type="text" value={journalInput.difficult} onChange={e => setJournalInput({...journalInput, difficult: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-emerald-500 outline-none" placeholder="Qiyin joyi..."/><input type="text" value={journalInput.intention} onChange={e => setJournalInput({...journalInput, intention: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-emerald-500 outline-none" placeholder="Niyat..."/><button onClick={saveJournalEntry} disabled={!journalInput.today} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl mt-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition">Saqlash</button></div></div>
             <div className="space-y-3">{journalEntries.length === 0 && <p className="text-sm text-slate-600 text-center py-4">Hali qaydlar yo'q.</p>}{journalEntries.slice(0, 10).map(entry => (<div key={entry.id} className="p-4 bg-slate-800/20 rounded-xl border border-white/5 relative group"><button onClick={() => deleteJournalEntry(entry.id)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button><div className="flex justify-between items-start mb-2"><span className="font-bold text-emerald-400 text-sm">{entry.today}</span><span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{new Date(entry.date).toLocaleDateString()}</span></div>{entry.difficult && <p className="text-xs text-red-300/80 mt-1">• {entry.difficult}</p>}{entry.intention && <p className="text-xs text-blue-300/80 mt-1">• {entry.intention}</p>}</div>))}</div>
          </div>
        </div>
      )}

      {showFinishModal && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 rounded-3xl border border-slate-800 p-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="text-center mb-8"><div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-emerald-500/10"><Check className="w-10 h-10 text-emerald-400" /></div><h2 className="text-3xl font-bold text-white mb-2">Alhamdulillah!</h2><p className="text-slate-400">Sessiya muvaffaqiyatli yakunlandi.</p></div>
            <p className="text-sm text-center text-slate-300 mb-6 font-medium bg-slate-800/50 py-2 rounded-lg">{selectedItemId ? "Eslab qolish darajasi:" : "Mashg'ulot qanday o'tdi?"}</p>
            <div className="grid grid-cols-3 gap-4 mb-8"><button onClick={() => handleFinishRating('hard')} className="py-4 rounded-2xl bg-slate-800 border border-slate-700 hover:border-red-500 hover:bg-red-500/10 transition flex flex-col items-center gap-2 group"><span className="text-2xl group-hover:scale-110 transition-transform">😓</span><span className="text-xs font-bold text-red-400">Qiyin</span></button><button onClick={() => handleFinishRating('normal')} className="py-4 rounded-2xl bg-slate-800 border border-slate-700 hover:border-blue-500 hover:bg-blue-500/10 transition flex flex-col items-center gap-2 group"><span className="text-2xl group-hover:scale-110 transition-transform">🙂</span><span className="text-xs font-bold text-blue-400">Yaxshi</span></button><button onClick={() => handleFinishRating('easy')} className="py-4 rounded-2xl bg-slate-800 border border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/10 transition flex flex-col items-center gap-2 group"><span className="text-2xl group-hover:scale-110 transition-transform">😌</span><span className="text-xs font-bold text-emerald-400">Oson</span></button></div>
            <button onClick={() => { setShowFinishModal(false); resetTimer(); }} className="w-full py-4 bg-white text-slate-900 font-bold rounded-2xl hover:bg-slate-200 shadow-xl transition active:scale-95">Yopish</button>
          </div>
        </div>
      )}

      {isFocusMode && (
        <div className="fixed inset-0 z-[60] bg-slate-950 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <div className="mb-8 p-6 bg-slate-900 rounded-full border border-slate-800"><Lock className="w-16 h-16 text-emerald-500" /></div><h2 className="text-4xl font-serif text-white mb-4">Faqat Qur'on</h2><p className="text-slate-400 mb-12 max-w-xs mx-auto leading-relaxed">Bildirishnomalarni o'chiring. <br/>Alloh barchasini ko'rib, eshitib turibdi.</p><button onClick={() => setIsFocusMode(false)} className="px-10 py-4 rounded-full border border-slate-700 text-slate-300 hover:text-white hover:border-emerald-500 transition hover:bg-slate-900">Ekranni Ochish</button>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-800 p-6 relative shadow-2xl">
            <button onClick={() => setShowHistory(false)} className="absolute top-5 right-5 text-slate-500 hover:text-white"><X size={24} /></button>
            <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3"><TrendingUp size={24} className="text-emerald-400" />Natijalar</h2>
            <div className="grid grid-cols-2 gap-4 mb-6"><div className="bg-slate-800/50 p-6 rounded-2xl text-center border border-white/5"><div className="text-4xl font-bold text-emerald-400 mb-1">{stats.sessions}</div><div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Sessiya</div></div><div className="bg-slate-800/50 p-6 rounded-2xl text-center border border-white/5"><div className="text-4xl font-bold text-blue-400 mb-1">{stats.minutes}</div><div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Daqiqa</div></div></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
