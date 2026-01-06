import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const DetailedReportModal = ({ isOpen, onClose, report }) => {
  if (!isOpen || !report) return null;

  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Форматирование времени
  const formatTime = (timestamp) => {
    if (!timestamp) return "Неизвестно";
    const date = timestamp.toDate();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // Фильтрация партнеров для печати (только с soldM3 > 0)
  const getFilteredPartnerDataForPrint = () => {
    if (!report.partnerData) return [];
    return report.partnerData.filter((partner) => (partner.soldM3 || 0) > 0);
  };

  // Расчет итогов для отфильтрованных партнеров
  const calculateFilteredPartnerTotals = () => {
    const filteredPartners = getFilteredPartnerDataForPrint();
    return {
      totalM3: filteredPartners.reduce(
        (sum, partner) => sum + (partner.soldM3 || 0),
        0
      ),
      totalAmount: filteredPartners.reduce(
        (sum, partner) => sum + (partner.totalAmount || 0),
        0
      ),
    };
  };

  // Функция для печати
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");

    // Получаем отфильтрованные данные партнеров
    const filteredPartnerData = getFilteredPartnerDataForPrint();
    const partnerTotals = calculateFilteredPartnerTotals();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Подробный отчет за ${formatDate(report.reportDate)}</title>
          <style>
            @page {
              size: A4;
              margin: 0.5cm;
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 10px;
              line-height: 1.2;
              margin: 0;
              padding: 0;
            }
            .print-container {
              max-width: 100%;
              padding: 0;
            }
            .header {
              text-align: center;
              margin-bottom: 8px;
              padding-bottom: 6px;
              border-bottom: 2px solid #2563eb;
            }
            .header h1 {
              font-size: 14px;
              margin: 0 0 3px 0;
              color: #2563eb;
              font-weight: bold;
            }
            .header h2 {
              font-size: 11px;
              margin: 0 0 2px 0;
              color: #374151;
            }
            .header p {
              font-size: 9px;
              margin: 0;
              color: #6b7280;
            }
            .section {
              margin-bottom: 8px;
              page-break-inside: avoid;
            }
            .section h3 {
              font-size: 11px;
              margin: 0 0 4px 0;
              padding-bottom: 2px;
              border-bottom: 1px solid #d1d5db;
              font-weight: bold;
              color: #374151;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 8px;
              margin-bottom: 6px;
            }
            th, td {
              border: 1px solid #9ca3af;
              padding: 3px 4px;
              text-align: left;
            }
            th {
              background-color: #f3f4f6;
              font-weight: bold;
            }
            tfoot td {
              background-color: #f3f4f6;
              font-weight: bold;
            }
            .general-data {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 4px;
              font-size: 8px;
            }
            .data-row {
              display: flex;
              justify-content: space-between;
              padding: 2px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .metadata {
              background-color: #f3f4f6;
              padding: 4px 6px;
              border-radius: 2px;
              font-size: 8px;
              margin-top: 6px;
            }
            .compact-table th,
            .compact-table td {
              padding: 2px 3px;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${generatePrintContent(filteredPartnerData, partnerTotals)}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 100);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Генерация контента для печати
  const generatePrintContent = (filteredPartnerData, partnerTotals) => {
    const calculateDifference = () => {
      const autopilotReading = report.generalData?.autopilotReading || 0;
      const hoseTotalGas = report.hoseTotalGas || 0;
      return hoseTotalGas - autopilotReading;
    };

    return `
      <div class="header">
        <h1> ${formatDate(report.reportDate)} санага батафсил ҳисобот</h1>
        <h2>${report.stationName} заправкаси</h2>
        <p>Ҳисобот яратилган: ${formatDate(
          report.reportDate
        )} кун соат ${formatTime(report.createdAt)}</p>
      </div>

      <div class="section">
        <h3>Шланглар бўйича ҳисобот</h3>
        <table class="compact-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Шланг</th>
              <th>Охирги кўрсаткич</th>
              <th>1 кунлик расход (м³)</th>
            </tr>
          </thead>
          <tbody>
            ${report.hoseData
              ?.map(
                (hose, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${hose.hose}</td>
                <td>${hose.current?.toLocaleString() || "0"}</td>
                <td>${hose.diff?.toLocaleString() || "0"}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align: right; font-weight: bold;">Жами:</td>
              <td style="font-weight: bold;">${
                report.hoseTotalGas?.toLocaleString() || "0"
              } м³</td>
            </tr>
          </tfoot>
        </table>
      </div>

      ${
        filteredPartnerData.length > 0
          ? `
      <div class="section">
        <h3>Хамкорлар бўйича ҳисобот (фаол хамкорлар)</h3>
        <table class="compact-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Хамкор</th>
              <th>1 м³ нархи (сўм)</th>
              <th>Сотилган газ (м³)</th>
              <th>Сотилган газ сумма (сўм)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredPartnerData
              ?.map(
                (partner, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${partner.partnerName}</td>
                <td>${partner.pricePerM3?.toLocaleString() || "0"}</td>
                <td>${partner.soldM3?.toLocaleString() || "0"}</td>
                <td>${partner.totalAmount?.toLocaleString() || "0"}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align: right; font-weight: bold;">Итого:</td>
              <td style="font-weight: bold;">${
                partnerTotals.totalM3.toLocaleString() || "0"
              } м³</td>
              <td style="font-weight: bold;">${
                partnerTotals.totalAmount.toLocaleString() || "0"
              } сўм</td>
            </tr>
          </tfoot>
        </table>
      </div>
      `
          : ""
      }

      <div class="section">
        <h3>Ҳисоботни умумий маълумоти</h3>
        <div class="general-data">
          <div>
            <div class="data-row">
              <span>AutoPilot кўрсаткичи:</span>
              <span><strong>${
                report.generalData?.autopilotReading?.toLocaleString() || "0"
              } м3</strong></span>
            </div>
            <div class="data-row">
              <span>Жами шланглар бўйича сотилди:</span>
              <span><strong>${
                report.hoseTotalGas?.toLocaleString() || "0"
              } м³</strong></span>
            </div>
            <div class="data-row">
              <span>Фарқи:</span>
              <span><strong>${calculateDifference().toLocaleString()} м³</strong></span>
            </div>
            <div class="data-row">
              <span>Жами хамкорларга сотилди:</span>
              <span><strong>${
                report.partnerTotalM3?.toLocaleString() || "0"
              } м³</strong></span>
            </div>
             <div class="data-row">
              <span>Хамкорларга сотилган газ суммаси:</span>
              <span><strong>${
                report.partnerTotalAmount?.toLocaleString() || "0"
              } сўм</strong></span>
            </div>
          </div>
          <div>
            <div class="data-row">
              <span>UzCard терминали:</span>
              <span><strong>${
                report.paymentData?.uzcard?.toLocaleString() || "0"
              } сўм</strong></span>
            </div>
            <div class="data-row">
              <span>Humo терминали:</span>
              <span><strong>${
                report.paymentData?.humo?.toLocaleString() || "0"
              } сўм</strong></span>
            </div>
            <div class="data-row">
              <span>CLICK:</span>
              <span><strong>${
                report.paymentData?.click?.toLocaleString() || "0"
              } сўм</strong></span>
            </div>
            <div class="data-row">
              <span>PayMe:</span>
              <span><strong>${
                report.paymentData?.payme?.toLocaleString() || "0"
              } сўм</strong></span>
            </div>
            <div class="data-row">
              <span>PayNet терминали:</span>
              <span><strong>${
                report.paymentData?.paynet?.toLocaleString() || "0"
              } сўм</strong></span>
            </div>
            <div class="data-row">
              <span>Z ҳисобот:</span>
              <span><strong>${
                report.paymentData?.zhisobot?.toLocaleString() || "0"
              } сўм</strong></span>
            </div>
          </div>
        </div>
      </div>

      <div class="metadata">
        <div style="display: flex; justify-content: space-between;">
          <span><strong>Ҳисоботни яратди:</strong> ${
            report.createdBy || "Неизвестно"
          }</span>
          <span><strong>Ҳисобот яратилган вақт:</strong> ${formatDate(
            report.reportDate
          )} в ${formatTime(report.createdAt)}</span>
        </div>
      </div>
    `;
  };

  // Расчет разницы для отображения на экране
  const calculateDifference = () => {
    const autopilotReading = report.generalData?.autopilotReading || 0;
    const hoseTotalGas = report.hoseTotalGas || 0;
    return hoseTotalGas - autopilotReading;
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Заголовок */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      {formatDate(report.reportDate)} санага батафсил ҳисобот
                    </h2>
                    <p className="text-blue-100 text-lg">
                      {report.stationName} заправкаси
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-white hover:text-blue-200 transition-colors"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Контент для отображения на экране */}
              <div className="flex-1 overflow-auto p-6">
                <div className="space-y-6">
                  {/* Часть шлангов */}
                  <div className="bg-white border border-gray-200 rounded-xl">
                    <div className="bg-gray-50 p-4 border-b">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Шланглар бўйича ҳисобот
                      </h3>
                    </div>
                    <div className="p-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold text-gray-700 border-b">
                                №
                              </th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-700 border-b">
                                Шланг
                              </th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-700 border-b">
                                Охирги кўсарткич
                              </th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-700 border-b">
                                1 кунда сотилган газ (м³)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.hoseData?.map((hose, index) => (
                              <tr
                                key={hose.hose}
                                className="border-b hover:bg-gray-50"
                              >
                                <td className="px-4 py-2">{index + 1}</td>
                                <td className="px-4 py-2 font-medium">
                                  {hose.hose}
                                </td>
                                <td className="px-4 py-2">
                                  {hose.current?.toLocaleString() || "0"}
                                </td>
                                <td className="px-4 py-2 text-green-600 font-semibold">
                                  {hose.diff?.toLocaleString() || "0"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50">
                            <tr>
                              <td
                                colSpan="3"
                                className="px-4 py-2 font-semibold text-right"
                              >
                                Жами:
                              </td>
                              <td className="px-4 py-2 font-semibold text-green-600">
                                {report.hoseTotalGas?.toLocaleString() || "0"}{" "}
                                м³
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Часть партнеров */}
                  {report.hasPartnerData && (
                    <div className="bg-white border border-gray-200 rounded-xl">
                      <div className="bg-gray-50 p-4 border-b">
                        <h3 className="text-lg font-semibold text-gray-800">
                          Хамкорлар бўйича ҳисобот:
                        </h3>
                      </div>
                      <div className="p-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-4 py-2 text-left font-semibold text-gray-700 border-b">
                                  №
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-gray-700 border-b">
                                  Хамкор номи
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-gray-700 border-b">
                                  1 м³ нархи (сўм)
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-gray-700 border-b">
                                  Сотилган газ (м³)
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-gray-700 border-b">
                                  Жами сотилган суммаси (сўм)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {report.partnerData?.map((partner, index) => (
                                <tr
                                  key={partner.partnerId}
                                  className="border-b hover:bg-gray-50"
                                >
                                  <td className="px-4 py-2">{index + 1}</td>
                                  <td className="px-4 py-2 font-medium">
                                    {partner.partnerName}
                                  </td>
                                  <td className="px-4 py-2">
                                    {partner.pricePerM3?.toLocaleString() ||
                                      "0"}
                                  </td>
                                  <td className="px-4 py-2">
                                    {partner.soldM3?.toLocaleString() || "0"}
                                  </td>
                                  <td className="px-4 py-2 text-blue-600 font-semibold">
                                    {partner.totalAmount?.toLocaleString() ||
                                      "0"}{" "}
                                    сўм
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-gray-50">
                              <tr>
                                <td
                                  colSpan="3"
                                  className="px-4 py-2 font-semibold text-right"
                                >
                                  Жами:
                                </td>
                                <td className="px-4 py-2 font-semibold">
                                  {report.partnerTotalM3?.toLocaleString() ||
                                    "0"}{" "}
                                  м³
                                </td>
                                <td className="px-4 py-2 font-semibold text-blue-600">
                                  {report.partnerTotalAmount?.toLocaleString() ||
                                    "0"}{" "}
                                  сўм
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Общие данные */}
                  <div className="bg-white border border-gray-200 rounded-xl">
                    <div className="bg-gray-50 p-4 border-b">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Умумий маълумотлар
                      </h3>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">
                              AutoPilotPro кўрсаткичи:
                            </span>
                            <span className="font-semibold">
                              {report.generalData?.autopilotReading?.toLocaleString() ||
                                "0"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">
                              Шланглар бўйича жами сотилди:
                            </span>
                            <span className="font-semibold text-green-600">
                              {report.hoseTotalGas?.toLocaleString() || "0"} м³
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">
                              Фарқи:
                            </span>
                            <span
                              className={`font-semibold ${
                                calculateDifference() >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {calculateDifference().toLocaleString()} м³
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">
                              Хамкорлар бўйича жами сотилди:
                            </span>
                            <span className="font-semibold text-blue-600">
                              {report.partnerTotalM3?.toLocaleString() || "0"}{" "}
                              м³
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">
                              Хамкорларга сотилган газ суммаси:
                            </span>
                            <span className="font-semibold text-blue-600">
                              {report.partnerTotalAmount?.toLocaleString() ||
                                "0"}{" "}
                              сўм
                            </span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">
                              UzCard терминали:
                            </span>
                            <span className="font-semibold text-purple-600">
                              {report.paymentData?.uzcard?.toLocaleString() ||
                                "0"}{" "}
                              сўм
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">
                              Humo терминали:
                            </span>
                            <span className="font-semibold text-purple-600">
                              {report.paymentData?.humo?.toLocaleString() ||
                                "0"}{" "}
                              сўм
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">
                              CLICK:
                            </span>
                            <span className="font-semibold text-purple-600">
                              {report.paymentData?.click?.toLocaleString() ||
                                "0"}{" "}
                              сўм
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">
                              PayMe:
                            </span>
                            <span className="font-semibold text-purple-600">
                              {report.paymentData?.payme?.toLocaleString() ||
                                "0"}{" "}
                              сўм
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">
                              PayNet:
                            </span>
                            <span className="font-semibold text-purple-600">
                              {report.paymentData?.paynet?.toLocaleString() ||
                                "0"}{" "}
                              сўм
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">
                              Z-ҳисобот:
                            </span>
                            <span className="font-semibold text-orange-600">
                              {report.paymentData?.zhisobot?.toLocaleString() ||
                                "0"}{" "}
                              сўм
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Метаданные */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">
                          Ҳисоботни яратди:{" "}
                        </span>
                        <span className="text-gray-900">
                          {report.createdBy || "Неизвестно"}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Ҳисобот яратилган вақт:{" "}
                        </span>
                        <span className="text-gray-900">
                          {formatDate(report.reportDate)} в{" "}
                          {formatTime(report.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Кнопки */}
              <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Шланглар: {report.hoseData?.length || 0} • Хамкорлар:{" "}
                  {report.partnerData?.length || 0}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Ёпиш
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                      />
                    </svg>
                    Печать
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DetailedReportModal;
