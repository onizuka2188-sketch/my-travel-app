import React, { useState, useEffect } from 'react';
import { Sparkles, MapPin, Lightbulb, Utensils, Send, Loader2, Copy, Check, AlertCircle, Key, Settings, ClipboardList, Compass, Search, Download } from 'lucide-react';

const App = () => {
  const [destination, setDestination] = useState('');
  const [recommendTopic, setRecommendTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [recLoading, setRecLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  const [customApiKey, setCustomApiKey] = useState(() => {
    return localStorage.getItem('gemini_api_key') || '';
  });

  useEffect(() => {
    localStorage.setItem('gemini_api_key', customApiKey);
  }, [customApiKey]);

  const fetchWithRetry = async (url, options, maxRetries = 5) => {
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        if (response.status !== 429 && response.status < 500) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `HTTP Error ${response.status}`);
        }
      } catch (err) {
        if (i === maxRetries - 1) throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
    throw new Error("요청 실패");
  };

  const getCityRecommendations = async () => {
    if (!recommendTopic.trim()) return;
    if (!customApiKey.trim()) {
      setShowSettings(true);
      return;
    }
    setRecLoading(true);
    setRecommendations([]);
    try {
      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${customApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `테마: ${recommendTopic}. 이 테마에 어울리는 여행지 5곳을 JSON 배열로 추천해줘. 예: ["서울", "도쿄"]` }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await response.json();
      setRecommendations(JSON.parse(data.candidates[0].content.parts[0].text));
    } catch (e) { setErrorMessage("추천 로딩 실패"); }
    finally { setRecLoading(false); }
  };

  const generateTitles = async (targetDest = destination) => {
    const finalDest = targetDest || destination;
    if (!finalDest.trim() || !customApiKey.trim()) return;
    setLoading(true);
    setResults(null);
    setErrorMessage('');
    const systemPrompt = `당신은 여행 전문가입니다. { "info": ["제목1"...], "tips": [...], "hotspots": [...] } 형식의 JSON으로만 응답하세요. 각 카테고리별 20개씩 총 60개 작성.`;
    try {
      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${customApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${finalDest} 여행 블로그 제목 60개 추천해줘.` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          tools: [{ "google_search": {} }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await response.json();
      setResults(JSON.parse(data.candidates[0].content.parts[0].text));
    } catch (e) { setErrorMessage("제목 생성 실패"); }
    finally { setLoading(false); }
  };

  const copyToClipboard = (text, index) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const downloadTxt = () => {
    const content = `[${destination} 여행 제목]\n\n필수정보:\n${results.info.join('\n')}\n\n꿀팁:\n${results.tips.join('\n')}\n\n핫플:\n${results.hotspots.join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${destination}_여행제목.txt`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-10 flex flex-col items-center">
          <div className="relative mb-6">
            <div className="p-5 bg-blue-600 rounded-[2rem] shadow-xl shadow-blue-200">
              <Sparkles className="text-white w-10 h-10" />
            </div>
            <button onClick={() => setShowSettings(!showSettings)} className="absolute -right-2 -bottom-2 p-2 bg-white rounded-full shadow-lg border text-slate-400 hover:text-blue-600">
              <Settings size={20} />
            </button>
          </div>
          <h1 className="text-4xl font-black mb-3">여행 제목 메이커 <span className="text-blue-600">Pro</span></h1>
          <p className="text-slate-500 text-lg font-medium">실시간 데이터 기반 60개 프리미엄 제목 생성기</p>
        </header>

        {showSettings && (
          <div className="mb-8 p-6 bg-white rounded-3xl border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-4">
            <h3 className="text-blue-700 font-bold mb-4 flex items-center gap-2"><Key size={18}/> API 키 설정</h3>
            <div className="flex gap-2">
              <input type="password" value={customApiKey} onChange={(e) => setCustomApiKey(e.target.value)} className="flex-1 p-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 outline-none" placeholder="Gemini API Key 입력" />
              <button onClick={() => setShowSettings(false)} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">저장</button>
            </div>
          </div>
        )}

        <div className="mb-8 p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
          <div className="flex items-center gap-2 mb-4 font-bold text-blue-800"><Compass size={20}/> 여행지 추천</div>
          <div className="flex gap-2">
            <input type="text" value={recommendTopic} onChange={(e) => setRecommendTopic(e.target.value)} className="flex-1 p-3 rounded-xl border border-blue-200 outline-none" placeholder="예: 겨울에 가기 좋은 따뜻한 도시" />
            <button onClick={getCityRecommendations} className="px-5 py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2">
              {recLoading ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>} 추천
            </button>
          </div>
          {recommendations.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {recommendations.map((c, i) => (
                <button key={i} onClick={() => { setDestination(c); generateTitles(c); }} className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-blue-700 text-sm font-bold hover:bg-blue-600 hover:text-white transition-all">
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-3 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row gap-2 mb-10 border border-slate-100">
          <div className="flex-1 flex items-center px-4">
            <MapPin className="text-blue-500 w-6 h-6 mr-3" />
            <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && generateTitles()} placeholder="여행지를 입력하세요" className="w-full py-4 text-xl font-bold outline-none" />
          </div>
          <button onClick={() => generateTitles()} disabled={loading || !destination} className="bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-bold hover:bg-blue-600 transition-all flex items-center justify-center gap-3 text-lg">
            {loading ? <Loader2 className="animate-spin" /> : <Send size={22} />} {loading ? "분석 중" : "제목 생성"}
          </button>
        </div>

        {errorMessage && <div className="p-4 bg-red-50 text-red-600 rounded-xl mb-8 flex items-center gap-2"><AlertCircle size={20}/> {errorMessage}</div>}

        {loading && (
          <div className="text-center py-20 animate-pulse">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800">최신 정보를 바탕으로 제목을 짓고 있습니다...</h2>
          </div>
        )}

        {results && !loading && (
          <div className="space-y-12 pb-32 animate-in fade-in slide-in-from-bottom-8">
            <div className="flex justify-center mb-8">
              <button onClick={downloadTxt} className="flex items-center gap-2 px-8 py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl font-bold hover:border-blue-500 hover:text-blue-600 shadow-sm transition-all">
                <Download size={20}/> 전체 결과 파일로 저장 (.txt)
              </button>
            </div>
            <Section title="필수 여행 정보" items={results.info} color="blue" onCopy={copyToClipboard} copiedIndex={copiedIndex} id="info" icon={<MapPin size={24}/>} />
            <Section title="전문가 여행 꿀팁" items={results.tips} color="yellow" onCopy={copyToClipboard} copiedIndex={copiedIndex} id="tips" icon={<Lightbulb size={24}/>} />
            <Section title="맛집 & 핫플레이스" items={results.hotspots} color="orange" onCopy={copyToClipboard} copiedIndex={copiedIndex} id="hot" icon={<Utensils size={24}/>} />
          </div>
        )}
      </div>
    </div>
  );
};

const Section = ({ title, items, color, onCopy, copiedIndex, id, icon }) => {
  const bg = { blue: 'bg-blue-100 text-blue-600', yellow: 'bg-yellow-100 text-yellow-600', orange: 'bg-orange-100 text-orange-600' };
  return (
    <section>
      <div className="flex items-center justify-between mb-6 px-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${bg[color]}`}>{icon}</div>
          <h2 className="text-2xl font-black text-slate-800">{title}</h2>
        </div>
        <button onClick={() => onCopy(items.join('\n'), id)} className="text-sm font-bold text-slate-400 hover:text-blue-600 flex items-center gap-2">
          {copiedIndex === id ? <Check size={18} className="text-green-500"/> : <ClipboardList size={18}/>} 전체 복사
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
        {items.map((item, i) => (
          <div key={i} className="p-5 bg-white border border-slate-100 rounded-2xl flex justify-between items-center group hover:border-blue-400 hover:shadow-xl transition-all">
            <span className="text-slate-700 font-bold leading-relaxed pr-4">{item}</span>
            <button onClick={() => onCopy(item, `${id}-${i}`)} className={`shrink-0 transition-colors ${copiedIndex === `${id}-${i}` ? 'text-green-500' : 'text-slate-200 group-hover:text-blue-500'}`}>
              {copiedIndex === `${id}-${i}` ? <Check size={20}/> : <Copy size={20}/>}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default App;