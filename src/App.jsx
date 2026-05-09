import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  Calendar, Download, PieChart, Users, PhoneOff, PhoneForwarded,
  CheckCircle, XCircle, PauseCircle, ClipboardList, MessageCircle,
  Plus, Trash2, Check, Cloud, CloudOff, Loader, Copy
} from 'lucide-react';

// --- קומפוננטה לבחירה עם אפשרות מלל חופשי ---
const StatusSelectWithText = ({ value, onChange, options, placeholder }) => {
  const isCustom = Boolean(value && !options.includes(value));
  const [showCustom, setShowCustom] = useState(isCustom);

  return (
    <div className="flex flex-col gap-1 flex-1">
      <select
        value={showCustom ? '__other__' : (value || '')}
        onChange={e => {
          if (e.target.value === '__other__') {
            setShowCustom(true);
            onChange('');
          } else {
            setShowCustom(false);
            onChange(e.target.value);
          }
        }}
        className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white"
      >
        <option value="" disabled>{placeholder || 'בחר סטטוס...'}</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        <option value="__other__">✏️ כתוב בעצמך...</option>
      </select>
      {showCustom && (
        <input
          type="text"
          placeholder="כתוב כאן..."
          value={value}
          onChange={e => onChange(e.target.value)}
          className="border rounded p-1.5 text-sm w-full"
          autoFocus
        />
      )}
    </div>
  );
};

// --- נתוני דמו התחלתיים ---
const getEmptyDayData = () => ({
  afula: { newLeads: [], noAnswer: [], followUp: [], intros: [], memberships: [], cancellations: [], freezes: [] },
  migdalHaemek: { newLeads: [], noAnswer: [], followUp: [], intros: [], memberships: [], cancellations: [], freezes: [] },
  global: { other: [], tasks: [] }
});

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('data');
  const [activeBranch, setActiveBranch] = useState('afula');
  const [appData, setAppData] = useState({ [new Date().toISOString().split('T')[0]]: getEmptyDayData() });
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error'
  const [copiedBranch, setCopiedBranch] = useState(null);
  const skipSaveRef = useRef(false);
  const saveTimerRef = useRef(null);

  // --- טעינת נתונים מ-Firestore כשמשנים תאריך ---
  useEffect(() => {
    const loadData = async () => {
      skipSaveRef.current = true;
      setSaveStatus('saving');
      try {
        const snap = await getDoc(doc(db, 'reports', currentDate));
        if (snap.exists()) {
          setAppData(prev => ({ ...prev, [currentDate]: snap.data() }));
        } else {
          // יום חדש — אתחול ריק
          setAppData(prev => {
            if (!prev[currentDate]) {
              return { ...prev, [currentDate]: getEmptyDayData() };
            }
            return prev;
          });
        }
        setSaveStatus('saved');
      } catch (e) {
        console.error('שגיאת טעינה:', e);
        setSaveStatus('error');
      }
      setTimeout(() => { skipSaveRef.current = false; }, 300);
    };
    loadData();
  }, [currentDate]);

  // --- שמירה אוטומטית ל-Firestore עם debounce ---
  useEffect(() => {
    if (skipSaveRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      try {
        const dayData = appData[currentDate];
        if (dayData) {
          await setDoc(doc(db, 'reports', currentDate), dayData);
          setSaveStatus('saved');
        }
      } catch (e) {
        console.error('שגיאת שמירה:', e);
        setSaveStatus('error');
      }
    }, 1500);
  }, [appData, currentDate]);

  const currentDayData = appData[currentDate] || getEmptyDayData();

  const updateField = (branch, category, id, field, value) => {
    setAppData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const list = branch === 'global'
        ? newData[currentDate].global[category]
        : newData[currentDate][branch][category];
      const item = list.find(i => i.id === id);
      if (item) item[field] = value;
      return newData;
    });
  };

  const addItem = (branch, category, defaultItem) => {
    setAppData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const newItem = { id: Date.now(), ...defaultItem };
      if (branch === 'global') {
        newData[currentDate].global[category].push(newItem);
      } else {
        newData[currentDate][branch][category].push(newItem);
      }
      return newData;
    });
  };

  const removeItem = (branch, category, id) => {
    setAppData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      if (branch === 'global') {
        newData[currentDate].global[category] = newData[currentDate].global[category].filter(i => i.id !== id);
      } else {
        newData[currentDate][branch][category] = newData[currentDate][branch][category].filter(i => i.id !== id);
      }
      return newData;
    });
  };

  const generateWhatsAppText = (branchKey) => {
    const bData = currentDayData[branchKey];
    const branchName = branchKey === 'afula' ? 'עפולה' : 'מגדל העמק';
    const dateFormatted = new Date(currentDate).toLocaleDateString('he-IL');

    let text = `📊 *סיכום יומי - סניף ${branchName} | ${dateFormatted}*\n`;
    text += `${'─'.repeat(30)}\n\n`;

    if (bData.newLeads.length > 0) {
      text += `📞 *לידים חדשים שדיברו (${bData.newLeads.length}):*\n`;
      bData.newLeads.forEach(l => {
        text += `• ${l.name || 'ללא שם'}`;
        if (l.status) text += ` - ${l.status}`;
        text += '\n';
      });
      text += '\n';
    }

    if (bData.noAnswer.length > 0) {
      text += `📵 *לא ענו - לשלוח הודעה (${bData.noAnswer.length}):*\n`;
      bData.noAnswer.forEach(l => {
        text += `• ${l.name || 'ללא שם'} - לא ענתה\n`;
      });
      text += '\n';
    }

    if (bData.followUp.length > 0) {
      text += `🔄 *Follow Up - שיחות המשך (${bData.followUp.length}):*\n`;
      bData.followUp.forEach(l => {
        text += `• ${l.name || 'ללא שם'}`;
        if (l.status) text += ` - ${l.status}`;
        text += '\n';
      });
      text += '\n';
    }

    if (bData.intros.length > 0) {
      text += `✅ *אימוני היכרות שנקבעו (${bData.intros.length}):*\n`;
      bData.intros.forEach(i => {
        text += `• ${i.name || 'ללא שם'}`;
        if (i.date) text += ` | ${i.date}`;
        if (i.type) text += ` | ${i.type}`;
        if (i.trainer) text += ` | מאמנת: ${i.trainer}`;
        text += '\n';
      });
      text += '\n';
    }

    if (bData.memberships.length > 0) {
      text += `🎉 *מנויים חדשים (${bData.memberships.length}):*\n`;
      bData.memberships.forEach(m => {
        text += `• ${m.name || 'ללא שם'}\n`;
      });
      text += '\n';
    }

    if (bData.cancellations.length > 0) {
      text += `❌ *בקשות ביטול (${bData.cancellations.length}):*\n`;
      bData.cancellations.forEach(c => {
        text += `• ${c.name || 'ללא שם'}`;
        if (c.reason) text += ` - ${c.reason}`;
        text += '\n';
      });
      text += '\n';
    }

    if (bData.freezes.length > 0) {
      text += `⏸️ *הקפאות (${bData.freezes.length}):*\n`;
      bData.freezes.forEach(f => {
        text += `• ${f.name || 'ללא שם'}`;
        if (f.reason) text += ` - ${f.reason}`;
        text += '\n';
      });
      text += '\n';
    }

    const tasks = currentDayData.global.tasks;
    if (tasks.length > 0) {
      text += `📋 *משימות לטיפול - גיא ויסמין (${tasks.length}):*\n`;
      tasks.forEach(t => {
        text += `• ${t.name || 'ללא שם'}`;
        if (t.desc) text += ` - ${t.desc}`;
        text += '\n';
      });
      text += '\n';
    }

    const other = currentDayData.global.other;
    if (other.length > 0) {
      text += `💬 *הערות / בקשות מיוחדות:*\n`;
      other.forEach(o => {
        if (o.text) text += `• ${o.text}\n`;
      });
      text += '\n';
    }

    return text.trim();
  };

  const copyToWhatsApp = async (branchKey) => {
    const text = generateWhatsAppText(branchKey);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBranch(branchKey);
      setTimeout(() => setCopiedBranch(null), 2500);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedBranch(branchKey);
      setTimeout(() => setCopiedBranch(null), 2500);
    }
  };

  const exportToCSV = () => {
    const data = currentDayData;
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += `דוח יומי - סטודיו, תאריך: ${currentDate}\n\n`;

    const addSection = (title, branchData, category, mapFn) => {
      if (branchData[category]?.length > 0) {
        csvContent += `${title}\n`;
        branchData[category].forEach(item => { csvContent += mapFn(item) + "\n"; });
        csvContent += "\n";
      }
    };

    ['afula', 'migdalHaemek'].forEach(branch => {
      const branchName = branch === 'afula' ? 'עפולה' : 'מגדל העמק';
      csvContent += `--- סניף ${branchName} ---\n`;
      addSection("לידים חדשים (דיברו)", data[branch], 'newLeads', i => `${i.name},${i.status || ''}`);
      addSection("לידים חדשים (לא ענו)", data[branch], 'noAnswer', i => `${i.name}`);
      addSection("Follow Up", data[branch], 'followUp', i => `${i.name},${i.status || ''}`);
      addSection("המרות לאימוני היכרות", data[branch], 'intros', i => `${i.name},${i.date || ''},${i.type || ''},${i.trainer || ''}`);
      addSection("המרות למנויים", data[branch], 'memberships', i => `${i.name}`);
      addSection("בקשות ביטול", data[branch], 'cancellations', i => `${i.name},${i.reason || ''}`);
      addSection("הקפאות", data[branch], 'freezes', i => `${i.name},${i.reason || ''}`);
    });

    csvContent += `--- כללי ומשימות ---\n`;
    addSection("בקשות מיוחדות / אחר", data.global, 'other', i => `${i.text}`);
    addSection("משימות גיא ויסמין", data.global, 'tasks', i => `${i.name},${i.desc || ''}`);

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `daily_report_${currentDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SaveIndicator = () => {
    if (saveStatus === 'saving') return (
      <div className="flex items-center gap-1 text-yellow-300 text-xs">
        <Loader className="w-3 h-3 animate-spin" /> שומר...
      </div>
    );
    if (saveStatus === 'error') return (
      <div className="flex items-center gap-1 text-red-400 text-xs">
        <CloudOff className="w-3 h-3" /> שגיאת שמירה
      </div>
    );
    return (
      <div className="flex items-center gap-1 text-green-400 text-xs">
        <Cloud className="w-3 h-3" /> נשמר בענן
      </div>
    );
  };

  const SectionHeader = ({ title, icon: Icon, colorClass }) => (
    <div className={`flex items-center gap-2 mb-4 pb-2 border-b-2 ${colorClass}`}>
      <Icon className="w-5 h-5" />
      <h3 className="text-lg font-bold">{title}</h3>
    </div>
  );

  const leadStatuses = ['לדבר מחר', 'רוצה לחשוב על זה', 'להתייעץ עם הבעל', 'צריכה לבדוק משמרות', 'סיבה רפואית', 'לא רלוונטי'];
  const cancelReasons = ['מצב כלכלי', 'מעבר לחדר כושר', 'חוסר מוטיבציה', 'סיבה רפואית', 'מעבר דירה', 'חוסר זמן'];
  const workoutTypes = ['פאוור', 'פילאטיס', 'עיצוב וחיטוב', 'אימון אישי', 'קנגו'];
  const trainersList = ['יסמין', 'לירון', 'שירן', 'אחר'];

  return (
    <div className="min-h-screen bg-gray-50 text-right" dir="rtl">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className="text-blue-400">Boost</span> CRM
            </h1>
            <p className="text-slate-400 text-sm">ניהול דוחות יומי - גיא ויסמין</p>
          </div>
          <div className="flex items-center gap-4">
            <SaveIndicator />
            <div className="flex items-center bg-slate-800 rounded-lg p-1">
              <Calendar className="w-5 h-5 text-slate-400 mx-2" />
              <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="bg-transparent text-white border-none focus:ring-0 cursor-pointer"
              />
            </div>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">ייצוא לאקסל</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Tabs */}
        <div className="flex space-x-1 space-x-reverse bg-gray-200 p-1 rounded-xl mb-6">
          <button
            onClick={() => setActiveTab('data')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg flex justify-center items-center gap-2 transition-all ${activeTab === 'data' ? 'bg-white text-blue-700 shadow' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <ClipboardList className="w-5 h-5" /> הזנת נתונים
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg flex justify-center items-center gap-2 transition-all ${activeTab === 'summary' ? 'bg-white text-blue-700 shadow' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <PieChart className="w-5 h-5" /> סיכום יומי ויזואלי
          </button>
        </div>

        {activeTab === 'data' && (
          <div className="space-y-6">
            {/* Branch Selector */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <button
                  type="button"
                  onClick={() => setActiveBranch('afula')}
                  className={`px-8 py-3 text-sm font-bold border border-gray-200 rounded-r-lg ${activeBranch === 'afula' ? 'bg-blue-600 text-white' : 'bg-white text-gray-900 hover:bg-gray-100'}`}
                >
                  סניף עפולה
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBranch('migdalHaemek')}
                  className={`px-8 py-3 text-sm font-bold border border-l-0 border-gray-200 rounded-l-lg ${activeBranch === 'migdalHaemek' ? 'bg-blue-600 text-white' : 'bg-white text-gray-900 hover:bg-gray-100'}`}
                >
                  סניף מגדל העמק
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* עמודת לידים */}
              <div className="space-y-6">
                {/* לידים שדיברו */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                  <SectionHeader title="לידים חדשים (דיברו)" icon={Users} colorClass="border-blue-200 text-blue-700" />
                  <div className="space-y-3">
                    {currentDayData[activeBranch].newLeads.map(lead => (
                      <div key={lead.id} className="flex gap-2 items-start">
                        <input type="text" placeholder="שם הליד" value={lead.name}
                          onChange={(e) => updateField(activeBranch, 'newLeads', lead.id, 'name', e.target.value)}
                          className="flex-1 p-2 border rounded" />
                        <StatusSelectWithText value={lead.status} options={leadStatuses}
                          onChange={(val) => updateField(activeBranch, 'newLeads', lead.id, 'status', val)} />
                        <button onClick={() => removeItem(activeBranch, 'newLeads', lead.id)} className="text-red-400 hover:text-red-600 p-2 mt-0.5"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                    <button onClick={() => addItem(activeBranch, 'newLeads', {name: '', status: ''})} className="text-blue-600 text-sm flex items-center gap-1 hover:underline mt-2">
                      <Plus className="w-4 h-4" /> הוסף ליד
                    </button>
                  </div>
                </div>

                {/* לא ענו */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                  <SectionHeader title="לידים חדשים (לא ענו)" icon={PhoneOff} colorClass="border-orange-200 text-orange-700" />
                  <div className="space-y-3">
                    {currentDayData[activeBranch].noAnswer.map(lead => (
                      <div key={lead.id} className="flex gap-2 items-center">
                        <input type="text" placeholder="שם הליד" value={lead.name}
                          onChange={(e) => updateField(activeBranch, 'noAnswer', lead.id, 'name', e.target.value)}
                          className="flex-1 p-2 border rounded" />
                        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded">לא ענתה</span>
                        <button onClick={() => removeItem(activeBranch, 'noAnswer', lead.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                    <button onClick={() => addItem(activeBranch, 'noAnswer', {name: ''})} className="text-blue-600 text-sm flex items-center gap-1 hover:underline mt-2">
                      <Plus className="w-4 h-4" /> הוסף ליד
                    </button>
                  </div>
                </div>

                {/* Follow Up */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                  <SectionHeader title="Follow Up (שיחות המשך)" icon={PhoneForwarded} colorClass="border-purple-200 text-purple-700" />
                  <div className="space-y-3">
                    {currentDayData[activeBranch].followUp.map(lead => (
                      <div key={lead.id} className="flex flex-col sm:flex-row gap-2">
                        <input type="text" placeholder="שם הליד מיום קודם" value={lead.name}
                          onChange={(e) => updateField(activeBranch, 'followUp', lead.id, 'name', e.target.value)}
                          className="flex-1 p-2 border rounded" />
                        <div className="flex gap-2 items-start">
                          <StatusSelectWithText value={lead.status} options={leadStatuses}
                            onChange={(val) => updateField(activeBranch, 'followUp', lead.id, 'status', val)} />
                          <button onClick={() => removeItem(activeBranch, 'followUp', lead.id)} className="text-red-400 hover:text-red-600 p-2 mt-0.5"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => addItem(activeBranch, 'followUp', {name: '', status: ''})} className="text-blue-600 text-sm flex items-center gap-1 hover:underline mt-2">
                      <Plus className="w-4 h-4" /> הוסף ל-Follow Up
                    </button>
                  </div>
                </div>
              </div>

              {/* עמודת המרות וביטולים */}
              <div className="space-y-6">
                {/* אימוני היכרות */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-green-100">
                  <SectionHeader title="המרות לאימוני היכרות" icon={CheckCircle} colorClass="border-green-200 text-green-700" />
                  <div className="space-y-4">
                    {currentDayData[activeBranch].intros.map(intro => (
                      <div key={intro.id} className="bg-green-50 p-3 rounded-lg border border-green-100 relative">
                        <button onClick={() => removeItem(activeBranch, 'intros', intro.id)} className="absolute top-2 left-2 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                        <div className="grid grid-cols-2 gap-2 mb-2 pr-6">
                          <input type="text" placeholder="שם הלקוחה" value={intro.name}
                            onChange={(e) => updateField(activeBranch, 'intros', intro.id, 'name', e.target.value)}
                            className="p-1.5 border rounded text-sm w-full font-bold" />
                          <input type="text" placeholder="תאריך אימון (למשל 25/04)" value={intro.date}
                            onChange={(e) => updateField(activeBranch, 'intros', intro.id, 'date', e.target.value)}
                            className="p-1.5 border rounded text-sm w-full" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 pr-6">
                          <StatusSelectWithText value={intro.type} options={workoutTypes} placeholder="סוג אימון"
                            onChange={(val) => updateField(activeBranch, 'intros', intro.id, 'type', val)} />
                          <StatusSelectWithText value={intro.trainer} options={trainersList} placeholder="מאמנת"
                            onChange={(val) => updateField(activeBranch, 'intros', intro.id, 'trainer', val)} />
                        </div>
                        <div className="absolute top-3 right-3 text-green-600">
                          <CheckCircle className="w-5 h-5 fill-green-100" />
                        </div>
                      </div>
                    ))}
                    <button onClick={() => addItem(activeBranch, 'intros', {name: '', date: '', type: '', trainer: '', done: true})} className="text-blue-600 text-sm flex items-center gap-1 hover:underline">
                      <Plus className="w-4 h-4" /> תיאום אימון היכרות
                    </button>
                  </div>
                </div>

                {/* מנויים חדשים */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-emerald-100">
                  <SectionHeader title="המרות למנויים!" icon={Users} colorClass="border-emerald-200 text-emerald-800" />
                  <div className="space-y-3">
                    {currentDayData[activeBranch].memberships.map(member => (
                      <div key={member.id} className="flex gap-2 items-center bg-white p-2 rounded shadow-sm border border-emerald-100">
                        <div className="bg-emerald-100 p-1 rounded-full"><Check className="w-4 h-4 text-emerald-600"/></div>
                        <input type="text" placeholder="שם המנויה החדשה" value={member.name}
                          onChange={(e) => updateField(activeBranch, 'memberships', member.id, 'name', e.target.value)}
                          className="flex-1 p-1 border-none focus:ring-0 text-emerald-900 font-medium bg-transparent" />
                        <button onClick={() => removeItem(activeBranch, 'memberships', member.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                    <button onClick={() => addItem(activeBranch, 'memberships', {name: ''})} className="text-emerald-700 text-sm flex items-center gap-1 hover:underline mt-2 font-bold">
                      <Plus className="w-4 h-4" /> הוסף מנויה חדשה
                    </button>
                  </div>
                </div>

                {/* ביטולים והקפאות */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-red-100">
                  <SectionHeader title="בקשות ביטול והקפאות" icon={XCircle} colorClass="border-red-200 text-red-700" />
                  <div className="mb-4">
                    <h4 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-1"><XCircle className="w-3 h-3"/> ביטולים</h4>
                    <div className="space-y-2">
                      {currentDayData[activeBranch].cancellations.map(item => (
                        <div key={item.id} className="flex flex-col sm:flex-row gap-2">
                          <input type="text" placeholder="שם המתאמנת" value={item.name}
                            onChange={(e) => updateField(activeBranch, 'cancellations', item.id, 'name', e.target.value)}
                            className="flex-1 p-2 border rounded bg-red-50" />
                          <div className="flex gap-2 items-start">
                            <StatusSelectWithText value={item.reason} options={cancelReasons} placeholder="סיבת עזיבה"
                              onChange={(val) => updateField(activeBranch, 'cancellations', item.id, 'reason', val)} />
                            <button onClick={() => removeItem(activeBranch, 'cancellations', item.id)} className="text-red-400 p-2 mt-0.5"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => addItem(activeBranch, 'cancellations', {name: '', reason: ''})} className="text-red-600 text-sm flex items-center gap-1 hover:underline">
                        <Plus className="w-4 h-4" /> הוסף בקשת ביטול
                      </button>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-1"><PauseCircle className="w-3 h-3"/> הקפאות</h4>
                    <div className="space-y-2">
                      {currentDayData[activeBranch].freezes.map(item => (
                        <div key={item.id} className="flex flex-col sm:flex-row gap-2">
                          <input type="text" placeholder="שם המתאמנת" value={item.name}
                            onChange={(e) => updateField(activeBranch, 'freezes', item.id, 'name', e.target.value)}
                            className="flex-1 p-2 border rounded bg-yellow-50" />
                          <div className="flex gap-2 flex-1">
                            <input type="text" placeholder="סיבה (חופשה/רפואי)" value={item.reason}
                              onChange={(e) => updateField(activeBranch, 'freezes', item.id, 'reason', e.target.value)}
                              className="flex-1 p-2 border rounded" />
                            <button onClick={() => removeItem(activeBranch, 'freezes', item.id)} className="text-red-400 p-2"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => addItem(activeBranch, 'freezes', {name: '', reason: ''})} className="text-yellow-600 text-sm flex items-center gap-1 hover:underline">
                        <Plus className="w-4 h-4" /> הוסף בקשת הקפאה
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* אזור כללי */}
            <div className="mt-8 border-t-2 border-gray-200 pt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800 text-white p-5 rounded-xl shadow-lg">
                <SectionHeader title="אחר / בקשות מיוחדות" icon={MessageCircle} colorClass="border-slate-600 text-white" />
                <p className="text-xs text-slate-300 mb-3">שינויי לו"ז, ביקוש לציוד, הערות כלליות...</p>
                <div className="space-y-3">
                  {currentDayData.global.other.map(item => (
                    <div key={item.id} className="flex gap-2">
                      <textarea rows="2" placeholder="פירוט הבקשה..." value={item.text}
                        onChange={(e) => updateField('global', 'other', item.id, 'text', e.target.value)}
                        className="flex-1 p-2 rounded bg-slate-700 border border-slate-600 text-white focus:ring-blue-500" />
                      <button onClick={() => removeItem('global', 'other', item.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-5 h-5"/></button>
                    </div>
                  ))}
                  <button onClick={() => addItem('global', 'other', {text: ''})} className="text-blue-300 text-sm flex items-center gap-1 hover:underline mt-2">
                    <Plus className="w-4 h-4" /> הוסף הערה
                  </button>
                </div>
              </div>

              <div className="bg-blue-900 text-white p-5 rounded-xl shadow-lg">
                <SectionHeader title="משימות לטיפול - גיא ויסמין" icon={ClipboardList} colorClass="border-blue-700 text-white" />
                <p className="text-xs text-blue-300 mb-3">שיחות ייעוץ, תזונה, שימור לפני עזיבה...</p>
                <div className="space-y-3">
                  {currentDayData.global.tasks.map(task => (
                    <div key={task.id} className="flex flex-col gap-2 bg-blue-800 p-3 rounded">
                      <div className="flex justify-between items-center">
                        <input type="text" placeholder="שם המתאמנת / הלקוחה" value={task.name}
                          onChange={(e) => updateField('global', 'tasks', task.id, 'name', e.target.value)}
                          className="p-1 rounded bg-blue-700 border-none text-white w-2/3" />
                        <button onClick={() => removeItem('global', 'tasks', task.id)} className="text-red-300 hover:text-red-200"><Trash2 className="w-4 h-4"/></button>
                      </div>
                      <input type="text" placeholder="מה צריך לעשות?" value={task.desc}
                        onChange={(e) => updateField('global', 'tasks', task.id, 'desc', e.target.value)}
                        className="p-2 rounded bg-blue-700/50 border border-blue-600 text-white text-sm" />
                    </div>
                  ))}
                  <button onClick={() => addItem('global', 'tasks', {name: '', desc: ''})} className="text-blue-300 text-sm flex items-center gap-1 hover:underline mt-2 font-bold">
                    <Plus className="w-4 h-4" /> הוסף משימה לטיפול
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* סיכום יומי */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center mb-8">סיכום נתונים ליום {currentDate}</h2>

            {['afula', 'migdalHaemek'].map(branchKey => {
              const bData = currentDayData[branchKey];
              const branchName = branchKey === 'afula' ? 'עפולה' : 'מגדל העמק';
              const totalLeads = bData.newLeads.length + bData.noAnswer.length + bData.followUp.length;
              const answeredLeads = bData.newLeads.length + bData.followUp.length;

              return (
                <div key={branchKey} className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 mb-8">
                  <div className="flex items-center justify-between mb-6 pb-2 border-b">
                    <h3 className="text-xl font-bold text-blue-900">נתוני סניף {branchName}</h3>
                    <button
                      onClick={() => copyToWhatsApp(branchKey)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${copiedBranch === branchKey ? 'bg-green-500 text-white' : 'bg-green-100 hover:bg-green-200 text-green-800'}`}
                    >
                      {copiedBranch === branchKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedBranch === branchKey ? 'הועתק!' : 'העתק לוואטסאפ'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                      <div className="text-3xl font-bold text-blue-600">{totalLeads}</div>
                      <div className="text-sm text-gray-600 font-medium">סה"כ לידים טופלו</div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center">
                      <div className="text-3xl font-bold text-orange-600">{bData.noAnswer.length}</div>
                      <div className="text-sm text-gray-600 font-medium">לא ענו</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                      <div className="text-3xl font-bold text-green-600">{bData.intros.length}</div>
                      <div className="text-sm text-gray-600 font-medium">אימוני היכרות שנקבעו</div>
                    </div>
                    <div className="bg-emerald-100 p-4 rounded-xl border border-emerald-200 text-center shadow-sm">
                      <div className="text-3xl font-bold text-emerald-700">{bData.memberships.length}</div>
                      <div className="text-sm text-emerald-800 font-bold">מנויים חדשים!</div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-6 flex flex-col md:flex-row items-center justify-center gap-8">
                    <div className="flex-1 max-w-sm">
                      <h4 className="text-center font-bold mb-4 text-gray-700">התפלגות טיפול בלידים</h4>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>דיברו היום (חדש+Follow Up)</span>
                            <span className="font-bold">{answeredLeads}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: totalLeads > 0 ? `${(answeredLeads/totalLeads)*100}%` : '0%' }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>לא ענו</span>
                            <span className="font-bold">{bData.noAnswer.length}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: totalLeads > 0 ? `${(bData.noAnswer.length/totalLeads)*100}%` : '0%' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:block w-px h-32 bg-gray-200"></div>

                    <div className="flex-1 max-w-sm text-right">
                      <h4 className="text-center md:text-right font-bold mb-4 text-gray-700">פעולות שימור</h4>
                      <ul className="space-y-2 text-sm">
                        <li className="flex justify-between items-center p-2 bg-red-50 text-red-700 rounded">
                          <span>בקשות ביטול למעקב:</span>
                          <span className="font-bold text-lg">{bData.cancellations.length}</span>
                        </li>
                        <li className="flex justify-between items-center p-2 bg-yellow-50 text-yellow-700 rounded">
                          <span>בקשות הקפאה:</span>
                          <span className="font-bold text-lg">{bData.freezes.length}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
