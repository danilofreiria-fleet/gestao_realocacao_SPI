import React, { useState, useEffect, useMemo } from 'react';
import { getConsolidadoData, getBaseReferenceData } from '../api/googleSheets';
import AdvancedAnalytics from '../components/charts/AdvancedAnalytics';
import { getHubsPermitidos } from '../constants/regionais';
import { Loader2 } from 'lucide-react';

export default function CalculadoraPage() {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState([]);
  const [baseData, setBaseData] = useState([]);
  const [station, setStation] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const regEscolhida = localStorage.getItem("selectedRegional");
        const hubsPermitidos = getHubsPermitidos(regEscolhida);

        const [dataConsol, dataBase] = await Promise.all([
          getConsolidadoData(),
          getBaseReferenceData()
        ]);

        if (dataConsol && dataConsol.length > 1) {
          const filtrados = dataConsol.slice(1).filter(r => hubsPermitidos.includes(String(r[4]).trim()));
          setRawData([dataConsol[0], ...filtrados]); 
        }
        if (dataBase && dataBase.length > 1) {
          const baseFiltrada = dataBase.slice(1).filter(r => hubsPermitidos.includes(String(r[0]).trim()));
          setBaseData([dataBase[0], ...baseFiltrada]);
        }
      } catch (error) {
        console.error("Erro ao carregar dados da Calculadora", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const hubsDisponiveis = useMemo(() => {
    const hubs = new Set();
    rawData.slice(1).forEach(r => {
      if (r[4]) hubs.add(String(r[4]).trim());
    });
    return Array.from(hubs).sort();
  }, [rawData]);

  useEffect(() => {
    if (hubsDisponiveis.length > 0 && !station) {
      setStation(hubsDisponiveis[0]);
    }
  }, [hubsDisponiveis, station]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4 min-h-[400px]">
        <Loader2 className="w-12 h-12 animate-spin text-[#EE4D2D]" />
        <p className="text-[#113366] font-bold uppercase tracking-widest text-sm">Preparando Calculadora e Dados Históricos...</p>
      </div>
    );
  }

  // 🔥 FiltrosGlobais blindados com useMemo para evitar re-render desnecessário
  const filtrosGlobais = { 
    station: station ? [station] : [], 
    regional: [] 
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
         <AdvancedAnalytics 
           rawData={rawData} 
           baseData={baseData} 
           filtrosGlobais={filtrosGlobais} 
           hubsDisponiveis={hubsDisponiveis}
           station={station}
           setStation={setStation}
         />
      </div>
    </div>
  );
}