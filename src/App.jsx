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
  
  // API Key Management (Local Storage)
  const [customApiKey, setCustomApiKey] = useState(() => {
    return (localStorage.getItem('gemini_api_key') || '').trim();
  });

  useEffect(() => {
    localStorage.setItem('gemini_api_key', customApiKey.trim());
  }, [customApiKey]);

  /**
   * Exponential Backoff implementation for API calls
   * Retries up to 5 times with increasing delays: 1s, 2s, 4s, 8s, 16s
   */
  const fetchWithRetry = async (url, options, maxRetries = 5) => {
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.error?.message || `Error: ${response.status}`;
        
        // 429 (Too Many Requests) or 5xx errors are retryable
        if (response.status !== 429 && response.status < 500) {
          throw new Error(msg);
        }
      } catch (err) {
        if (i === maxRetries - 1) throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
    throw new Error("요청이 반복적으로 실패했습니다. 네트워크 상태를 확인하세요.");
  };

  // Helper for generating API URL
  const getApiUrl = (model = "gemini-2.5-flash-preview-09-2025") => {
    const key = customApiKey || ""; 
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  };

  // AI City Recommendation
  const getCityRecommendations = async () => {
    if (!recommendTopic.trim()) return;
    setRecLoading(true);
    setRecommendations([]);
    setErrorMessage('');

    const systemPrompt = "당신은 여행 전문가입니다. 사용자의 테마에 맞는 여행 도시 5곳을 한국어로 추천하세요. 반드시 JSON 배열 형식으로만 응답하세요. 예: [\"도시1\", \"도시2\"]";
    const payload = {
      contents: [{ parts: [{ text: `테마: ${recommendTopic}. 이 테마에 어울리는 구체적인 여행지 5곳을 추천해줘.` }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      // Recommendations don't use search tool, so JSON mode is safe here
      generationConfig: { responseMimeType: "application/json" }
    };

    try {
      const response = await fetchWithRetry(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      setRecommendations(JSON.parse(text));
    } catch (e) {
      setErrorMessage(`추천 실패: ${e.message}`);
    } finally {
      setRecLoading(false);
    }
  };

  // 60 Title Generation Logic
  const generateTitles = async (targetDest = destination) => {
    const finalDest = targetDest || destination;
    if (!finalDest.trim()) return;

    setLoading(true);
    setResults(null);
    setErrorMessage('');

    // Strong instructions to ensure JSON output even without explicit JSON mode
    const systemPrompt = `당신은 전문 여행 블로거입니다. 
    반드시 다음 JSON 구조로만 응답하세요. 다른 설명은 생략하세요: 
    { "info": ["제목1", ..., "제목20"], "tips": ["제목1", ..., "제목20"], "hotspots": ["제목1", ..., "제목20"] }. 
    각 카테고리별 정확히 20개씩 총 60개의 제목을 한국어로 SEO에 최적화하여 작성하세요.`;

    const payload = {
      contents: [{ parts: [{ text: `${finalDest} 여행 블로그 포스팅 제목 60개 추천해줘.` }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools: [{ "google_search": {} }],
      // CRITICAL FIX: Removed responseMimeType: "application/json" because it conflicts with "tools"
      generationConfig: { 
        temperature: 0.9
      }
    };

    try {
      const response = await fetchWithRetry(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      // Manual cleanup of markdown code blocks if present
      const cleanJson = text.replace(/```json|```/g, "").trim();
      setResults(JSON.parse(cleanJson));
    } catch (e) {
      setErrorMessage(`제목 생성 실패: ${e.message}`);
    } finally {
      setLoading(false);
    }
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

  const downloadAsText = () => {
    if (!results) return;
    let content = `[ ${destination} 여행 블로그 제목 아이디어 리스트 ]\n\n`;
    content += `■ 필수 여행 정보 (20개)\n${results.info.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n`;
    content += `■ 전문가 여행 꿀팁 (20개)\n${results.tips.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n`;
    content += `■ 맛집 & 핫플레이스 (20개)\n${results.hotspots.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${destination}_여행_제목_60개.txt`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-10 font-sans text-slate-900 selection:bg-blue-100">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="flex flex-col items-center mb-12 text-center">
          <div className="relative mb-6">
            <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] shadow-2xl shadow-blue-200 animate-in zoom-in duration-500">
              <Sparkles className="text-white w-12 h-12" />
            </div>
            <button 
              onClick={() => setShowSettings(!showSettings)} 
              className={`absolute -right-3 -bottom-3 p-3 rounded-full shadow-xl border-4 border-white transition-all hover:rotate-90 ${showSettings ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 hover:text-blue-600 active:scale-90'}`}
            >
              <Settings className="w-6 h-6" />
            </button>
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tighter">
            여행 제목 메이커 <span className="text-blue-600">Pro</span>
          </h1>
          <p className="text-slate-500 text-xl max-w-2xl font-medium text-balance">
            Gemini 2.5 Flash 엔진으로 완성하는 60개의 프리미엄 블로그 제목
          </p>
        </header>

        {/* API Settings */}
        {showSettings && (
          <div className="mb-10 p-8 bg-white rounded-[2rem] border border-blue-100 shadow-xl shadow-blue-500/5 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3 mb-6 text-blue-700 font-bold text-xl">
              <Key className="w-6 h-6" /> 
              <span>API 키 설정</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="password" 
                value={customApiKey} 
                onChange={(e) => setCustomApiKey(e.target.value)}
                className="flex-1 px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none transition-all text-lg bg-slate-50"
                placeholder="Google AI Studio API Key를 입력하세요"
              />
              <button 
                onClick={() => setShowSettings(false)} 
                className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-lg transition-all active:scale-95"
              >
                저장 후 닫기
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-400">비워둘 경우 시스템 기본 API 키를 사용합니다 (환경에 따라 작동하지 않을 수 있음).</p>
          </div>
        )}

        {/* AI Recommendation Search */}
        <div className="mb-8 p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100">
          <div className="flex items-center gap-3 mb-6 text-blue-800 font-bold text-xl">
            <Compass className="w-7 h-7" />
            <h3>어디로 갈지 고민이신가요? (AI 테마 추천)</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              value={recommendTopic} 
              onChange={(e) => setRecommendTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && getCityRecommendations()}
              placeholder="예: 2월에 따뜻하고 물가 싼 동남아 도시" 
              className="flex-1 px-6 py-4 rounded-2xl border-2 border-blue-100 outline-none focus:border-blue-600 bg-white text-lg transition-all"
            />
            <button 
              onClick={getCityRecommendations}
              disabled={recLoading || !recommendTopic}
              className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 shadow-lg active:scale-95"
            >
              {recLoading ? <Loader2 className="animate-spin" /> : <Search size={20} />}
              추천받기
            </button>
          </div>
          
          {recommendations.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
              <span className="text-sm font-black text-blue-700 w-full mb-1 uppercase tracking-tighter">AI Recommended Cities</span>
              {recommendations.map((city, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setDestination(city);
                    generateTitles(city);
                  }}
                  className="px-5 py-3 bg-white border-2 border-blue-100 rounded-xl text-blue-700 font-bold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm active:scale-95"
                >
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Search */}
        <div className="bg-white p-3 rounded-[3.5rem] shadow-2xl shadow-slate-200/50 flex flex-col md:flex-row gap-3 mb-10 border border-slate-50 overflow-hidden">
          <div className="flex-1 flex items-center px-8">
            <MapPin className="text-blue-500 w-8 h-8 mr-4" />
            <input 
              type="text" 
              value={destination} 
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generateTitles()}
              placeholder="여행지 직접 입력 (예: 파리, 오사카)" 
              className="w-full py-6 text-2xl font-black outline-none placeholder:text-slate-300"
            />
          </div>
          <button 
            onClick={() => generateTitles()} 
            disabled={loading || !destination}
            className="bg-slate-900 text-white px-14 py-6 rounded-[3rem] font-black hover:bg-blue-600 transition-all flex items-center justify-center gap-4 text-2xl shadow-xl active:scale-95 disabled:bg-slate-200"
          >
            {loading ? <Loader2 className="animate-spin w-8 h-8" /> : <Send className="w-8 h-8" />} 
            {loading ? "분석 중..." : "제목 생성"}
          </button>
        </div>

        {errorMessage && (
          <div className="p-8 bg-red-50 text-red-600 rounded-[2.5rem] mb-10 flex items-start gap-5 border-2 border-red-100 shadow-sm animate-in shake duration-500">
            <AlertCircle className="shrink-0 w-8 h-8 mt-1" /> 
            <div>
              <p className="font-black text-2xl mb-1">문제가 발생했습니다</p>
              <p className="font-medium text-lg">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-32 flex flex-col items-center">
            <div className="relative w-32 h-32 mb-12">
              <div className="absolute inset-0 border-[12px] border-blue-50 rounded-full"></div>
              <div className="absolute inset-0 border-[12px] border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600 w-12 h-12 animate-pulse" />
            </div>
            <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">전 세계 데이터를 분석 중입니다</h2>
            <p className="text-slate-400 text-2xl font-medium tracking-tight">"{destination}"에 최적화된 블로그 제목 60개를 짓고 있습니다.</p>
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <div className="flex justify-center mb-20">
              <button 
                onClick={downloadAsText}
                className="flex items-center gap-4 px-12 py-6 bg-white border-4 border-slate-100 text-slate-700 rounded-[3rem] font-black text-xl hover:border-blue-500 hover:text-blue-600 hover:shadow-2xl hover:shadow-blue-500/10 transition-all active:scale-95 group"
              >
                <Download className="group-hover:bounce" size={28} />
                전체 결과 파일로 저장 (.txt)
              </button>
            </div>

            <div className="space-y-24 pb-48">
              <Section title="실시간 필수 여행 정보" count={20} items={results.info} color="blue" onCopy={copyToClipboard} copiedIndex={copiedIndex} id="info" icon={<MapPin size={32}/>} />
              <Section title="전문가만 아는 여행 꿀팁" count={20} items={results.tips} color="yellow" onCopy={copyToClipboard} copiedIndex={copiedIndex} id="tips" icon={<Lightbulb size={32}/>} />
              <Section title="맛집 & 인스타 핫플레이스" count={20} items={results.hotspots} color="orange" onCopy={copyToClipboard} copiedIndex={copiedIndex} id="hot" icon={<Utensils size={32}/>} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Section = ({ title, count, items, color, onCopy, copiedIndex, id, icon }) => {
  const bg = { 
    blue: 'bg-blue-100 text-blue-600 shadow-blue-100', 
    yellow: 'bg-yellow-100 text-yellow-600 shadow-yellow-100', 
    orange: 'bg-orange-100 text-orange-600 shadow-orange-100' 
  };
  
  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 px-6 gap-8">
        <div className="flex items-center gap-6 text-left">
          <div className={`p-5 rounded-[2rem] shadow-xl ${bg[color]}`}>{icon}</div>
          <div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tighter">{title}</h2>
            <p className="text-slate-400 font-black mt-1 uppercase tracking-widest text-base">{count} PREMIUM IDEAS</p>
          </div>
        </div>
        <button 
          onClick={() => onCopy(items.join('\n'), id)} 
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-base transition-all border-4 shadow-sm shrink-0 self-start sm:self-center ${copiedIndex === id ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white text-slate-500 border-slate-100 hover:border-blue-400 hover:text-blue-600 active:scale-95'}`}
        >
          {copiedIndex === id ? <Check size={24}/> : <ClipboardList size={24}/>}
          {copiedIndex === id ? "카테고리 전체 복사됨" : "전체 복사하기"}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
        {items.map((item, i) => (
          <div 
            key={i} 
            className="p-8 bg-white border border-slate-100 rounded-[2rem] flex justify-between items-center group hover:border-blue-400 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300"
          >
            <span className="text-slate-800 font-bold text-xl leading-snug pr-8">{item}</span>
            <button 
              onClick={() => onCopy(item, `${id}-${i}`)} 
              className={`p-4 rounded-2xl transition-all shrink-0 ${copiedIndex === `${id}-${i}` ? 'text-green-500 bg-green-100 scale-125' : 'text-slate-100 group-hover:text-blue-600 group-hover:bg-blue-50'}`}
              title="복사하기"
            >
              {copiedIndex === `${id}-${i}` ? <Check size={28}/> : <Copy size={28}/>}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default App;