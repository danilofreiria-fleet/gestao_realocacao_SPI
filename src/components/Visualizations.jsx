import React from 'react';
import OverviewTable from './charts/OverviewTable';
import OnePageSPI from './charts/OnePageSPI';
import AtPisoDiarioTable from './charts/AtPisoDiarioTable';
import FleetGapCharts from './charts/FleetGapCharts';
import FirstTripsChart from './charts/FirstTripsChart';
import VolumeDispatchCharts from './charts/VolumeDispatchCharts';
import CapFleetCharts from './charts/CapFleetCharts';
import AtPisoCharts from './charts/AtPisoCharts';
import AttentionPointsFeed from './charts/AttentionPointsFeed';
import StatusEvolutionChart from './charts/StatusEvolutionChart';
import FleetHealthCharts from './charts/FleetHealthCharts';
import PackagesAndReallocation from './charts/PackagesAndReallocation'; // 🔥 IMPORTAÇÃO DO COMPONENTE NOVO AQUI!

const Visualizations = ({ 
  activeCategory, 
  data, 
  rawData, 
  dashData, 
  atPisoData, 
  baseData, 
  firstTripsData, 
  historicoFrotaData,
  ofertasModalData,
  filtrosGlobais 
}) => {

  return (
    <div className="space-y-6">
      
      {/* 1. RESUMO (Apenas o Overview) */}
      {activeCategory === 'resumo' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <OverviewTable 
            data={data} 
            rawData={rawData} 
            baseData={baseData} 
            firstTripsData={firstTripsData} 
            filtrosGlobais={filtrosGlobais} 
          />
        </div>
      )}

      {/* 2. ONE PAGE (OnePage Unificado + Tabela de Piso) */}
      {activeCategory === 'onePage' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <OnePageSPI 
            data={data} 
            rawData={rawData} 
            baseData={baseData} 
            firstTripsData={firstTripsData} 
            filtrosGlobais={filtrosGlobais} 
          />
          <AtPisoDiarioTable 
            data={data} 
            rawData={rawData} 
            atPisoData={atPisoData} 
            filtrosGlobais={filtrosGlobais} 
          />
        </div>
      )}

      {/* 3. GESTÃO DE FROTA */}
      {activeCategory === 'frota' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <FleetGapCharts baseData={baseData} filtrosGlobais={filtrosGlobais} />
          <FirstTripsChart firstTripsData={firstTripsData} filtrosGlobais={filtrosGlobais} />
          <StatusEvolutionChart historicoFrotaData={historicoFrotaData} filtrosGlobais={filtrosGlobais} />
        </div>
      )}

      {/* 3.1. SAÚDE DE FROTA */}
      {activeCategory === 'saude' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <FleetHealthCharts 
              rawData={rawData} 
              baseData={baseData} 
              ofertasModalData={ofertasModalData} 
              filtrosGlobais={filtrosGlobais} 
           />
        </div>
      )}

      {/* 4. VOLUMES & SPR */}
      {activeCategory === 'volumes' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <VolumeDispatchCharts data={data} />
        </div>
      )}

      {/* 5. GARGALOS & CAP */}
      {activeCategory === 'gargalos' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <CapFleetCharts data={data} />
           <AtPisoCharts data={data} />
        </div>
      )}

      {/* 6. PACOTES E REALOCAÇÃO (🔥 AGORA RENDEREZIANDO O COMPONENTE DE VERDADE) */}
      {activeCategory === 'pacotes' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <PackagesAndReallocation 
              rawData={rawData} 
              filtrosGlobais={filtrosGlobais} 
           />
        </div>
      )}

      {/* 7. LOGBOOK DE OCORRÊNCIAS (Aba Exclusiva) */}
      {activeCategory === 'ocorrencias' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <AttentionPointsFeed rawData={rawData} filtrosGlobais={filtrosGlobais} />
        </div>
      )}

      {/* MENSAGEM SE NÃO HOUVER DADOS */}
      {(!data || data.length === 0) && !['resumo', 'onePage', 'frota', 'saude', 'pacotes', 'ocorrencias'].includes(activeCategory) && (
        <div className="p-12 text-center font-bold text-slate-400 bg-white dark:bg-[#1f232d] rounded-2xl border border-dashed border-slate-300 dark:border-gray-700">
          Nenhum registro operacional encontrado para os filtros selecionados nesta categoria.
        </div>
      )}

    </div>
  );
};

export default Visualizations;