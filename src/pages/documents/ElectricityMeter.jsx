import React from "react";
import DocumentTable from "../../components/DocumentTable";

const ElectricityMeter = () => {
  return (
    <DocumentTable
      docType="electricity_meter"
      docTypeName="Сертификат счетчика электричества"
    />
  );
};

export default ElectricityMeter;
