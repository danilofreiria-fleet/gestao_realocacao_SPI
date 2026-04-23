import React from 'react';
import OnePageSPI from './charts/OnePageSPI';
import OnePageMensal from './charts/OnePageMensal'; 
import AtPisoDiarioTable from './charts/AtPisoDiarioTable';
import FleetGapCharts from './charts/FleetGapCharts';
import CapFleetCharts from './charts/CapFleetCharts';
import VolumeDispatchCharts from './charts/VolumeDispatchCharts';
import AtPisoCharts from './charts/AtPisoCharts';
import FirstTripsChart from './charts/FirstTripsChart';

// Recebemos o firstTripsData aqui
const Visualizations = ({ data, rawData, dashData, atPisoData, baseData, firstTripsData, filtrosGlobais }) => {
  return (
    <div className="space-y-10 pb-10">
      
      <OnePageSPI rawData={rawData} baseData={baseData} firstTripsData={firstTripsData} />
      <OnePageMensal rawData={rawData} baseData={baseData} />
      <AtPisoDiarioTable data={data} rawData={rawData} atPisoData={atPisoData} />
      
      {/* Fleet Gap e First Trips coladinhos */}
      <div className="flex flex-col space-y-6">
        <FleetGapCharts baseData={baseData} filtrosGlobais={filtrosGlobais} />
        <FirstTripsChart firstTripsData={firstTripsData} filtrosGlobais={filtrosGlobais} />
      </div>

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