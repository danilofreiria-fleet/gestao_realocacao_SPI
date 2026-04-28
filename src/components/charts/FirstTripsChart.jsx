import React, { useState, useMemo } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, LabelList } from 'recharts';
import { Calendar, Users } from 'lucide-react';

const MAPA_REGIONAL = {
  "LM Hub_SP_Campinas_São Martinho": "SPI1",  
  "LM Hub_SP_Leme": "SPI1",  
  "LM Hub_SP_Limeira_Campo Belo": "SPI1",  
  "LM Hub_SP_Mogi Mirim": "SPI1",  
  "LM Hub_SP_Piracicaba": "SPI1",  
  "LM Hub_SP_Sumaré_Nova Veneza": "SPI1",  
  "LM Hub_SP_Campinas_PqCidade": "SPI1",  
  "LM Hub_SP_Araraquara": "SPO1",  
  "LM Hub_SP_Bauru_Centro": "SPO3",  
  "LM Hub_SP_Jaú": "SPO1",  
  "LM Hub_SP_Ribeirão Preto_02": "SPO1",  
  "LM Hub_SP_São Carlos": "SPO1",  
  "LM Hub_SP_RibeirãoPretoEstaça": "SPO1",  
  "LM Hub_SP_Barretos": "SPO2",  
  "LM Hub_SP_Franca_Distrito_Indust": "SPO2",  
  "LM Hub_SP_São José do Rio P": "SPO2",  
  "LM Hub_SP_Votuporanga": "SPO2",  
  "LM Hub_SP_Botucatu": "SPI3",  
  "LM Hub_SP_Atibaia_Ponte_Alta": "SPI2",  
  "LM Hub_SP_Itapetininga": "SPI3",  
  "LM Hub_SP_Itapeva": "SPI3",  
  "LM Hub_SP_Jundiaí": "SPI2",  
  "LM Hub_SP_Sorocaba_Região Norte": "SPI3",  
  "LM Hub_SP_Tatuí": "SPI3",  
  "LM Hub_SP_Várzea Paulista": "SPI2",  
  "LM Hub_SP_Araçatuba": "SPO2",  
  "LM Hub_SP_Assis": "SPO3",  
  "LM Hub_SP_Marília": "SPO3",  
  "LM Hub_SP_Presidente Prudente": "SPO3"
};

// 🔥 DICIONÁRIO DE TRADUÇÃO DOS MESES
const TRADUZ_MES = {
  'M-01': 'JAN', 'M-02': 'FEV', 'M-03': 'MAR', 'M-04': 'ABR',
  'M-05': 'MAI', 'M-06': 'JUN', 'M-07': 'JUL', 'M-08': 'AGO',
  'M-09': 'SET', 'M-10': 'OUT', 'M-11': 'NOV', 'M-12': 'DEZ'
};

export default function FirstTripsChart({ firstTripsData, filtrosGlobais = {} }) {
  const [periodo, setPeriodo] = useState('semana');
  
  const { regional = [], station = [], semana = "", mes = "" } = filtrosGlobais;

  const chartData = useMemo(() => {
    if (!firstTripsData || firstTripsData.length === 0) return [];
    const headers = firstTripsData[0];
    
    // 1. Filtra as colunas e ordena por "M-01", "M-02" para garantir ordem cronológica
    const colunasPeriodo = headers.map((h, i) => ({ nome: String(h), idx: i }))
      .filter(h => {
        if (periodo === 'semana') {
          if (!h.nome.startsWith('W-')) return false;
          if (semana && h.nome !== semana) return false;
          return true;
        } else {
          if (!h.nome.startsWith('M-')) return false;
          if (mes && h.nome !== `M-${mes}`) return false;
          return true;
        }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));

    const acumulado = {};
    colunasPeriodo.forEach(col => acumulado[col.nome] = 0);

    // 2. Acumula os dados
    firstTripsData.slice(1).forEach(row => {
      const hub = String(row[0] || "");
      const regDoHub = MAPA_REGIONAL[hub] || "";

      if (regional.length > 0 && !regional.includes(regDoHub)) return;
      if (station.length > 0 && !station.includes(hub)) return;

      colunasPeriodo.forEach(col => {
        acumulado[col.nome] += Number(row[col.idx]) || 0;
      });
    });

    const dadosFinais = [];
    let valorAnterior = null;

    // 3. Monta o objeto final para o gráfico
    colunasPeriodo.forEach((col) => {
      const qtdAtual = acumulado[col.nome];
      let variacao = 0;

      if (valorAnterior !== null && valorAnterior !== 0) {
        variacao = ((qtdAtual - valorAnterior) / valorAnterior) * 100;
      } else if (valorAnterior === 0 && qtdAtual > 0) {
        variacao = 100;
      }

      dadosFinais.push({
        // 🔥 A MÁGICA: Se for mês, traduz o nome usando o dicionário. Se for semana, deixa "W-XX"
        name: periodo === 'mes' ? (TRADUZ_MES[col.nome] || col.nome) : col.nome,
        quantidade: qtdAtual,
        variacao: Number(variacao.toFixed(1)),
      });

      valorAnterior = qtdAtual;
    });

    return dadosFinais;
  }, [firstTripsData, periodo, station, regional, semana, mes]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-800 p-3 rounded-lg shadow-xl z-50">
          <p className="font-black text-slate-800 dark:text-white mb-2">{label}</p>
          <p className="font-bold text-sm" style={{ color: '#EE4D2D' }}>
            First Trips: {payload[0].value}
          </p>
          <p className="font-bold text-sm" style={{ color: '#D0011B' }}>
            Variação: {payload[1].value > 0 ? '+' : ''}{payload[1].value}%
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = (props) => {
    const { x, y, value } = props;
    if (value === 0) return null;
    return (
      <text x={x} y={y} dy={-10} fill="#D0011B" fontSize={10} fontWeight="bold" textAnchor="middle">
        {value > 0 ? `+${value}%` : `${value}%`}
      </text>
    );
  };

  if (chartData.length === 0) return null;

  return (
    <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 flex flex-col relative transition-all mt-6">
      <div className="flex justify-between items-start mb-6 border-b border-slate-100 dark:border-gray-800 pb-4">
        <div>
          <h3 className="font-black uppercase flex items-center gap-2 text-xl text-[#113366]">
            Evolução de First Trips
          </h3>
          <p className="text-xs text-slate-400 font-bold uppercase mt-1 flex items-center gap-1">
            <Users size={12}/> {periodo === 'semana' ? 'Visão por Semana (W)' : 'Visão por Mês (M)'}
          </p>
        </div>
        <div className="flex bg-slate-100 dark:bg-[#15171e] p-1 rounded-lg">
          <button 
            onClick={() => setPeriodo('semana')} 
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold transition-all ${periodo === 'semana' ? 'bg-[#113366] shadow text-white' : 'text-slate-500'}`}
          >
            <Calendar size={14} /> Sem
          </button>
          <button 
            onClick={() => setPeriodo('mes')} 
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold transition-all ${periodo === 'mes' ? 'bg-[#113366] shadow text-white' : 'text-slate-500'}`}
          >
            <Calendar size={14} /> Mês
          </button>
        </div>
      </div>

      <div className="w-full h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 30, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold' }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(tick) => `${tick}%`} tick={{ fontSize: 11, fill: '#D0011B' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />

            <Bar yAxisId="left" dataKey="quantidade" name="Qtd First Trips" fill="#EE4D2D" barSize={35} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="quantidade" position="top" style={{ fill: '#EE4D2D', fontSize: 11, fontWeight: '900' }} />
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="#EE4D2D" />
              ))}
            </Bar>

            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="variacao" 
              name="Variação % vs Anterior" 
              stroke="#D0011B" 
              strokeWidth={3} 
              dot={{ r: 5, fill: "#fff", stroke: "#D0011B", strokeWidth: 2 }} 
              activeDot={{ r: 7 }}
              label={<CustomLabel />}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}