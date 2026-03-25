import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getConsolidadoData } from '../api/googleSheets';
import Visualizations from './Visualizations';
import { CalendarDays, MapPin, Search, Clock, Hash, Eraser, Download, Printer, ChevronDown } from 'lucide-react';

const MESES = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' }, { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' }, { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState([]);
  
  const [filtros, setFiltros] = useState({
    regional: '', station: '', turno: [], dataInicio: '', dataFim: '', semana: '', mes: ''
  });

  const [isTurnoMenuOpen, setIsTurnoMenuOpen] = useState(false);
  const turnoMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (turnoMenuRef.current && !turnoMenuRef.current.contains(event.target)) {
        setIsTurnoMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const carregarDados = async () => {
      setLoading(true);
      try {
        const data = await getConsolidadoData();
        if (data && data.length > 1) setRawData(data.slice(1));
      } catch (error) { console.error("Erro ao carregar Dashboard", error); }
      finally { setLoading(false); }
    };
    carregarDados();
  }, []);

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (String(dateStr).includes('/')) {
      const [dia, mes, ano] = dateStr.split(' ')[0].split('/');
      return new Date(`${ano}-${mes}-${dia}T12:00:00`);
    }
    return new Date(dateStr);
  };

  const opcoes = useMemo(() => {
    const regionais = new Set(), stations = new Set(), semanas = new Set(), turnos = new Set();
    rawData.forEach(row => {
      if (row[1]) regionais.add(row[1]); 
      if (row[2]) semanas.add(row[2]);   
      if (row[4]) stations.add(row[4]);  
      if (row[5]) turnos.add(row[5]);    
    });
    return {
      regionais: Array.from(regionais).sort(),
      stations: Array.from(stations).sort(),
      semanas: Array.from(semanas).sort(),
      turnos: Array.from(turnos).sort()
    };
  }, [rawData]);

  const handleChange = (e) => setFiltros(prev => ({ ...prev, [e.target.name]: e.target.value }));
  
  const toggleTurno = (turnoSelecionado) => {
    setFiltros(prev => {
      const turnosAtuais = prev.turno;
      if (turnosAtuais.includes(turnoSelecionado)) {
        return { ...prev, turno: turnosAtuais.filter(t => t !== turnoSelecionado) };
      } else {
        return { ...prev, turno: [...turnosAtuais, turnoSelecionado] };
      }
    });
  };

  const limparFiltros = () => setFiltros({ regional: '', station: '', turno: [], dataInicio: '', dataFim: '', semana: '', mes: '' });

  const dadosFiltrados = useMemo(() => {
    return rawData.filter(row => {
      const dataRow = row[3]; 
      const dObj = parseDate(dataRow);
      let pass = true;
      
      if (filtros.regional && row[1] !== filtros.regional) pass = false;
      if (filtros.semana && row[2] !== filtros.semana) pass = false;
      if (filtros.station && row[4] !== filtros.station) pass = false;
      if (filtros.turno.length > 0 && !filtros.turno.includes(row[5])) pass = false;
      
      if (dObj && !isNaN(dObj)) {
        if (filtros.mes && String(dObj.getMonth() + 1).padStart(2, '0') !== filtros.mes) pass = false;
        if (filtros.dataInicio || filtros.dataFim) {
          const start = filtros.dataInicio ? new Date(filtros.dataInicio + 'T00:00:00') : null;
          const end = filtros.dataFim ? new Date(filtros.dataFim + 'T23:59:59') : null;
          if (start && dObj < start) pass = false;
          if (end && dObj > end) pass = false;
        }
      }
      return pass;
    });
  }, [rawData, filtros]);

  const exportarCSV = () => {
    if (dadosFiltrados.length === 0) return alert("Não há dados para exportar.");
    const headersCSV = ["Regional", "Semana", "Data", "Station", "Turno", "AT Piso", "Vol Roteirizado", "Vol Processado", "Vol Expedido"];
    const linhasCSV = dadosFiltrados.map(row => [
      row[1] || "", row[2] || "", row[3] || "", row[4] || "", row[5] || "", 
      row[19] || 0, row[11] || 0, row[13] || 0, row[14] || 0
    ].join(","));
    
    const csvContent = "\uFEFF" + [headersCSV.join(","), ...linhasCSV].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Dados_Dashboard_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const exportarPDF = () => { window.print(); };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-[#EE4D2D] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold animate-pulse">Calculando Indicadores...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6 print:space-y-0 print:block">
      
      {/* HEADER E FILTROS */}
      {/* 🔥 MUDANÇA AQUI: Removido o z-30 e adicionado relative para corrigir a Tela Cheia */}
      <div className="relative bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 shrink-0 print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-[#113366] dark:text-white">
              Dashboard de KPIs
            </h2>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Visão Executiva: {dadosFiltrados.length} registros analisados.</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={exportarCSV} className="flex items-center gap-2 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
              <Download size={16}/> Baixar CSV
            </button>
            <button onClick={exportarPDF} className="flex items-center gap-2 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
              <Printer size={16}/> Salvar PDF
            </button>
            <button onClick={limparFiltros} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#EE4D2D] transition-colors ml-2">
              <Eraser size={16} /> Limpar Filtros
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 bg-slate-50 dark:bg-[#15171e] p-4 rounded-xl border border-slate-100 dark:border-gray-800">
          <div className="flex flex-col lg:col-span-1"><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><MapPin size={12}/> Regional</label><select name="regional" value={filtros.regional} onChange={handleChange} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm"><option value="">Todas</option>{opcoes.regionais.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <div className="flex flex-col lg:col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Search size={12}/> Station</label><select name="station" value={filtros.station} onChange={handleChange} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm"><option value="">Todas</option>{opcoes.stations.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          
          <div className="flex flex-col lg:col-span-1 relative" ref={turnoMenuRef}>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
              <Clock size={12}/> Turnos
            </label>
            <div 
              className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm cursor-pointer flex justify-between items-center shadow-sm"
              onClick={() => setIsTurnoMenuOpen(!isTurnoMenuOpen)}
            >
              <span className="truncate mr-2 font-medium">
                {filtros.turno.length === 0 ? 'Todos' : filtros.turno.join(', ')}
              </span>
              <ChevronDown size={14} className={`transition-transform text-slate-400 ${isTurnoMenuOpen ? 'rotate-180' : ''}`} />
            </div>

            {isTurnoMenuOpen && (
              <div className="absolute top-[100%] left-0 w-full mt-1 bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto py-1">
                {opcoes.turnos.map(t => (
                  <label key={t} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer text-sm font-medium text-slate-700 dark:text-gray-200 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={filtros.turno.includes(t)}
                      onChange={() => toggleTurno(t)}
                      className="rounded border-slate-300 text-[#0055A5] focus:ring-[#0055A5] w-4 h-4 cursor-pointer"
                    />
                    {t}
                  </label>
                ))}
                {opcoes.turnos.length === 0 && <div className="p-3 text-xs text-slate-400 text-center">Nenhum turno</div>}
              </div>
            )}
          </div>
          
          <div className="flex flex-col lg:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Hash size={12}/> Semana / Mês</label>
            <div className="flex gap-2">
              <select name="semana" value={filtros.semana} onChange={handleChange} className="w-1/2 bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm"><option value="">Semana</option>{opcoes.semanas.map(o => <option key={o} value={o}>{o}</option>)}</select>
              <select name="mes" value={filtros.mes} onChange={handleChange} className="w-1/2 bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm"><option value="">Mês</option>{MESES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            </div>
          </div>

          <div className="flex flex-col lg:col-span-1"><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><CalendarDays size={12}/> Início</label><input type="date" name="dataInicio" value={filtros.dataInicio} onChange={handleChange} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm" /></div>
          <div className="flex flex-col lg:col-span-1"><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><CalendarDays size={12}/> Fim</label><input type="date" name="dataFim" value={filtros.dataFim} onChange={handleChange} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm" /></div>
        </div>
      </div>

      {/* 🔥 MUDANÇA AQUI: Removido o z-10 para que o gráfico expandido não fique preso atrás do filtro */}
      <div className="flex-1 overflow-y-auto print:overflow-visible">
        <Visualizations data={dadosFiltrados} rawData={rawData} />
      </div>

    </div>
  );
}