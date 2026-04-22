import React from 'react';
import OnePageSPI from './charts/OnePageSPI';
import OnePageMensal from './charts/OnePageMensal'; // 🚀 Novo Import
import AtPisoDiarioTable from './charts/AtPisoDiarioTable';
import FleetGapCharts from './charts/FleetGapCharts';
import CapFleetCharts from './charts/CapFleetCharts';
import VolumeDispatchCharts from './charts/VolumeDispatchCharts';
import AtPisoCharts from './charts/AtPisoCharts';

const Visualizations = ({ data, rawData, dashData, atPisoData, baseData }) => {
  return (
    <div className="space-y-10 pb-10">
      
      {/* Visão Semanal (W-17) */}
      <OnePageSPI rawData={rawData} baseData={baseData} />

      {/* 🚀 Visão Mensal Acumulada (Abril / 2026) */}
      <OnePageMensal rawData={rawData} baseData={baseData} />
      
      <AtPisoDiarioTable data={data} rawData={rawData} atPisoData={atPisoData} />
      
      {/* Fleet Gap consumindo a aba BASE */}
      <FleetGapCharts baseData={baseData} />

      {data && data.length > 0 ? (
        <>
          <CapFleetCharts data={data} />
          <VolumeDispatchCharts data={data} />
          <AtPisoCharts data={data} />
        </>
      ) : (
        <div className="p-8 text-center font-bold text-slate-400 bg-white dark:bg-[#1f232d] rounded-2xl border border-slate-200 dark:border-gray-800">
          Nenhum registro operacional para os filtros selecionados.
        </div>
      )}

    </div>
  );
};

export default Visualizations;