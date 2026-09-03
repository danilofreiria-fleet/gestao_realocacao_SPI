import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ComposedChart, Cell
} from 'recharts';
import { CalendarDays, TrendingUp, TrendingDown, Users, AlertCircle, Filter } from 'lucide-react';

// ==========================================
// ⚠️ AJUSTE AQUI OS ÍNDICES DA SUA PLANILHA
// ==========================================
const COL = {
  DATA: 3,
  HUB: 4,
  MODAL: 5, // Se houver
  SEMANA: 2,
  OFERTAS: 10,       // Exemplo: índice da coluna de Ofertas
  RECUSAS: 11,       // Exemplo: índice da coluna de Recusas
  AT_PISO: 12,       // Exemplo: índice da coluna de AT no Piso
  DS_TOTAL: 13,      // Exemplo: índice da coluna de DS Total (em decimal ou %)
  DS_D0: 14,         // Exemplo: índice da coluna de DS D0
  MOTORISTA: 15      // Exemplo: índice do nome do motorista (para a base de motoristas)
};

export default function EstudosDSRodizio({ rawData = [], dsMotoristaData = [], filtrosGlobais }) {
  const [dsType, setDsType] = useState('total'); // 'total' ou 'd0'
  const [timeView, setTimeView] = useState('semana'); // 'dia', 'semana', 'mes'
  const [modalFilter, setModalFilter] = useState('Todos');

  // ==========================================
  // 1. PROCESSAMENTO: Variação de DS Global
  // ==========================================
  const dsGlobalData = useMemo(() => {
    if (!rawData.length) return [];
    
    // Agrupa dados baseado na visão de tempo escolhida
    const grouped = rawData.reduce((acc, row) => {
      const dataRaw = row[COL.DATA];
      if (!dataRaw) return acc;
      
      let key = '';
      if (timeView === 'dia') key = String(dataRaw).split(' ')[0]; // DD/MM/AAAA
      if (timeView === 'semana') key = row[COL.SEMANA] || 'Semana N/A';
      if (timeView === 'mes') {
        const parts = String(dataRaw).split(' ')[0].split('/');
        key = parts.length === 3 ? `${parts[1]}/${parts[2]}` : 'Mês N/A';
      }

      if (modalFilter !== 'Todos' && row[COL.MODAL] !== modalFilter) return acc;

      if (!acc[key]) acc[key] = { name: key, dsTotal: 0, dsD0: 0, count: 0 };
      
      acc[key].dsTotal += Number(row[COL.DS_TOTAL]) || 0;
      acc[key].dsD0 += Number(row[COL.DS_D0]) || 0;
      acc[key].count += 1;
      
      return acc;
    }, {});

    // Calcula as médias e a variação percentual (MoM / WoW / DoD)
    const result = Object.values(grouped).map(item => ({
      ...item,
      dsTotalMedia: item.count ? (item.dsTotal / item.count) : 0,
      dsD0Media: item.count ? (item.dsD0 / item.count) : 0,
    })).sort((a, b) => a.name.localeCompare(b.name));

    return result.map((item, index, arr) => {
      const currentDS = dsType === 'total' ? item.dsTotalMedia : item.dsD0Media;
      const prevDS = index > 0 ? (dsType === 'total' ? arr[index - 1].dsTotalMedia : arr[index - 1].dsD0Media) : currentDS;
      const variacao = prevDS > 0 ? ((currentDS - prevDS) / prevDS) * 100 : 0;
      return { ...item, variacao, currentDS };
    });
  }, [rawData, timeView, dsType, modalFilter]);

  // ==========================================
  // 2. PROCESSAMENTO: Dias da Semana
  // ==========================================
  const diasSemanaData = useMemo(() => {
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const grouped = dias.reduce((acc, dia) => ({
      ...acc, [dia]: { name: dia, ofertas: 0, recusas: 0, atPiso: 0, dsTotal: 0, dsD0: 0, count: 0 }
    }), {});

    rawData.forEach(row => {
      const dataRaw = row[COL.DATA];
      if (!dataRaw) return;
      
      let dObj = null;
      if (String(dataRaw).includes('/')) {
        const [dia, mes, ano] = String(dataRaw).split(' ')[0].split('/');
        dObj = new Date(`${ano}-${mes}-${dia}T12:00:00`);
      } else {
        dObj = new Date(dataRaw);
      }

      if (isNaN(dObj)) return;
      
      const nomeDia = dias[dObj.getDay()];
      grouped[nomeDia].ofertas += Number(row[COL.OFERTAS]) || 0;
      grouped[nomeDia].recusas += Number(row[COL.RECUSAS]) || 0;
      grouped[nomeDia].atPiso += Number(row[COL.AT_PISO]) || 0;
      grouped[nomeDia].dsTotal += Number(row[COL.DS_TOTAL]) || 0;
      grouped[nomeDia].dsD0 += Number(row[COL.DS_D0]) || 0;
      grouped[nomeDia].count += 1;
    });

    return Object.values(grouped).map(item => ({
      ...item,
      dsTotalMedia: item.count ? (item.dsTotal / item.count) * 100 : 0,
      dsD0Media: item.count ? (item.dsD0 / item.count) * 100 : 0,
    }));
  }, [rawData]);

  // ==========================================
  // 3. PROCESSAMENTO: Top/Bottom Motoristas
  // ==========================================
  const rankingMotoristas = useMemo(() => {
    const base = dsMotoristaData.length ? dsMotoristaData : rawData; // Fallback se não passar base específica
    const grouped = base.reduce((acc, row) => {
      const hub = String(row[COL.HUB] || 'Desconhecido').trim();
      const motorista = String(row[COL.MOTORISTA] || 'Não Identificado').trim();
      if (!motorista || motorista === 'Não Identificado') return acc;

      if (!acc[hub]) acc[hub] = {};
      if (!acc[hub][motorista]) acc[hub][motorista] = { motorista, dsTotal: 0, dsD0: 0, count: 0 };
      
      acc[hub][motorista].dsTotal += Number(row[COL.DS_TOTAL]) || 0;
      acc[hub][motorista].dsD0 += Number(row[COL.DS_D0]) || 0;
      acc[hub][motorista].count += 1;
      return acc;
    }, {});

    const rankingsPorHub = {};
    Object.keys(grouped).forEach(hub => {
      const lista = Object.values(grouped[hub]).map(m => ({
        motorista: m.motorista,
        dsTotalMedia: m.count ? m.dsTotal / m.count : 0,
        dsD0Media: m.count ? m.dsD0 / m.count : 0,
      }));
      
      // Ordena por DS (Baseado no Toggle D0 vs Total)
      lista.sort((a, b) => dsType === 'total' ? b.dsTotalMedia - a.dsTotalMedia : b.dsD0Media - a.dsD0Media);
      
      rankingsPorHub[hub] = {
        top20: lista.slice(0, 20),
        bottom20: lista.slice(-20).reverse()
      };
    });

    return rankingsPorHub;
  }, [dsMotoristaData, rawData, dsType]);

  const selectedHubs = filtrosGlobais?.station?.length ? filtrosGlobais.station : Object.keys(rankingMotoristas).slice(0, 1);

  return (
    <div className="space-y-6">
      
      {/* SEÇÃO 1: VARIAÇÃO DE DS GLOBAL */}
      <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h3 className="text-lg font-black text-[#113366] dark:text-white uppercase tracking-tight flex items-center gap-2">
              <TrendingUp size={20} className="text-[#EE4D2D]" />
              Variação de DS Global
            </h3>
            <p className="text-xs text-slate-500 mt-1">Evolução do Delivery Success e variação percentual vs. período anterior</p>
          </div>
          
          <div className="flex gap-2">
            <div className="flex bg-slate-100 dark:bg-gray-800 p-1 rounded-lg">
              {['total', 'd0'].map(type => (
                <button 
                  key={type} onClick={() => setDsType(type)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${dsType === type ? 'bg-white dark:bg-[#1f232d] shadow-sm text-[#EE4D2D]' : 'text-slate-500'}`}
                >
                  DS {type.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex bg-slate-100 dark:bg-gray-800 p-1 rounded-lg">
              {['dia', 'semana', 'mes'].map(view => (
                <button 
                  key={view} onClick={() => setTimeView(view)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${timeView === view ? 'bg-[#113366] shadow-sm text-white' : 'text-slate-500'}`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dsGlobalData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
              <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} tickMargin={10} />
              <YAxis yAxisId="left" tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(val) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`} />
              <RechartsTooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', backgroundColor: '#1f232d', color: '#fff' }}
                formatter={(value, name) => {
                  if (name === 'Variação (%)') return [`${value > 0 ? '+' : ''}${value.toFixed(2)}%`, name];
                  return [`${(value * 100).toFixed(2)}%`, name === 'currentDS' ? `DS ${dsType.toUpperCase()}` : name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
              <Bar yAxisId="left" dataKey="currentDS" name={`DS ${dsType.toUpperCase()}`} fill="#113366" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="variacao" name="Variação (%)" stroke="#EE4D2D" strokeWidth={3} dot={{r: 4, fill: '#EE4D2D'}} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SEÇÃO 2: ANÁLISE POR DIA DA SEMANA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
          <h3 className="text-sm font-black text-[#113366] dark:text-white uppercase mb-4">Volume Operacional vs Dia da Semana</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diasSemanaData} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" tick={{fontSize: 10}} />
                <YAxis tick={{fontSize: 10}} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#1f232d', color: '#fff', borderRadius: '8px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="ofertas" name="Ofertas" fill="#113366" radius={[2,2,0,0]} />
                <Bar dataKey="recusas" name="Recusas" fill="#EE4D2D" radius={[2,2,0,0]} />
                <Bar dataKey="atPiso" name="AT no Piso" fill="#F59E0B" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
          <h3 className="text-sm font-black text-[#113366] dark:text-white uppercase mb-4">Desempenho DS vs Dia da Semana</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={diasSemanaData} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" tick={{fontSize: 10}} />
                <YAxis tick={{fontSize: 10}} tickFormatter={(val) => `${val}%`} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#1f232d', color: '#fff', borderRadius: '8px' }} formatter={(val) => [`${val.toFixed(2)}%`]}/>
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="dsTotalMedia" name="DS Total" stroke="#10B981" strokeWidth={3} />
                <Line type="monotone" dataKey="dsD0Media" name="DS D0" stroke="#3B82F6" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SEÇÃO 3: RANKING DE MOTORISTAS */}
      <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h3 className="text-lg font-black text-[#113366] dark:text-white uppercase tracking-tight flex items-center gap-2">
              <Users size={20} className="text-[#EE4D2D]" />
              Ranking de Motoristas por Hub (Top & Bottom 20)
            </h3>
            <p className="text-xs text-slate-500 mt-1">Classificação baseada na métrica selecionada (DS {dsType.toUpperCase()})</p>
          </div>
        </div>

        {selectedHubs.map(hub => {
          const hubRank = rankingMotoristas[hub];
          if (!hubRank || hubRank.top20.length === 0) return null;

          return (
            <div key={hub} className="mb-10 last:mb-0">
              <h4 className="font-bold text-[#EE4D2D] uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-gray-700 pb-2">{hub}</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* TOP 20 */}
                <div className="border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 border-b border-slate-200 dark:border-gray-700 flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-600" />
                    <span className="font-bold text-xs uppercase text-emerald-800 dark:text-emerald-400">Top 20 Melhores</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-[#15171e]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="p-2 text-slate-500 font-bold uppercase w-8">#</th>
                          <th className="p-2 text-slate-500 font-bold uppercase">Motorista</th>
                          <th className="p-2 text-slate-500 font-bold uppercase text-right">DS Selecionado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hubRank.top20.map((m, i) => (
                          <tr key={i} className="border-b border-slate-200 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                            <td className="p-2 font-black text-slate-400">{i + 1}</td>
                            <td className="p-2 font-medium text-slate-700 dark:text-gray-200">{m.motorista}</td>
                            <td className="p-2 text-right font-black text-emerald-600">
                              {((dsType === 'total' ? m.dsTotalMedia : m.dsD0Media) * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* BOTTOM 20 */}
                <div className="border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 border-b border-slate-200 dark:border-gray-700 flex items-center gap-2">
                    <TrendingDown size={16} className="text-red-600" />
                    <span className="font-bold text-xs uppercase text-red-800 dark:text-red-400">Top 20 Piores</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-[#15171e]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="p-2 text-slate-500 font-bold uppercase w-8">#</th>
                          <th className="p-2 text-slate-500 font-bold uppercase">Motorista</th>
                          <th className="p-2 text-slate-500 font-bold uppercase text-right">DS Selecionado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hubRank.bottom20.map((m, i) => (
                          <tr key={i} className="border-b border-slate-200 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                            <td className="p-2 font-black text-slate-400">{i + 1}</td>
                            <td className="p-2 font-medium text-slate-700 dark:text-gray-200">{m.motorista}</td>
                            <td className="p-2 text-right font-black text-red-500">
                              {((dsType === 'total' ? m.dsTotalMedia : m.dsD0Media) * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
        {selectedHubs.length === 0 && (
           <div className="p-8 text-center font-bold text-slate-400 border border-dashed border-slate-300 dark:border-gray-700 rounded-xl">
             Selecione uma Station nos filtros globais para ver o ranking.
           </div>
        )}
      </div>
    </div>
  );
}