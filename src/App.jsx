import React, { useState, useRef, useEffect } from 'react';
import { Upload, Music, Volume2, Settings, Send, Loader, Trash2, ChevronDown, ChevronUp, Copy, Download, BarChart3, Plus, Edit2, X } from 'lucide-react';

const VocalCloneAnalyzer = () => {
  const [tab, setTab] = useState('new'); // 'new', 'history', 'tools'
  const [files, setFiles] = useState({
    reference_acapella: null,
    reference_minus: null,
    original_track: null,
    clones: []
  });
  const [bpm, setBpm] = useState(120);
  const [projectName, setProjectName] = useState('Посёлок v1');
  const [timeMarkers, setTimeMarkers] = useState([
    { time: '0:00', section: 'Куплет', voice: '' }
  ]);
  const [cloneNotes, setCloneNotes] = useState({}); // Заметки по клонам
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [showCloneNotes, setShowCloneNotes] = useState({});
  const [pitchCalcMode, setPitchCalcMode] = useState(false);
  const [pitchFrom, setPitchFrom] = useState('C4');
  const [pitchTo, setPitchTo] = useState('C4');
  const fileInputRefs = useRef({});

  // Загрузка истории из localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('vocalCloneHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Сохранение истории
  const saveToHistory = (analysisData) => {
    const newEntry = {
      id: Date.now(),
      projectName,
      bpm,
      timeMarkers,
      cloneNames: files.clones.map(f => f.name),
      recommendations: analysisData,
      timestamp: new Date().toLocaleString('ru-RU'),
      cloneNotes
    };
    const updated = [newEntry, ...history];
    setHistory(updated);
    localStorage.setItem('vocalCloneHistory', JSON.stringify(updated));
  };

  const deleteHistoryEntry = (id) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem('vocalCloneHistory', JSON.stringify(updated));
  };

  const loadFromHistory = (entry) => {
    setProjectName(entry.projectName);
    setBpm(entry.bpm);
    setTimeMarkers(entry.timeMarkers);
    setCloneNotes(entry.cloneNotes || {});
    setAnalysis(entry.recommendations);
    setTab('new');
  };

  // Шаблоны проектов
  const templates = [
    { name: 'Стандартный рэп (120 BPM)', bpm: 120, sections: [
      { time: '0:00', section: 'Куплет 1', voice: 'Lead' },
      { time: '0:30', section: 'Припев', voice: 'Double' },
      { time: '1:00', section: 'Куплет 2', voice: 'Lead' },
      { time: '1:30', section: 'Припев', voice: 'Double' }
    ]},
    { name: 'R&B трек (90 BPM)', bpm: 90, sections: [
      { time: '0:00', section: 'Intro', voice: 'Air' },
      { time: '0:20', section: 'Куплет', voice: 'Lead' },
      { time: '1:00', section: 'Припев', voice: 'Double' },
      { time: '1:40', section: 'Бридж', voice: 'Backing' }
    ]},
    { name: 'Поп песня (100 BPM)', bpm: 100, sections: [
      { time: '0:00', section: 'Куплет', voice: 'Lead' },
      { time: '0:45', section: 'Припев', voice: 'Double' },
      { time: '1:30', section: 'Куплет 2', voice: 'Lead' }
    ]}
  ];

  const applyTemplate = (template) => {
    setBpm(template.bpm);
    setTimeMarkers(template.sections);
    alert(`✓ Шаблон "${template.name}" применён`);
  };

  // Нота в смещение в cents
  const noteToCents = (note) => {
    const notes = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
    const notePart = note.slice(0, -1);
    const octave = parseInt(note.slice(-1));
    
    if (!notes[notePart]) return 0;
    
    const noteValue = notes[notePart];
    const baseNote = notes['C'];
    const semitones = (octave - 4) * 12 + (noteValue - baseNote);
    return semitones * 100;
  };

  const calculatePitchShift = () => {
    const fromCents = noteToCents(pitchFrom);
    const toCents = noteToCents(pitchTo);
    return toCents - fromCents;
  };

  // Расчёт длины участков на основе BPM
  const calculateSectionLength = (tempoAndMeasures) => {
    const beatMs = (60000 / bpm);
    const measures = tempoAndMeasures || 8;
    return ((beatMs * 4 * measures) / 1000).toFixed(2);
  };

  const handleFileUpload = (e, category, isClone = false) => {
    const file = e.target.files[0];
    if (!file) return;

    if (isClone) {
      setFiles(prev => ({
        ...prev,
        clones: [...prev.clones, file]
      }));
    } else {
      setFiles(prev => ({
        ...prev,
        [category]: file
      }));
    }
  };

  const removeClone = (index) => {
    setFiles(prev => ({
      ...prev,
      clones: prev.clones.filter((_, i) => i !== index)
    }));
    const newNotes = { ...cloneNotes };
    delete newNotes[index];
    setCloneNotes(newNotes);
  };

  const analyzeAudio = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const data = audioBuffer.getChannelData(0);
      const rms = Math.sqrt(data.reduce((sum, val) => sum + val * val, 0) / data.length);
      const duration = audioBuffer.duration;

      let lowFreqEnergy = 0, midFreqEnergy = 0, highFreqEnergy = 0;
      const chunkSize = Math.floor(data.length / 3);
      
      for (let i = 0; i < chunkSize; i++) {
        lowFreqEnergy += Math.abs(data[i]);
      }
      for (let i = chunkSize; i < chunkSize * 2; i++) {
        midFreqEnergy += Math.abs(data[i]);
      }
      for (let i = chunkSize * 2; i < data.length; i++) {
        highFreqEnergy += Math.abs(data[i]);
      }

      return {
        duration: duration.toFixed(2),
        rms: (rms * 1000).toFixed(2),
        lowFreq: (lowFreqEnergy / chunkSize).toFixed(3),
        midFreq: (midFreqEnergy / chunkSize).toFixed(3),
        highFreq: (highFreqEnergy / chunkSize).toFixed(3)
      };
    } catch (err) {
      console.error('Ошибка анализа:', err);
      return null;
    }
  };

  const generateRecommendations = async () => {
    if (!files.reference_acapella || files.clones.length === 0) {
      alert('Загрузи референс акапелла и минимум 1 клон');
      return;
    }

    setLoading(true);
    try {
      const refAnalysis = await analyzeAudio(files.reference_acapella);
      const cloneAnalyses = await Promise.all(
        files.clones.map(async (clone, idx) => ({
          name: clone.name,
          index: idx,
          note: cloneNotes[idx] || '',
          data: await analyzeAudio(clone)
        }))
      );

      const prompt = `Ты — вокальный продюсер и sound engineer специалист по RVC клонам и mix engineering в BandLab.

ПРОЕКТ: "${projectName}"
BPM: ${bpm}

АНАЛИЗ ФАЙЛОВ:
Референс акапелла: ${JSON.stringify(refAnalysis)}

ЗАГРУЖЕННЫЕ КЛОНЫ (${cloneAnalyses.length}):
${cloneAnalyses.map(c => `${c.name}: RMS=${c.data.rms}mV, Low=${c.data.lowFreq}, Mid=${c.data.midFreq}, High=${c.data.highFreq}, Duration=${c.data.duration}s ${c.note ? `[Заметка: ${c.note}]` : ''}`).join('\n')}

СТРУКТУРА ТРЕКА:
${timeMarkers.map(m => `${m.time} - ${m.section} (роль: ${m.voice || 'не определена'})`).join('\n')}

ДОСТУПНЫЕ ПЛАГИНЫ В BANDLAB:
- Vintage Aural Exciter (воздух, прозрачность)
- FBK Compressor (динамика, контроль)
- BA-2A (гладкое сжатие, натуральность)
- EZ EQ (частотная коррекция)

ЗАДАЧИ:
1. Лучший клон для Lead роли и почему
2. Какие клоны конфликтуют по спектру (избежать слоирования)
3. Pitch shift в cents для каждого клона по разделам трека
4. Конкретные параметры для каждого плагина (gain, ratio, threshold и т.д.)
5. Time offset в мс для синхронизации клонов
6. Рекомендации по сольированию клонов перед миксом
7. Какие клоны использовать как backing/air эффекты
8. Уровни громкости в dB для каждого клона
9. Критические частоты для EZ EQ (срезать конфликты)
10. Финальный порядок слоёв в миксе

ВАЖНО: Конкретные цифры, диапазоны, параметры. Практичные советы для BandLab.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2500,
          messages: [
            { role: "user", content: prompt }
          ],
        })
      });

      const data = await response.json();
      if (data.content && data.content[0]) {
        const analysisData = {
          cloneAnalyses,
          recommendations: data.content[0].text,
          timestamp: new Date().toLocaleString('ru-RU')
        };
        setAnalysis(analysisData);
        saveToHistory(analysisData);
      }
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка при анализе');
    } finally {
      setLoading(false);
    }
  };

  const exportRecommendations = () => {
    if (!analysis) {
      alert('Сначала запусти анализ');
      return;
    }
    const text = `ПРОЕКТ: ${projectName}\nBPM: ${bpm}\nДата: ${analysis.timestamp}\n\n${analysis.recommendations}`;
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', `${projectName}_советы.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // ============= UI RENDER =============

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* HEADER */}
      <div className="sticky top-0 z-50 bg-slate-800/80 backdrop-blur border-b border-purple-500">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <Music className="w-6 h-6 text-purple-400" />
            <h1 className="text-xl font-bold text-white">Vocal Clone Analyzer</h1>
          </div>
          
          {/* ТАБЫ */}
          <div className="flex gap-2 overflow-x-auto">
            {[
              { id: 'new', label: '🆕 Новый анализ' },
              { id: 'history', label: `📋 История (${history.length})` },
              { id: 'tools', label: '🔧 Утилиты' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 rounded whitespace-nowrap text-sm font-medium transition ${
                  tab === t.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-purple-300 hover:bg-slate-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 pb-20">

        {/* ========== TAB: NEW ANALYSIS ========== */}
        {tab === 'new' && (
          <div className="space-y-4">
            
            {/* Название проекта */}
            <div className="bg-slate-800 rounded-lg p-4 border border-purple-500">
              <label className="block text-sm text-purple-300 mb-2">📁 Название проекта</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-purple-400 rounded text-white focus:outline-none focus:border-purple-300"
                placeholder="Посёлок v1"
              />
            </div>

            {/* РЕФЕРЕНСЫ */}
            <div className="bg-slate-800 rounded-lg p-4 border border-purple-500">
              <h2 className="text-lg font-semibold text-white mb-3">🎤 Референсы</h2>
              
              <div className="space-y-2">
                {[
                  { key: 'reference_acapella', label: '🎤 Акапелла (обязателен)', required: true },
                  { key: 'reference_minus', label: '🎵 Минусовка', required: false },
                  { key: 'original_track', label: '🔊 Оригинальный трек', required: false }
                ].map(({ key, label, required }) => (
                  <div key={key}>
                    <label className="block text-sm text-purple-300 mb-1">{label}</label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => handleFileUpload(e, key)}
                      ref={(ref) => fileInputRefs.current[key] = ref}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRefs.current[key].click()}
                      className={`w-full p-3 rounded border-2 border-dashed transition text-sm ${
                        files[key]
                          ? 'border-green-500 bg-green-500/10 text-green-300'
                          : 'border-purple-400 bg-purple-500/10 text-purple-300 hover:border-purple-300'
                      }`}
                    >
                      {files[key] ? `✓ ${files[key].name}` : `Загрузить ${label}`}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* КЛОНЫ */}
            <div className="bg-slate-800 rounded-lg p-4 border border-cyan-500">
              <h2 className="text-lg font-semibold text-cyan-300 mb-3">🎵 RVC Клоны ({files.clones.length})</h2>
              
              <input
                type="file"
                accept="audio/*"
                multiple
                onChange={(e) => {
                  Array.from(e.target.files || []).forEach(file => {
                    setFiles(prev => ({
                      ...prev,
                      clones: [...prev.clones, file]
                    }));
                  });
                }}
                className="hidden"
                ref={(ref) => fileInputRefs.current.clones = ref}
              />
              
              <button
                onClick={() => fileInputRefs.current.clones?.click()}
                className="w-full p-3 rounded border-2 border-dashed border-cyan-400 bg-cyan-500/10 text-cyan-300 hover:border-cyan-300 transition text-sm mb-3 font-medium"
              >
                + Добавить клоны
              </button>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {files.clones.map((clone, idx) => (
                  <div key={idx} className="bg-slate-700 p-3 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white font-medium truncate">{clone.name}</span>
                      <button
                        onClick={() => removeClone(idx)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    <button
                      onClick={() => setShowCloneNotes(prev => ({
                        ...prev,
                        [idx]: !prev[idx]
                      }))}
                      className="text-xs text-purple-300 hover:text-purple-200"
                    >
                      {showCloneNotes[idx] ? '▼ Скрыть заметку' : '▶ Добавить заметку'}
                    </button>
                    {showCloneNotes[idx] && (
                      <textarea
                        value={cloneNotes[idx] || ''}
                        onChange={(e) => setCloneNotes(prev => ({
                          ...prev,
                          [idx]: e.target.value
                        }))}
                        placeholder="Пример: яркий, но хрипит на высоких. Для бэкинга."
                        className="w-full mt-2 p-2 bg-slate-600 border border-purple-400 rounded text-xs text-white focus:outline-none"
                        rows="2"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* BPM И РАЗДЕЛЫ */}
            <div className="bg-slate-800 rounded-lg p-4 border border-orange-500">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-orange-300">⏱️ BPM & Разделы</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const selected = templates[0];
                      applyTemplate(selected);
                    }}
                    className="text-xs px-2 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded"
                  >
                    📋 Шаблон
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-orange-300 mb-2">BPM</label>
                <input
                  type="number"
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                  className="w-full px-3 py-2 bg-slate-700 border border-orange-500 rounded text-white focus:outline-none focus:border-orange-400"
                  min="60"
                  max="200"
                />
              </div>

              <label className="block text-sm text-orange-300 mb-2">Разделы трека</label>
              <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                {timeMarkers.map((marker, idx) => (
                  <div key={idx} className="flex gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="0:00"
                      value={marker.time}
                      onChange={(e) => {
                        const newMarkers = [...timeMarkers];
                        newMarkers[idx].time = e.target.value;
                        setTimeMarkers(newMarkers);
                      }}
                      className="w-16 px-2 py-2 bg-slate-700 border border-orange-400 rounded text-white focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Куплет"
                      value={marker.section}
                      onChange={(e) => {
                        const newMarkers = [...timeMarkers];
                        newMarkers[idx].section = e.target.value;
                        setTimeMarkers(newMarkers);
                      }}
                      className="flex-1 px-2 py-2 bg-slate-700 border border-orange-400 rounded text-white focus:outline-none"
                    />
                    <select
                      value={marker.voice}
                      onChange={(e) => {
                        const newMarkers = [...timeMarkers];
                        newMarkers[idx].voice = e.target.value;
                        setTimeMarkers(newMarkers);
                      }}
                      className="px-2 py-2 bg-slate-700 border border-orange-400 rounded text-white focus:outline-none text-xs"
                    >
                      <option value="">Роль</option>
                      <option value="Lead">Lead</option>
                      <option value="Double">Double</option>
                      <option value="Backing">Backing</option>
                      <option value="Air">Air</option>
                    </select>
                    <button
                      onClick={() => setTimeMarkers(timeMarkers.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-300 px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setTimeMarkers([...timeMarkers, { time: '0:00', section: 'Новый раздел', voice: '' }])}
                className="text-orange-400 hover:text-orange-300 text-sm"
              >
                + Добавить раздел
              </button>
            </div>

            {/* ANALYZE BUTTON */}
            <button
              onClick={generateRecommendations}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 transition text-lg"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Анализирую...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  АНАЛИЗИРОВАТЬ
                </>
              )}
            </button>

            {/* РЕЗУЛЬТАТЫ */}
            {analysis && (
              <div className="bg-slate-800 rounded-lg p-4 border border-green-500">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-green-300">📊 Рекомендации</h2>
                  <span className="text-xs text-gray-400">{analysis.timestamp}</span>
                </div>
                
                <div className="bg-slate-700 rounded p-4 mb-3 text-sm text-gray-300 max-h-80 overflow-y-auto">
                  <div className="whitespace-pre-wrap leading-relaxed text-white text-xs">
                    {analysis.recommendations}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(analysis.recommendations);
                      alert('✓ Скопировано');
                    }}
                    className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition flex items-center justify-center gap-1"
                  >
                    <Copy className="w-4 h-4" /> Копировать
                  </button>
                  <button
                    onClick={exportRecommendations}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition flex items-center justify-center gap-1"
                  >
                    <Download className="w-4 h-4" /> Скачать
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== TAB: ИСТОРИЯ ========== */}
        {tab === 'history' && (
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="bg-slate-800 rounded-lg p-8 text-center border border-slate-700">
                <p className="text-gray-400">📭 История пуста</p>
              </div>
            ) : (
              history.map(entry => (
                <div key={entry.id} className="bg-slate-800 rounded-lg border border-purple-500 overflow-hidden">
                  <button
                    onClick={() => setExpandedHistory(expandedHistory === entry.id ? null : entry.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-700 transition"
                  >
                    <div className="text-left">
                      <p className="font-semibold text-white">{entry.projectName}</p>
                      <p className="text-xs text-gray-400">{entry.timestamp} • BPM: {entry.bpm} • Клонов: {entry.cloneNames.length}</p>
                    </div>
                    {expandedHistory === entry.id ? <ChevronUp className="w-5 h-5 text-purple-400" /> : <ChevronDown className="w-5 h-5 text-purple-400" />}
                  </button>

                  {expandedHistory === entry.id && (
                    <div className="bg-slate-700 p-4 border-t border-purple-500 text-xs space-y-3">
                      <div>
                        <p className="text-purple-300 font-medium mb-2">Клоны:</p>
                        <div className="flex flex-wrap gap-1">
                          {entry.cloneNames.map((name, idx) => (
                            <span key={idx} className="bg-slate-600 px-2 py-1 rounded text-gray-300">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="bg-slate-600 rounded p-3 max-h-40 overflow-y-auto text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {entry.recommendations.recommendations}
                      </div>

                      <div className="flex gap-2 pt-3 border-t border-slate-600">
                        <button
                          onClick={() => loadFromHistory(entry)}
                          className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs transition"
                        >
                          ↻ Загрузить
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(entry.recommendations.recommendations);
                            alert('✓ Скопировано');
                          }}
                          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs transition"
                        >
                          📋 Скопировать
                        </button>
                        <button
                          onClick={() => deleteHistoryEntry(entry.id)}
                          className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-xs transition"
                        >
                          🗑️ Удалить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ========== TAB: УТИЛИТЫ ========== */}
        {tab === 'tools' && (
          <div className="space-y-4">
            
            {/* Калькулятор Pitch Shift */}
            <div className="bg-slate-800 rounded-lg p-4 border border-cyan-500">
              <h2 className="text-lg font-semibold text-cyan-300 mb-3">🎹 Калькулятор Pitch Shift</h2>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-cyan-300 block mb-2">Из ноты</label>
                    <select
                      value={pitchFrom}
                      onChange={(e) => setPitchFrom(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-cyan-400 rounded text-white focus:outline-none text-sm"
                    >
                      {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(note => (
                        <optgroup key={`group${note}`} label={note}>
                          {[2, 3, 4, 5, 6, 7, 8].map(oct => (
                            <option key={`${note}${oct}`} value={`${note}${oct}`}>{note}{oct}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-cyan-300 block mb-2">В ноту</label>
                    <select
                      value={pitchTo}
                      onChange={(e) => setPitchTo(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-cyan-400 rounded text-white focus:outline-none text-sm"
                    >
                      {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(note => (
                        <optgroup key={`group${note}`} label={note}>
                          {[2, 3, 4, 5, 6, 7, 8].map(oct => (
                            <option key={`${note}${oct}`} value={`${note}${oct}`}>{note}{oct}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="bg-slate-700 rounded p-4 border border-cyan-400">
                  <p className="text-cyan-300 font-semibold text-center">
                    {calculatePitchShift() > 0 ? '+' : ''}{calculatePitchShift()} cents
                  </p>
                  <p className="text-xs text-gray-400 text-center mt-1">
                    {calculatePitchShift() / 100 > 0 ? '↑ ' : '↓ '}
                    {Math.abs(calculatePitchShift() / 100).toFixed(1)} полутона
                  </p>
                </div>
              </div>
            </div>

            {/* Расчёт длины участков */}
            <div className="bg-slate-800 rounded-lg p-4 border border-green-500">
              <h2 className="text-lg font-semibold text-green-300 mb-3">⏱️ Расчёт длины раздела</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-green-300 block mb-2">Количество тактов (8 тактов = обычный куплет)</label>
                  <input
                    type="number"
                    defaultValue="8"
                    id="measureInput"
                    className="w-full px-3 py-2 bg-slate-700 border border-green-400 rounded text-white focus:outline-none"
                    min="1"
                    max="64"
                  />
                </div>
                
                <button
                  onClick={() => {
                    const measures = parseInt(document.getElementById('measureInput').value) || 8;
                    const length = calculateSectionLength(measures);
                    alert(`${measures} тактов @ ${bpm} BPM = ${length} секунд`);
                  }}
                  className="w-full px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-medium transition"
                >
                  Рассчитать
                </button>
              </div>
            </div>

            {/* Шаблоны */}
            <div className="bg-slate-800 rounded-lg p-4 border border-yellow-500">
              <h2 className="text-lg font-semibold text-yellow-300 mb-3">📋 Шаблоны проектов</h2>
              
              <div className="space-y-2">
                {templates.map((template, idx) => (
                  <button
                    key={idx}
                    onClick={() => applyTemplate(template)}
                    className="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded border border-yellow-500 text-left transition"
                  >
                    <p className="font-medium text-yellow-300 text-sm">{template.name}</p>
                    <p className="text-xs text-gray-400">{template.sections.length} разделов, {template.bpm} BPM</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Справка по плагинам */}
            <div className="bg-slate-800 rounded-lg p-4 border border-pink-500">
              <h2 className="text-lg font-semibold text-pink-300 mb-3">🎛️ Плагины BandLab</h2>
              
              <div className="space-y-2 text-xs">
                <div className="bg-slate-700 p-2 rounded">
                  <p className="text-pink-300 font-medium">Vintage Aural Exciter</p>
                  <p className="text-gray-400">Для воздуха и прозрачности. Усиливает 2-5 кHz. Используй 10-30% на Lead.</p>
                </div>
                <div className="bg-slate-700 p-2 rounded">
                  <p className="text-pink-300 font-medium">FBK Compressor</p>
                  <p className="text-gray-400">Контроль динамики. Ratio 4:1-8:1, Attack 10-50ms. На Lead для ровности.</p>
                </div>
                <div className="bg-slate-700 p-2 rounded">
                  <p className="text-pink-300 font-medium">BA-2A</p>
                  <p className="text-gray-400">Гладкое сжатие. Gain Reduction 6-8dB для натурального звука. На Double/Backing.</p>
                </div>
                <div className="bg-slate-700 p-2 rounded">
                  <p className="text-pink-300 font-medium">EZ EQ</p>
                  <p className="text-gray-400">Срез конфликтующих частот. Low-cut 80Hz, High-cut 12kHz на Backing вокалах.</p>
                </div>
              </div>
            </div>

            {/* Очистка истории */}
            <button
              onClick={() => {
                if (confirm('Очистить всю историю?')) {
                  setHistory([]);
                  localStorage.removeItem('vocalCloneHistory');
                  alert('✓ История удалена');
                }
              }}
              className="w-full p-3 bg-red-600 hover:bg-red-500 text-white rounded font-medium transition text-sm"
            >
              🗑️ Очистить историю
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default VocalCloneAnalyzer;