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
import PackagesAndReallocation from './charts/PackagesAndReallocation'; 
import RotationTable from './charts/RotationTable';
import TimeAnalysisCharts from './charts/TimeAnalysisCharts';
import AtPisoClusterTable from './charts/AtPisoClusterTable';

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
  filtrosGlobais,
  atPisoClusterData,
  recusasData // 🔥 1. RECEBEMOS A PROP AQUI
}) => {

  return (
    <div className="space-y-6">
      
      {/* RESUMO (Apenas o Overview) */}
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

      {/* ONE PAGE (OnePage Unificado + Tabela de Piso) */}
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

      {/* GESTÃO DE FROTA */}
      {activeCategory === 'frota' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <FleetGapCharts baseData={baseData} filtrosGlobais={filtrosGlobais} />
          <FirstTripsChart firstTripsData={firstTripsData} filtrosGlobais={filtrosGlobais} />
          <StatusEvolutionChart historicoFrotaData={historicoFrotaData} filtrosGlobais={filtrosGlobais} />
        </div>
      )}

      {/* SAÚDE DE FROTA */}
      {activeCategory === 'saude' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <FleetHealthCharts 
              rawData={rawData} 
              historicoFrotaData={historicoFrotaData} 
              firstTripsData={firstTripsData}          
              recusasData={recusasData} // 🔥 2. PASSAMOS A PROP PARA O GRÁFICO AQUI
              filtrosGlobais={filtrosGlobais} 
           />
        </div>
      )}

      {/* VOLUMES & SPR */}
      {activeCategory === 'volumes' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <VolumeDispatchCharts data={data} />
        </div>
      )}

      {/* ESTUDOS DE CLUSTERS */}
      {activeCategory === 'estudosCluster' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <AtPisoClusterTable atPisoClusterData={atPisoClusterData} filtrosGlobais={filtrosGlobais} />
        </div>
      )}

      {/* GARGALOS & CAP */}
      {activeCategory === 'gargalos' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <CapFleetCharts data={data} />
           <AtPisoCharts data={data} />
        </div>
      )}

      {/* PACOTES E REALOCAÇÃO */}
      {activeCategory === 'pacotes' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <PackagesAndReallocation 
              rawData={rawData} 
              filtrosGlobais={filtrosGlobais} 
           />
        </div>
      )}

      {activeCategory === 'rodizio' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <RotationTable filtrosGlobais={filtrosGlobais} />
        </div>
      )}

      {/* TEMPO DE EXPEDIÇÃO */}
      {activeCategory === 'tempo' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <TimeAnalysisCharts data={data} />
        </div>
      )}

      {/* LOGBOOK DE OCORRÊNCIAS (Aba Exclusiva) */}
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