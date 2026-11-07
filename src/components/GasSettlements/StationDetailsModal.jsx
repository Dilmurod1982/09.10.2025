import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { calculateStartBalance } from "../../utils/calculations";

const StationDetailsModal = ({
  open,
  onClose,
  stationData,
  stations,
  settlementsData,
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [tableData, setTableData] = useState([]);
  const [expandedMonths, setExpandedMonths] = useState({});

  const mainStationData = stationData?.station || {};
  const stationId = mainStationData.id;

  const formatNumber = (num) => {
    return new Intl.NumberFormat("ru-RU").format(num || 0);
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num || 0);
  };

  const formatDecimal = (num) => {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }).format(num || 0);
  };

  const handlePrint = () => {
    const printContent = document.getElementById("station-details-print-area");
    if (!printContent) {
      window.print();
      return;
    }

    const printWindow = window.open("", "", "width=1000,height=800");
    printWindow.document.write(`
      <html>
        <head>
          <title>Детальная информация по станции - ${
            mainStationData.name || ""
          }</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; color: #111; }
            h2 { font-size: 17px; margin-bottom: 4px; }
            h3 { font-size: 13px; margin: 14px 0 6px; color: #1f2937; }
            .subtitle { color: #6b7280; font-size: 11px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 14px; }
            th, td { border: 1px solid #d1d5db; padding: 4px 6px; text-align: left; }
            th { background: #f3f4f6; font-weight: 600; font-size: 10px; }
            td { font-size: 10px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .text-blue { color: #2563eb; }
            .text-green { color: #059669; }
            .text-red { color: #dc2626; }
            .text-orange { color: #ea580c; }
            .text-pink { color: #db2777; }
            .font-mono { font-family: 'Courier New', monospace; }
            .font-bold { font-weight: 700; }
            .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; background: #eff6ff; padding: 10px; border-radius: 6px; border: 1px solid #bfdbfe; }
            .info-item { font-size: 10px; }
            .info-label { color: #6b7280; }
            .info-value { font-weight: 600; }
            .components-box { background: #fef3c7; border: 1px solid #fcd34d; padding: 8px; border-radius: 6px; margin: 6px 0 12px 0; }
            .components-title { font-weight: 700; font-size: 11px; color: #92400e; margin-bottom: 6px; }
            .summary { margin-top: 14px; padding: 10px; background: #f3f4f6; border-radius: 6px; border: 1px solid #e5e7eb; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .summary-item .label { color: #6b7280; font-size: 10px; }
            .summary-item .value { font-weight: 700; font-size: 13px; }
            @media print {
              body { padding: 0; }
              .print-hide { display: none !important; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  useEffect(() => {
    if (!open || !settlementsData || !stationId) return;

    const filteredData = settlementsData.filter(
      (item) =>
        item.stationId &&
        item.stationId.toString() === stationId.toString() &&
        item.period &&
        item.period.startsWith(selectedYear.toString())
    );

    const monthlyData = {};

    filteredData.forEach((item) => {
      if (!item.period) return;
      const month = parseInt(item.period.split("-")[1]);
      monthlyData[month] = item;
    });

    const result = [];

    for (let month = 1; month <= 12; month++) {
      const periodData = monthlyData[month];

      const startOfMonth = new Date(selectedYear, month - 1, 1);
      const startBalance = calculateStartBalance(
        [mainStationData],
        settlementsData,
        startOfMonth,
        stationId.toString()
      );

      if (periodData) {
        const endBalance =
          startBalance +
          (periodData.amountOfGas || 0) -
          (periodData.payment || 0);

        result.push({
          month,
          monthName: new Date(selectedYear, month - 1).toLocaleString("ru", {
            month: "long",
          }),
          startBalance,
          limit: periodData.limit || 0,
          amountOfLimit: periodData.amountOfLimit || 0,
          totalGas: periodData.totalGas || 0,
          gasAct: periodData.gasAct || 0,
          gasActAmount: periodData.gasActAmount || 0,
          actNote: periodData.actNote || "",
          gasByMeter: periodData.gasByMeter || 0,
          confError: periodData.confError || 0,
          lowPress: periodData.lowPress || 0,
          highLimit: periodData.highLimit || 0, // 🔥 НОВОЕ
          amountOfGas: periodData.amountOfGas || 0,
          payment: periodData.payment || 0,
          endBalance,
          hasData: true,
        });
      } else {
        result.push({
          month,
          monthName: new Date(selectedYear, month - 1).toLocaleString("ru", {
            month: "long",
          }),
          startBalance,
          limit: 0,
          amountOfLimit: 0,
          totalGas: 0,
          gasAct: 0,
          gasActAmount: 0,
          actNote: "",
          gasByMeter: 0,
          confError: 0,
          lowPress: 0,
          highLimit: 0, // 🔥
          amountOfGas: 0,
          payment: 0,
          endBalance: startBalance,
          hasData: false,
        });
      }
    }

    setTableData(result);
  }, [open, selectedYear, settlementsData, mainStationData, stationId]);

  const toggleMonth = (month) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [month]: !prev[month],
    }));
  };

  if (!open || !stationData) return null;

  const actsForYear = tableData.filter(
    (r) => r.hasData && (r.gasAct > 0 || r.gasActAmount > 0)
  );

  const totals = tableData.reduce(
    (acc, row) => ({
      limit: acc.limit + (row.limit || 0),
      totalGas: acc.totalGas + (row.totalGas || 0),
      gasAct: acc.gasAct + (row.gasAct || 0),
      gasActAmount: acc.gasActAmount + (row.gasActAmount || 0),
      amountOfGas: acc.amountOfGas + (row.amountOfGas || 0),
      payment: acc.payment + (row.payment || 0),
    }),
    {
      limit: 0,
      totalGas: 0,
      gasAct: 0,
      gasActAmount: 0,
      amountOfGas: 0,
      payment: 0,
    }
  );

  const monthsWithComponents = tableData.filter(
    (r) =>
      r.hasData &&
      (r.gasByMeter > 0 ||
        r.confError > 0 ||
        r.lowPress > 0 ||
        r.highLimit > 0 ||
        r.gasAct > 0 ||
        r.totalGas > 0)
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl w-11/12 max-w-7xl max-h-[90vh] overflow-hidden"
        >
          <div className="flex justify-between items-center p-6 border-b print:hidden">
            <h3 className="text-xl font-semibold text-gray-800">
              Детальная информация по станции
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
              >
                🖨️ Печать
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl w-10 h-10 flex items-center justify-center"
              >
                ×
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
            <div id="station-details-print-area">
              <h2 style={{ display: "none" }}>
                Детальная информация по станции
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 p-6 bg-blue-50 rounded-xl info-grid">
                <div className="space-y-1 info-item">
                  <p className="text-sm text-gray-500 info-label">
                    Название станции
                  </p>
                  <p className="font-semibold text-lg info-value">
                    {mainStationData.name || "—"}
                  </p>
                </div>

                <div className="space-y-1 info-item">
                  <p className="text-sm text-gray-500 info-label">Ориентир</p>
                  <p className="font-semibold info-value">
                    {mainStationData.landmark || "—"}
                  </p>
                </div>

                <div className="space-y-1 info-item">
                  <p className="text-sm text-gray-500 info-label">Область</p>
                  <p className="font-semibold info-value">
                    {mainStationData.region || "—"}
                  </p>
                </div>

                <div className="space-y-1 info-item">
                  <p className="text-sm text-gray-500 info-label">Адрес</p>
                  <p className="font-semibold info-value">
                    {mainStationData.address || "—"}
                  </p>
                </div>

                <div className="space-y-1 info-item">
                  <p className="text-sm text-gray-500 info-label">
                    Название банка
                  </p>
                  <p className="font-semibold info-value">
                    {mainStationData.bank || "—"}
                  </p>
                </div>

                <div className="space-y-1 info-item">
                  <p className="text-sm text-gray-500 info-label">
                    Расчетный счет
                  </p>
                  <p className="font-mono font-semibold info-value">
                    {mainStationData.account || "—"}
                  </p>
                </div>

                <div className="space-y-1 info-item">
                  <p className="text-sm text-gray-500 info-label">МФО</p>
                  <p className="font-mono font-semibold info-value">
                    {mainStationData.mfo || "—"}
                  </p>
                </div>

                <div className="space-y-1 info-item">
                  <p className="text-sm text-gray-500 info-label">ИНН</p>
                  <p className="font-mono font-semibold info-value">
                    {mainStationData.inn || "—"}
                  </p>
                </div>

                <div className="space-y-1 info-item">
                  <p className="text-sm text-gray-500 info-label">ID станции</p>
                  <p className="font-mono font-semibold text-blue-600 info-value">
                    {mainStationData.id || "—"}
                  </p>
                </div>
              </div>

              <div className="mb-6 print:hidden">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Выберите год для отчета
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-48 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {[2023, 2024, 2025, 2026].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "none" }} className="print-year-title">
                <h3>
                  Отчет за {selectedYear} год — {mainStationData.name || ""}
                </h3>
                <p className="subtitle">
                  Ориентир: {mainStationData.landmark || "—"} • Регион:{" "}
                  {mainStationData.region || "—"}
                </p>
              </div>

              <div className="overflow-x-auto bg-white rounded-xl shadow border">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="p-3 text-left font-semibold text-gray-700 border-b text-xs w-8 print:hidden"></th>
                      <th className="p-3 text-left font-semibold text-gray-700 border-b text-xs">
                        Год
                      </th>
                      <th className="p-3 text-left font-semibold text-gray-700 border-b text-xs">
                        Месяц
                      </th>
                      <th className="p-3 text-right font-semibold text-gray-700 border-b text-xs">
                        Сальдо на начало периода сум
                      </th>
                      <th className="p-3 text-right font-semibold text-gray-700 border-b text-xs">
                        Лимит м³
                      </th>
                      <th className="p-3 text-right font-semibold text-gray-700 border-b text-xs">
                        Потреблено м³
                      </th>
                      <th className="p-3 text-right font-semibold text-gray-700 border-b text-xs">
                        в.т.ч по акту м³
                      </th>
                      <th className="p-3 text-right font-semibold text-gray-700 border-b text-xs">
                        в.т.ч по акту сум
                      </th>
                      <th className="p-3 text-right font-semibold text-gray-700 border-b text-xs">
                        Начислено сум
                      </th>
                      <th className="p-3 text-right font-semibold text-gray-700 border-b text-xs">
                        Оплачено сум
                      </th>
                      <th className="p-3 text-right font-semibold text-gray-700 border-b text-xs">
                        Сальдо на конец месяца сум
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, index) => {
                      const isExpanded = expandedMonths[row.month];
                      const hasComponents =
                        row.hasData &&
                        (row.gasByMeter > 0 ||
                          row.confError > 0 ||
                          row.lowPress > 0 ||
                          row.highLimit > 0 ||
                          row.gasAct > 0 ||
                          row.totalGas > 0);

                      return (
                        <React.Fragment key={row.month}>
                          <tr
                            className={`border-t ${
                              index % 2 === 0 ? "bg-gray-50" : "bg-white"
                            } ${
                              hasComponents
                                ? "cursor-pointer hover:bg-blue-50 transition-colors"
                                : ""
                            }`}
                            onClick={() =>
                              hasComponents && toggleMonth(row.month)
                            }
                          >
                            <td className="p-3 text-gray-400 text-xs print:hidden">
                              {hasComponents && (
                                <span className="inline-block transition-transform">
                                  {isExpanded ? "▼" : "▶"}
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-medium">{selectedYear}</td>
                            <td className="p-3 font-medium">
                              {row.monthName.charAt(0).toUpperCase() +
                                row.monthName.slice(1)}
                            </td>
                            <td className="p-3 font-mono text-right">
                              {formatCurrency(row.startBalance)}
                            </td>
                            <td className="p-3 font-mono text-right">
                              {formatNumber(row.limit)}
                            </td>
                            <td className="p-3 font-mono text-right">
                              {formatNumber(row.totalGas)}
                            </td>
                            <td className="p-3 font-mono text-right text-orange-600 font-semibold">
                              {formatNumber(row.gasAct)}
                            </td>
                            <td className="p-3 font-mono text-right text-orange-700 font-semibold">
                              {row.gasActAmount > 0
                                ? formatCurrency(row.gasActAmount)
                                : "-"}
                            </td>
                            <td className="p-3 font-mono text-right text-blue-600 font-semibold">
                              {formatCurrency(row.amountOfGas)}
                            </td>
                            <td className="p-3 font-mono text-right text-green-600 font-semibold">
                              {formatCurrency(row.payment)}
                            </td>
                            <td
                              className={`p-3 font-mono text-right font-bold ${
                                row.endBalance >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formatCurrency(row.endBalance)}
                            </td>
                          </tr>

                          {isExpanded && hasComponents && (
                            <tr className="bg-amber-50/50 print:hidden">
                              <td
                                colSpan={11}
                                className="p-4 border-t border-amber-200"
                              >
                                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-lg">⛽</span>
                                    <span className="font-semibold text-amber-800 text-sm">
                                      Газы по компонентам —{" "}
                                      {row.monthName.charAt(0).toUpperCase() +
                                        row.monthName.slice(1)}{" "}
                                      {selectedYear}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    <div className="bg-white p-3 rounded-lg border border-amber-200">
                                      <div className="text-xs text-gray-500 mb-1">
                                        По счетчику (м³)
                                      </div>
                                      <div className="font-mono font-bold text-sm text-gray-800">
                                        {formatDecimal(row.gasByMeter)}
                                      </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-amber-200">
                                      <div className="text-xs text-gray-500 mb-1">
                                        Ошибка конфигурации (м³)
                                      </div>
                                      <div className="font-mono font-bold text-sm text-gray-800">
                                        {formatDecimal(row.confError)}
                                      </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-amber-200">
                                      <div className="text-xs text-gray-500 mb-1">
                                        Низкий предел (м³)
                                      </div>
                                      <div className="font-mono font-bold text-sm text-gray-800">
                                        {formatDecimal(row.lowPress)}
                                      </div>
                                    </div>
                                    {/* 🔥 Верхний предел (зашкал) */}
                                    <div className="bg-white p-3 rounded-lg border border-pink-200">
                                      <div className="text-xs text-pink-600 font-semibold mb-1">
                                        Верхний предел (зашкал) (м³)
                                      </div>
                                      <div className="font-mono font-bold text-sm text-pink-700">
                                        {formatDecimal(row.highLimit)}
                                      </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-amber-300">
                                      <div className="text-xs text-orange-600 mb-1 font-semibold">
                                        По акту (м³)
                                      </div>
                                      <div className="font-mono font-bold text-sm text-orange-700">
                                        {formatDecimal(row.gasAct)}
                                      </div>
                                      {row.gasActAmount > 0 && (
                                        <div className="text-xs text-orange-600 mt-1">
                                          Сумма:{" "}
                                          {formatCurrency(row.gasActAmount)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-3 bg-white rounded-lg border border-amber-300 p-3 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-amber-800">
                                      Всего газа за месяц:
                                    </span>
                                    <span className="font-mono font-bold text-base text-amber-900">
                                      {formatDecimal(row.totalGas)} м³
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-100 border-t-2 border-blue-300 font-bold">
                      <td className="p-3 text-center text-xs text-blue-800 print:hidden"></td>
                      <td colSpan={2} className="p-3 text-blue-800 text-sm">
                        ИТОГО за {selectedYear}
                      </td>
                      <td className="p-3 font-mono text-right text-blue-800">
                        -
                      </td>
                      <td className="p-3 font-mono text-right text-blue-800">
                        {formatNumber(totals.limit)}
                      </td>
                      <td className="p-3 font-mono text-right text-blue-800">
                        {formatNumber(totals.totalGas)}
                      </td>
                      <td className="p-3 font-mono text-right text-orange-700">
                        {formatNumber(totals.gasAct)}
                      </td>
                      <td className="p-3 font-mono text-right text-orange-700">
                        {formatCurrency(totals.gasActAmount)}
                      </td>
                      <td className="p-3 font-mono text-right text-blue-700">
                        {formatCurrency(totals.amountOfGas)}
                      </td>
                      <td className="p-3 font-mono text-right text-green-700">
                        {formatCurrency(totals.payment)}
                      </td>
                      <td className="p-3 font-mono text-right text-blue-800">
                        -
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Компоненты газов по месяцам (для печати) */}
              {monthsWithComponents.length > 0 && (
                <div className="mt-6 print-show">
                  <h3 className="font-semibold text-gray-800 mb-2 text-sm">
                    ⛽ Газы по компонентам (по месяцам)
                  </h3>
                  <table className="w-full border-collapse text-xs">
                    <thead className="bg-amber-100">
                      <tr>
                        <th className="border border-amber-300 p-2 text-left font-semibold">
                          Месяц
                        </th>
                        <th className="border border-amber-300 p-2 text-right font-semibold">
                          По счетчику (м³)
                        </th>
                        <th className="border border-amber-300 p-2 text-right font-semibold">
                          Ошибка конф. (м³)
                        </th>
                        <th className="border border-amber-300 p-2 text-right font-semibold">
                          Низкий предел (м³)
                        </th>
                        <th className="border border-pink-300 p-2 text-right font-semibold text-pink-700">
                          Верхний предел (зашкал) (м³)
                        </th>
                        <th className="border border-amber-300 p-2 text-right font-semibold">
                          По акту (м³)
                        </th>
                        <th className="border border-amber-300 p-2 text-right font-semibold">
                          Всего (м³)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthsWithComponents.map((row) => (
                        <tr key={row.month} className="bg-white">
                          <td className="border border-amber-200 p-2 font-medium">
                            {row.monthName.charAt(0).toUpperCase() +
                              row.monthName.slice(1)}{" "}
                            {selectedYear}
                          </td>
                          <td className="border border-amber-200 p-2 text-right font-mono">
                            {formatDecimal(row.gasByMeter)}
                          </td>
                          <td className="border border-amber-200 p-2 text-right font-mono">
                            {formatDecimal(row.confError)}
                          </td>
                          <td className="border border-amber-200 p-2 text-right font-mono">
                            {formatDecimal(row.lowPress)}
                          </td>
                          <td className="border border-pink-200 p-2 text-right font-mono text-pink-700 font-semibold">
                            {formatDecimal(row.highLimit)}
                          </td>
                          <td className="border border-amber-200 p-2 text-right font-mono text-orange-700 font-semibold">
                            {formatDecimal(row.gasAct)}
                          </td>
                          <td className="border border-amber-200 p-2 text-right font-mono font-bold">
                            {formatDecimal(row.totalGas)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Блок "Акты" */}
              {actsForYear.length > 0 && (
                <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <h3 className="font-semibold text-amber-800 mb-3 text-sm">
                    📋 Акты за {selectedYear} год
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead className="bg-amber-100">
                        <tr>
                          <th className="border border-amber-300 p-2 text-left font-semibold w-12">
                            №
                          </th>
                          <th className="border border-amber-300 p-2 text-left font-semibold">
                            Период акта
                          </th>
                          <th className="border border-amber-300 p-2 text-right font-semibold">
                            Кол-во газа (м³)
                          </th>
                          <th className="border border-amber-300 p-2 text-right font-semibold">
                            Сумма акта (сум)
                          </th>
                          <th className="border border-amber-300 p-2 text-left font-semibold">
                            Примечание
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {actsForYear.map((row, idx) => (
                          <tr key={row.month} className="bg-white">
                            <td className="border border-amber-200 p-2 text-center font-medium">
                              {idx + 1}
                            </td>
                            <td className="border border-amber-200 p-2 font-medium">
                              {row.monthName.charAt(0).toUpperCase() +
                                row.monthName.slice(1).substring(0, 3)}{" "}
                              {selectedYear}
                            </td>
                            <td className="border border-amber-200 p-2 text-right font-mono text-orange-700 font-semibold">
                              {formatDecimal(row.gasAct)}
                            </td>
                            <td className="border border-amber-200 p-2 text-right font-mono text-orange-700 font-semibold">
                              {row.gasActAmount > 0
                                ? formatCurrency(row.gasActAmount)
                                : "-"}
                            </td>
                            <td className="border border-amber-200 p-2 text-gray-700">
                              {row.actNote || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-6 p-4 bg-gray-50 rounded-xl summary">
                <div className="summary-item">
                  <p className="text-gray-500 label">
                    Сумма начислений за {selectedYear} год:
                  </p>
                  <p className="font-bold text-lg text-blue-600 value">
                    {formatCurrency(totals.amountOfGas)}
                  </p>
                </div>
                <div className="summary-item">
                  <p className="text-gray-500 label">
                    Сумма оплат за {selectedYear} год:
                  </p>
                  <p className="font-bold text-lg text-green-600 value">
                    {formatCurrency(totals.payment)}
                  </p>
                </div>
                <div className="summary-item">
                  <p className="text-gray-500 label">Итоговое сальдо:</p>
                  <p
                    className={`font-bold text-lg value ${
                      tableData[tableData.length - 1]?.endBalance >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatCurrency(
                      tableData[tableData.length - 1]?.endBalance || 0
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default StationDetailsModal;
