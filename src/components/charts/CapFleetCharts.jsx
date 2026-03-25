import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { AlertOctagon, Maximize2, Minimize2, X } from 'lucide-react';

const TIMELINE_COLORS = [
  '#660000', '#8B0000', '#B22222', '#C8102E', '#DC143C', 
  '#E63946', '#EE4D2D', '#FF4D4D', '#FF6B6B', '#FF8E8B', 
  '#FFA07A', '#FA8072', '#E9967A', '#F08080', '#CD5C5C'
];

export default function CapFleetCharts({ data }) {
  const [fullscreenChart, setFullscreenChart] = useState(null);

  const parseUniversalDate = (dateStr) => {
    if (!dateStr) return null;
    let s = String(dateStr).trim().split('T')[0].split(' ')[0];
    if (s.includes('/')) {
      const [dia, mes, ano] = s.split('/');
      if (ano && mes && dia) return new Date(ano, mes - 1, dia, 12, 0, 0);
    }
    if (s.includes('-')) {
      const [ano, mes, dia] = s.split('-');
      if (ano && mes && dia) return new Date(ano, mes - 1, dia, 12, 0, 0);
    }
    return null;
  };

  const parsePct = (val) => {
    if (!val) return 0;
    let s = String(val).trim();
    const hasPercent = s.includes('%');
    s = s.replace('%', '').trim();
    let n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
    if (isNaN(n)) return 0;
    return hasPercent ? n : n * 100;
  };

  const cleanName = (name) => String(name).replace('LM Hub_SP_', '');

  const { weekData, regData, hubData, pctRegData, pctHubData, timelineData, timelineKeys } = useMemo(() => {
    const aggWeek = {}; const aggReg = {}; const aggHub = {};
    const aggPctReg = {}; const aggPctHub = {};
    const tData = {}; const datesMap = new Map();

    let maxDateMs = 0;
    data.forEach(row => {
      const d = parseUniversalDate(row[3]);
      if (d && d.getTime() > maxDateMs) maxDateMs = d.getTime();
    });
    const fifteenDaysAgo = maxDateMs > 0 ? maxDateMs - (15 * 24 * 60 * 60 * 1000) : 0;

    data.forEach(row => {
      const regional = row[1] || 'N/A';
      const semana = row[2] || 'N/A';
      const dateStr = row[3] || '';
      const station = cleanName(row[4] || 'N/A');
      
      const pctValue = parsePct(row[45]); 
      const status = String(row[46] || '').toUpperCase();

      const isLimit = status.includes('LIMITE') || status.includes('NÃO ATENDE') || status.includes('NAO ATENDE');

      if (isLimit) {
        aggWeek[semana] = (aggWeek[semana] || 0) + 1;
        aggReg[regional] = (aggReg[regional] || 0) + 1;
        aggHub[station] = (aggHub[station] || 0) + 1;
      }

      if (pctValue > 100) {
        const excess = pctValue - 100; 

        if (!aggPctReg[regional]) aggPctReg[regional] = { sum: 0, count: 0 };
        aggPctReg[regional].sum += excess;
        aggPctReg[regional].count += 1;

        if (!aggPctHub[station]) aggPctHub[station] = { sum: 0, count: 0 };
        aggPctHub[station].sum += excess;
        aggPctHub[station].count += 1;

        const d = parseUniversalDate(dateStr);
        if (d && d.getTime() >= fifteenDaysAgo) {
          const dateFormatted = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
          datesMap.set(d.getTime(), dateFormatted);
          
          if (!tData[station]) tData[station] = {};
          if (!tData[station][dateFormatted]) {
            tData[station][dateFormatted] = excess;
          } else {
            tData[station][dateFormatted] = Math.max(tData[station][dateFormatted], excess);
          }
        }
      }
    });

    const formatCount = (obj) => Object.keys(obj).map(k => ({ name: k, count: obj[k] })).sort((a,b) => b.count - a.count);
    const formatAvg = (obj) => Object.keys(obj).map(k => ({ name: k, avg: Number((obj[k].sum / obj[k].count).toFixed(2)) })).sort((a,b) => b.avg - a.avg);

    const sortedRawDates = Array.from(datesMap.keys()).sort((a,b) => a - b);
    const tKeys = sortedRawDates.map(ms => datesMap.get(ms));
    
    const tArray = Object.keys(tData).map(station => {
      const res = { name: station };
      tKeys.forEach(date => {
        if (tData[station][date]) res[date] = tData[station][date];
      });
      return res;
    }).sort((a, b) => {
      const sumA = tKeys.reduce((acc, key) => acc + (a[key] || 0), 0);
      const sumB = tKeys.reduce((acc, key) => acc + (b[key] || 0), 0);
      return sumB - sumA;
    });

    return {
      weekData: Object.keys(aggWeek).map(k => ({ name: k, count: aggWeek[k] })).sort((a,b) => a.name.localeCompare(b.name)),
      regData: formatCount(aggReg),
      hubData: formatCount(aggHub),
      pctRegData: formatAvg(aggPctReg),
      pctHubData: formatAvg(aggPctHub),
      timelineData: tArray,
      timelineKeys: tKeys
    };
  }, [data]);

  const CountTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) return (
      <div className="bg-white dark:bg-[#1f232d] p-3 rounded-lg shadow-xl border border-slate-200">
        <p className="font-bold border-b pb-2 mb-2">{label}</p>
        <p className="text-[#D0011B] font-bold">Estouros de Limite: {payload[0].value}</p>
      </div>
    );
    return null;
  };

  const PctTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) return (
      <div className="bg-white dark:bg-[#1f232d] p-3 rounded-lg shadow-xl border border-slate-200">
        <p className="font-bold border-b pb-2 mb-2">{label}</p>
        <p className="text-[#EE4D2D] font-bold">Média Excedente Geral: +{payload[0].value}%</p>
      </div>
    );
    return null;
  };

  const TimelineTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) return (
      <div className="bg-white dark:bg-[#1f232d] p-3 rounded-lg shadow-xl border border-slate-200">
        <p className="font-bold border-b pb-2 mb-2 text-[#113366]">{label}</p>
        <div className="max-h-48 overflow-y-auto custom-scrollbar pr-2">
          {payload.filter(p => p.value > 0).slice().reverse().map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-[11px] font-bold mb-1 flex justify-between gap-4">
              <span>{entry.name}:</span> <span>+{entry.value.toFixed(2)}%</span>
            </p>
          ))}
        </div>
      </div>
    );
    return null;
  };

  const renderChartCard = (id, title, content, colSpan = "col-span-1") => {
    const isFullscreen = fullscreenChart === id;
    const cardContent = (
      <div className={`bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col relative transition-all ${isFullscreen ? 'w-full h-full p-8' : `h-[400px] p-6 ${colSpan}`} print:break-inside-avoid print:h-[450px]`}>
        <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-gray-800 pb-4 shrink-0">
          <h3 className={`font-black text-[#D0011B] uppercase flex items-center gap-2 ${isFullscreen ? 'text-2xl' : 'text-sm'}`}>
            {title}
          </h3>
          <button onClick={() => setFullscreenChart(isFullscreen ? null : id)} className="text-slate-400 hover:text-[#EE4D2D] bg-slate-50 hover:bg-orange-50 dark:bg-gray-800 p-2 rounded-lg transition-colors print:hidden" title={isFullscreen ? "Minimizar" : "Expandir"}>
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar print:overflow-hidden">
          <div className="w-full h-full min-h-[300px]">{content}</div>
        </div>
      </div>
    );

    if (isFullscreen) {
      return (
        <div className="fixed inset-4 z-[99999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 print:hidden">
          <div className="w-full h-full relative">
             {cardContent}
             <button onClick={() => setFullscreenChart(null)} className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-lg"><X size={24}/></button>
          </div>
        </div>
      );
    }
    return cardContent;
  };

  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-6 pt-6 print:pt-0">
      
      {/* 🔥 NOVO BANNER ESTILIZADO */}
      <div className="bg-[#113366] rounded-2xl shadow-sm overflow-hidden border border-[#113366] print:break-inside-avoid">
        <div className="text-white text-center py-4 px-6 flex flex-col items-center justify-center gap-1">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest flex items-center gap-2">
            <AlertOctagon className="text-[#EE4D2D]" size={28}/> Análise de Cap Fleet e Gargalos
          </h2>
          <p className="text-xs md:text-sm font-bold text-white/80 uppercase tracking-wider">Monitoramento de limites atingidos e média do volume excedido</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:space-y-6">
        
        {renderChartCard('capWeek', 'CAP FLEET LIMIT [PER WEEK]', (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={weekData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" tick={{fontSize: 11}} />
              <YAxis dataKey="name" type="category" width={50} tick={{fontSize: 10, fontWeight: 'bold'}} />
              <Tooltip content={<CountTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Bar dataKey="count" fill="#D0011B" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="count" position="right" style={{fill: '#D0011B', fontSize: 11, fontWeight: 'bold'}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ))}

        {renderChartCard('capReg', 'CAP FLEET LIMIT [PER REG]', (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={regData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" tick={{fontSize: 11}} />
              <YAxis dataKey="name" type="category" width={50} tick={{fontSize: 10, fontWeight: 'bold'}} />
              <Tooltip content={<CountTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Bar dataKey="count" fill="#113366" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="count" position="right" style={{fill: '#113366', fontSize: 11, fontWeight: 'bold'}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ))}

        {renderChartCard('capHub', 'CAP FLEET LIMIT [HUB OFFENDERS]', (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hubData} margin={{ top: 20, right: 10, left: -20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9}} angle={-45} textAnchor="end" interval={0} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} />
              <Tooltip content={<CountTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Bar dataKey="count" fill="#EE4D2D" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="count" position="top" style={{fill: '#EE4D2D', fontSize: 10, fontWeight: 'bold'}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ), "lg:col-span-2")}

        {renderChartCard('capTimeline', 'CAP FLEET LIMIT [% TIMELINE LAST 15 DAYS]', (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineData} margin={{ top: 20, right: 10, left: -10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9}} angle={-45} textAnchor="end" interval={0} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} tickFormatter={(val) => `${val}%`} />
              <Tooltip content={<TimelineTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px' }} />
              
              {timelineKeys.map((date, index) => (
                <Bar key={date} dataKey={date} fill={TIMELINE_COLORS[index % TIMELINE_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ), "lg:col-span-2")}

        {renderChartCard('pctReg', 'CAP FLEET LIMIT [% PER REG]', (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pctRegData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} tickFormatter={(val) => `${val}%`} />
              <Tooltip content={<PctTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Bar dataKey="avg" fill="#D0011B" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="avg" position="top" formatter={(val) => `+${val}%`} style={{fill: '#D0011B', fontSize: 10, fontWeight: 'bold'}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ))}

        {renderChartCard('pctHub', 'CAP FLEET LIMIT [% PER HUB]', (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pctHubData} margin={{ top: 20, right: 10, left: -10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9}} angle={-45} textAnchor="end" interval={0} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} tickFormatter={(val) => `${val}%`} />
              <Tooltip content={<PctTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Bar dataKey="avg" fill="#EE4D2D" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="avg" position="top" formatter={(val) => `+${val}%`} style={{fill: '#EE4D2D', fontSize: 10, fontWeight: 'bold'}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ))}

      </div>
    </div>
  );
}