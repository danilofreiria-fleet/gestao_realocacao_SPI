import React from 'react';
import OnePageSPI from './charts/OnePageSPI';
import AtPisoDiarioTable from './charts/AtPisoDiarioTable';
import FleetGapCharts from './charts/FleetGapCharts';
import CapFleetCharts from './charts/CapFleetCharts';
import VolumeDispatchCharts from './charts/VolumeDispatchCharts';
import AtPisoCharts from './charts/AtPisoCharts';

const Visualizations = ({ data, rawData, dashData, atPisoData, baseData }) => {
  return (
    <div className="space-y-10 pb-10">
      
      <OnePageSPI rawData={rawData} dashData={dashData} />
      
      <AtPisoDiarioTable data={data} rawData={rawData} atPisoData={atPisoData} />
      
      {/* Fleet Gap agora só precisa do baseData! */}
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