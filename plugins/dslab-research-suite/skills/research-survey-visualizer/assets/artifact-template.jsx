import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, X, ArrowRight, ArrowDown } from 'lucide-react';

// ============================================
// TEMPLATE: Research Survey Visualizer
// ============================================
// Instructions:
// 1. Replace `researchData` array with actual paper data
// 2. Create custom Architecture component for each paper
// 3. Adjust colors in `color` field to differentiate papers
// 4. Update language (Korean/English) based on user preference
// ============================================

// Example Architecture Component (customize per paper)
const ExampleArchitecture = () => (
  <div className="bg-gray-900 rounded-xl p-4 space-y-3">
    <h4 className="text-blue-400 font-semibold text-center">[Method Name] 아키텍처</h4>
    
    {/* Input Stage */}
    <div className="flex justify-center gap-2">
      <div className="bg-purple-600/30 border border-purple-500 rounded-lg px-3 py-2 text-sm">
        📥 Input A
      </div>
      <div className="bg-blue-600/30 border border-blue-500 rounded-lg px-3 py-2 text-sm">
        📥 Input B
      </div>
    </div>
    
    <div className="flex justify-center"><ArrowDown className="text-gray-500" /></div>

    {/* Processing Stages */}
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="text-center text-yellow-400 text-sm font-medium mb-2">1️⃣ Stage Name</div>
      <div className="text-xs text-gray-400 text-center">Description of what happens</div>
    </div>

    <div className="flex justify-center"><ArrowDown className="text-gray-500" /></div>

    <div className="bg-gray-800 rounded-lg p-3">
      <div className="text-center text-green-400 text-sm font-medium mb-2">2️⃣ Stage Name</div>
      <div className="flex items-center justify-center gap-2 text-xs">
        <div className="bg-red-600/30 rounded px-2 py-1">Before</div>
        <ArrowRight size={14} className="text-green-400" />
        <div className="bg-green-600/30 rounded px-2 py-1">After</div>
      </div>
    </div>

    <div className="flex justify-center"><ArrowDown className="text-gray-500" /></div>

    {/* Output */}
    <div className="bg-gradient-to-r from-blue-600/30 to-cyan-600/30 border border-cyan-500 rounded-lg p-2 text-center">
      <div className="text-sm">📤 Output / Result</div>
    </div>
  </div>
);

// Data Structure Template
const researchData = [
  {
    id: 1,
    title: "Paper Short Name",
    subtitle: "One-line description",
    venue: "VENUE 2025",
    icon: "🔬", // Or use lucide-react icon component
    color: "from-blue-500 to-cyan-500", // Tailwind gradient
    architecture: <ExampleArchitecture />,
    keyInsight: {
      title: "핵심 아이디어",
      content: "Main insight that enables the solution. Explain WHY this works, not just WHAT it does."
    },
    comparison: [
      { 
        name: "Baseline Method 1", 
        issue: "Specific limitation", 
        solution: "How this paper fixes it" 
      },
      { 
        name: "Baseline Method 2", 
        issue: "Different limitation", 
        solution: "Different fix" 
      },
      { 
        name: "Baseline Method 3", 
        issue: "Another problem", 
        solution: "Another solution" 
      },
    ],
    metrics: [
      { label: "Metric 1", value: "+15%", desc: "on benchmark" },
      { label: "Metric 2", value: "2.5x", desc: "speedup" },
      { label: "Metric 3", value: "SOTA", desc: "achieved" },
    ]
  },
  // Add more papers...
];

export default function ResearchSurveyViewer() {
  const [currentPage, setCurrentPage] = useState(0);
  const research = researchData[currentPage];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-3">
      {/* Header */}
      <div className="text-center mb-3">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          [Researcher Name]의 [Year]년 연구
        </h1>
        <p className="text-gray-500 text-xs">[Institution] • 아키텍처 상세 분석</p>
      </div>

      {/* Navigation */}
      <div className="flex justify-center items-center gap-2 mb-3">
        <button 
          onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
          className="p-1.5 rounded-full bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
          disabled={currentPage === 0}
        >
          <ChevronLeft size={18} />
        </button>
        
        <div className="flex gap-1">
          {researchData.map((r, i) => (
            <button
              key={r.id}
              onClick={() => setCurrentPage(i)}
              className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
                i === currentPage 
                  ? `bg-gradient-to-r ${r.color} text-white` 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {r.title}
            </button>
          ))}
        </div>
        
        <button 
          onClick={() => setCurrentPage(p => Math.min(researchData.length - 1, p + 1))}
          className="p-1.5 rounded-full bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
          disabled={currentPage === researchData.length - 1}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Title Card */}
      <div className={`bg-gradient-to-r ${research.color} rounded-xl p-3 mb-3`}>
        <div className="flex items-center gap-3">
          <div className="bg-white/20 rounded-lg p-2 text-2xl">
            {research.icon}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{research.title}</h2>
            <p className="text-white/80 text-sm">{research.subtitle}</p>
          </div>
          <div className="bg-white/20 rounded-full px-2 py-0.5 text-xs">
            {research.venue}
          </div>
        </div>
      </div>

      {/* Main Content - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left: Architecture */}
        <div>
          {research.architecture}
        </div>

        {/* Right: Key Insight + Comparison + Metrics */}
        <div className="space-y-3">
          {/* Key Insight */}
          <div className="bg-gray-800 rounded-xl p-3">
            <h3 className="text-yellow-400 font-semibold text-sm mb-2">
              💡 {research.keyInsight.title}
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              {research.keyInsight.content}
            </p>
          </div>

          {/* Comparison */}
          <div className="bg-gray-800 rounded-xl p-3">
            <h3 className="text-purple-400 font-semibold text-sm mb-2">
              ⚔️ 기존 방법 vs {research.title}
            </h3>
            <div className="space-y-2">
              {research.comparison.map((item, i) => (
                <div key={i} className="bg-gray-900 rounded-lg p-2">
                  <div className="text-white text-xs font-medium">{item.name}</div>
                  <div className="flex items-start gap-2 mt-1">
                    <div className="flex-1">
                      <span className="text-red-400 text-xs flex items-center gap-1">
                        <X size={10} /> {item.issue}
                      </span>
                    </div>
                    <ArrowRight size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-green-400 text-xs flex items-center gap-1">
                        <Check size={10} /> {item.solution}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics */}
          <div className="bg-gray-800 rounded-xl p-3">
            <h3 className="text-green-400 font-semibold text-sm mb-2">📊 성능</h3>
            <div className="grid grid-cols-3 gap-2">
              {research.metrics.map((metric, i) => (
                <div key={i} className="bg-gray-900 rounded-lg p-2 text-center">
                  <div className={`text-lg font-bold bg-gradient-to-r ${research.color} bg-clip-text text-transparent`}>
                    {metric.value}
                  </div>
                  <div className="text-white text-xs font-medium">{metric.label}</div>
                  <div className="text-gray-500 text-xs">{metric.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-3 text-gray-600 text-xs">
        {currentPage + 1} / {researchData.length} • 탭 또는 좌우 버튼으로 이동
      </div>
    </div>
  );
}
