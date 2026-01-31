import React, { useState, useEffect } from 'react';
import { Sparkles, MapPin, Lightbulb, Utensils, Send, Loader2, Copy, Check, AlertCircle, Settings, ClipboardList, Key, Download, Compass, Search } from 'lucide-react';

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
  
  // API 키를 브라우저에 저장함 (localStorage)
  const [customApiKey, setCustomApiKey] = useState(() => {
    return localStorage.getItem('gemini_api_key') || '';
  });

  useEffect(() => {
    localStorage.setItem('gemini_api_key', customApiKey);
  }, [customApiKey]);

  // 지수 백오프를 적용한 fetch 함수
  const fetchWithRetry = async (url, options, maxRetries = 5) => {
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        if (response.status === 429 || response.status >= 500) {
          // 재시도 대상 에러
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `HTTP Error ${response.status}`);
        }
      } catch (err) {
        if (i === maxRetries - 1) throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
    throw new Error("요청이 실패했습니다. 나중에 다시 시도해주세요.");
  };

  // 여행지 추천 기능
  const getCityRecommendations = async () => {
    if (!recommendTopic.trim()) return;
    if (!customApiKey.trim()) {
      setErrorMessage("상단 톱니바퀴를 눌러 API 키를 먼저 입력해주세요!");
      setShowSettings(true);
      return;
    }

    setRecLoading(true);
    setRecommendations([]);
    setErrorMessage('');

    const systemPrompt = `
      당신은 여행 전문가입니다. 사용자의 테마에 맞춰 가장 적절한 여행 도시 5곳을 추천하세요.
      반드시 다음 구조의 JSON 배열 형식으로만 응답하세요:
      ["도시이름1", "도시이름2", "도시이름3", "도시이름4", "도시이름5"]
      예시: ["일본 오사카", "베트남 다낭", "프랑스 파리"]
    `;

    try {
      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${customApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `테마: ${recommendTopic}. 이 테마에 어울리는 구체적인 여행지 5곳을 추천해줘.` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await response.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      setRecommendations(JSON.parse(textResponse));
    } catch (error) {
      setErrorMessage("여행지 추천 중 오류가 발생했습니다. API 키를 확인해주세요.");
    } finally {
      setRecLoading(false);
    }
  };

  // 블로그 제목 생성 기능
  const generateTitles = async (targetDestination = destination) => {
    const finalDest = targetDestination || destination;
    if (!finalDest.trim()) return;
    if (!customApiKey.trim()) {
      setErrorMessage("상단 톱니바퀴를 눌러 API 키를 먼저 입력해주세요!");
      setShowSettings(true);
      return;
    }

    setLoading(true);
    setResults(null);
    setErrorMessage('');

    const systemPrompt = `
      전문 여행 블로거로서 다음 구조의 JSON으로만 응답하세요:
      {
        "info": ["제목1", ..., "제목20"],
        "tips": ["제목1", ..., "제목20"],
        "hotspots": ["제목1", ..., "제목20"]
      }
      조건: 각 카테고리별 20개씩 총 60개 생성. 한국어로 SEO에 최적화된 제목. 
      사용자가 입력한 여행지의 현재 트렌드와 구체적인 장소명을 포함하여 매력적으로 작성하세요.
    `;

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
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      setResults(JSON.parse(textResponse));
    } catch (error) {
      setErrorMessage("오류가 발생했습니다. API 키를 다시 확인하거나 잠시 후 시도해주세요.");
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
    
    content += `■ 필수 여행 정보 (20개)\n`;
    results.info.forEach((t, i) => content += `${i + 1}. ${t}\n`);
    
    content += `\n■ 전문가 여행 꿀팁 (20개)\n`;
    results.tips.forEach((t, i) => content += `${i + 1}. ${t}\n`);
    
    content += `\n■ 맛집 & 핫플레이스 (20개)\n`;
    results.hotspots.forEach((t, i) => content += `${i + 1}. ${t}\n`);
    
    const element = document.createElement("a");
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${destination}_여행_제목_아이디어.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-10 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col items-center mb-12 text-center">
          <div className="relative mb-6">
            <div className="p-5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] shadow-2xl shadow-blue-200">
              <Sparkles className="text-white w-12 h-12" />
            </div>
            <button 
              onClick={() => setShowSettings(!showSettings)} 
              className={`absolute -right-3 -bottom-3 p-3 rounded-full shadow-xl border-4 border-white transition-all ${showSettings ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 hover:text-blue-600 active:scale-90'}`}
              title="설정"
            >
              <Settings className="w-6 h-6" />
            </button>
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">여행 제목 메이커 <span className="text-blue-600">Pro</span></h1>
          <p className="text-slate-500 text-lg max-w-2xl text-balance font-medium">
            AI와 함께 완벽한 여행지와 매력적인 블로그 제목을 찾아보세요.
          </p>
        </header>

        {showSettings && (
          <div className="mb-10 p-8 bg-white rounded-[2rem] border border-blue-100 shadow-xl shadow-blue-500/5 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3 mb-6 text-blue-700 font-bold text-xl">
              <Key className="w-6 h-6" /> 
              <span>Gemini API 키 설정</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="password" 
                value={customApiKey} 
                onChange={(e) => setCustomApiKey(e.target.value)}
                className="flex-1 px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none transition-all text-lg bg-slate-50"
                placeholder="Gemini API Key를 입력하세요"
              />
              <button 
                onClick={() => setShowSettings(false)} 
                className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                저장 후 닫기
              </button>
            </div>
          </div>
        )}

        {/* City Recommendation Search */}
        <div className="mb-8 p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
          <div className="flex items-center gap-2 mb-4">
            <Compass className="text-blue-600 w-5 h-5" />
            <h3 className="font-bold text-blue-800">어디로 갈지 고민이신가요? (여행지 추천)</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              value={recommendTopic} 
              onChange={(e) => setRecommendTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && getCityRecommendations()}