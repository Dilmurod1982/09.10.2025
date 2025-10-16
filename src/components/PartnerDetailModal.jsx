import React, { useState } from "react";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";

const PartnerDetailModal = ({
  isOpen,
  onClose,
  partner,
  reports,
  selectedStationId,
}) => {
  const [selectedReportType, setSelectedReportType] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  if (!isOpen || !partner) return null;

  // Генерация годов с 2025
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = 2025; year <= currentYear; year++) {
      years.push(year);
    }
    return years.reverse();
  };

  // Генерация месяцев
  const generateMonthOptions = () => {
    const months = [];
    const currentDate = new Date();
    const startDate = new Date(2025, 0, 1);

    for (
      let date = new Date(startDate);
      date <= currentDate;
      date.setMonth(date.getMonth() + 1)
    ) {
      const year = date.getFullYear();
      const month = date.getMonth();
      const value = `${year}-${String(month + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "long",
      });
      months.push({ value, label });
    }
    return months.reverse();
  };

  // Расчет месячных данных
  const calculateMonthlyData = (year) => {
    const monthlyData = {};

    for (let month = 0; month < 12; month++) {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const monthReports = reports.filter((report) => {
        const reportDate = new Date(report.reportDate);
        return reportDate >= firstDay && reportDate <= lastDay;
      });

      let totalSoldM3 = 0;
      let totalAmount = 0;

      monthReports.forEach((report) => {
        const partnerInReport = report.partnerData?.find(
          (p) => p.partnerId === partner.id
        );
        if (partnerInReport) {
          totalSoldM3 += partnerInReport.soldM3 || 0;
          totalAmount += partnerInReport.totalAmount || 0;
        }
      });

      monthlyData[month] = {
        month: new Date(year, month).toLocaleDateString("ru-RU", {
          month: "long",
        }),
        soldM3: totalSoldM3,
        totalAmount: totalAmount,
      };
    }

    return monthlyData;
  };

  // Расчет дневных данных
  const calculateDailyData = (month) => {
    const [year, monthNum] = month.split("-").map(Number);
    const firstDay = new Date(year, monthNum - 1, 1);
    const lastDay = new Date(year, monthNum, 0);

    const dailyReports = reports.filter((report) => {
      const reportDate = new Date(report.reportDate);
      return reportDate >= firstDay && reportDate <= lastDay;
    });

    const dailyData = {};

    dailyReports.forEach((report) => {
      const partnerInReport = report.partnerData?.find(
        (p) => p.partnerId === partner.id
      );
      if (partnerInReport) {
        const date = new Date(report.reportDate).toLocaleDateString("ru-RU");
        dailyData[date] = {
          date,
          soldM3: partnerInReport.soldM3 || 0,
          totalAmount: partnerInReport.totalAmount || 0,
          pricePerM3: partnerInReport.pricePerM3 || 0,
        };
      }
    });

    return Object.values(dailyData).sort(
      (a, b) =>
        new Date(a.date.split(".").reverse().join("-")) -
        new Date(b.date.split(".").reverse().join("-"))
    );
  };

  // Экспорт в Excel
  const exportToExcel = () => {
    let worksheetData = [];
    let fileName = "";

    if (selectedReportType === "monthly") {
      const monthlyData = calculateMonthlyData(selectedYear);
      worksheetData = [
        [`Ежемесячный отчет: ${partner.partnerName}`],
        [`Год: ${selectedYear}`],
        [],
        ["Месяц", "Продано м³", "Сумма, руб."],
      ];

      Object.values(monthlyData).forEach((data) => {
        worksheetData.push([data.month, data.soldM3, data.totalAmount]);
      });

      fileName = `ежемесячный_отчет_${partner.partnerName}_${selectedYear}.xlsx`;
    } else if (selectedReportType === "daily") {
      const dailyData = calculateDailyData(selectedMonth);
      worksheetData = [
        [`Ежедневный отчет: ${partner.partnerName}`],
        [
          `Период: ${new Date(selectedMonth + "-01").toLocaleDateString(
            "ru-RU",
            { month: "long", year: "numeric" }
          )}`,
        ],
        [],
        ["Дата", "Цена за м³", "Продано м³", "Сумма, руб."],
      ];

      dailyData.forEach((data) => {
        worksheetData.push([
          data.date,
          data.pricePerM3,
          data.soldM3,
          data.totalAmount,
        ]);
      });

      fileName = `ежедневный_отчет_${partner.partnerName}_${selectedMonth}.xlsx`;
    }

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Отчет");
    XLSX.writeFile(wb, fileName);
  };

  const monthlyData = calculateMonthlyData(selectedYear);
  const dailyData = calculateDailyData(selectedMonth);
  const yearOptions = generateYearOptions();
  const monthOptions = generateMonthOptions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Шапка */}
        <div className="bg-blue-600 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">{partner.partnerName}</h2>
              <div className="mt-2 space-y-1 text-blue-100">
                <p>
                  <strong>ИНН:</strong>{" "}
                  {partner.partnerDetails?.inn || "Не указан"}
                </p>
                <p>
                  <strong>Руководитель:</strong>{" "}
                  {partner.partnerDetails?.director || "Не указан"}
                </p>
                <p>
                  <strong>Договор №:</strong> {partner.contractNumber}
                </p>
                <p>
                  <strong>Дата договора:</strong>{" "}
                  {partner.contractDate
                    ? new Date(partner.contractDate).toLocaleDateString("ru-RU")
                    : "Не указана"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-blue-200 text-2xl">
              ×
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Выбор типа отчета */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Тип отчета:
            </label>
            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-3">
              <option value="">Выберите тип отчета</option>
              <option value="monthly">Ежемесячный отчет</option>
              <option value="daily">Ежедневный отчет</option>
            </select>
          </div>

          {selectedReportType === "monthly" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Выберите год:
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-xl p-3">
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-left">Месяц</th>
                      <th className="p-3 text-right">Продано м³</th>
                      <th className="p-3 text-right">Сумма, руб.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(monthlyData).map((data, idx) => (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="p-3">{data.month}</td>
                        <td className="p-3 text-right">
                          {data.soldM3.toLocaleString("ru-RU")} м³
                        </td>
                        <td className="p-3 text-right">
                          {data.totalAmount.toLocaleString("ru-RU")} ₽
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedReportType === "daily" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Выберите месяц:
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-3">
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-left">Дата</th>
                      <th className="p-3 text-right">Цена за м³</th>
                      <th className="p-3 text-right">Продано м³</th>
                      <th className="p-3 text-right">Сумма, руб.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.map((data, idx) => (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="p-3">{data.date}</td>
                        <td className="p-3 text-right">
                          {data.pricePerM3.toLocaleString("ru-RU")} ₽
                        </td>
                        <td className="p-3 text-right">
                          {data.soldM3.toLocaleString("ru-RU")} м³
                        </td>
                        <td className="p-3 text-right">
                          {data.totalAmount.toLocaleString("ru-RU")} ₽
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!selectedReportType && (
            <div className="text-center p-8 text-gray-500">
              Выберите тип отчета для просмотра данных
            </div>
          )}
        </div>

        {/* Футер с кнопками */}
        <div className="border-t p-4 bg-gray-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800">
            ← Назад
          </button>

          {selectedReportType && (
            <div className="flex gap-2">
              <button
                onClick={exportToExcel}
                className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700">
                📊 Excel
              </button>
              <button
                onClick={() => window.print()}
                className="bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700">
                🖨️ Печать
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PartnerDetailModal;
