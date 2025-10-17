import React, { useState } from "react";
import StationSelector from "../components/StationSelector";
import HoseReportTable from "../components/HoseReportTable";

const HoseReportsPage = () => {
  const [selectedStation, setSelectedStation] = useState(null);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Ежедневные отчёты по шлангам</h1>
      <StationSelector onSelect={setSelectedStation} />
      <HoseReportTable selectedStation={selectedStation} />
    </div>
  );
};

export default HoseReportsPage;
