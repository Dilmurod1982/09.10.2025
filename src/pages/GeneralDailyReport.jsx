import React, { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";
import AddGeneralReportModal from "../components/AddGeneralReportModal";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import UnifiedReportModal from "../components/UnifiedReportModal";

const GeneralDailyReport = () => {
  const userData = useAppStore((state) => state.userData);
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUnifiedModal, setShowUnifiedModal] = useState(false);

  // Генерация месяцев с 2025 года
  const monthOptions = useMemo(() => {
    const options = [];
    const currentDate = new Date();
    const startDate = new Date(2025, 0, 1); // Январь 2025

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
      options.push({ value, label });
    }

    return options.reverse(); // Новые месяцы первыми
  }, []);

  // Загрузка станций
  useEffect(() => {
    const fetchStations = async () => {
      if (!userData?.stations?.length) return;

      try {
        const snapshot = await getDocs(collection(db, "stations"));
        const matched = snapshot.docs
          .filter((doc) => userData.stations.includes(doc.id))
          .map((doc) => ({ id: doc.id, ...doc.data() }));

        setStations(matched);
      } catch (error) {
        console.error("Ошибка при загрузке станций:", error);
      }
    };

    fetchStations();
  }, [userData]);

  // Загрузка отчетов
  useEffect(() => {
    if (!selectedStation || !selectedMonth) {
      setReports([]);
      return;
    }

    const fetchReports = async () => {
      setLoading(true);
      try {
        const [year, month] = selectedMonth.split("-");
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-31`;

        const q = query(
          collection(db, "generalDailyReports"),
          where("stationId", "==", selectedStation.id),
          where("date", ">=", startDate),
          where("date", "<=", endDate),
          orderBy("date", "asc")
        );

        const snapshot = await getDocs(q);
        const reportsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setReports(reportsData);
      } catch (error) {
        console.error("Ошибка при загрузке отчетов:", error);
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [selectedStation, selectedMonth]);

  // Расчет разницы между показаниями счетчика
  const calculateCounterDiff = (currentReport, previousReport) => {
    if (!previousReport) return 0;
    return (
      (currentReport.autopilotReading || 0) -
      (previousReport.autopilotReading || 0)
    );
  };

  // Экспорт в Excel
  const exportToExcel = () => {
    if (!reports.length) return;

    const worksheetData = [
      // Заголовок
      ["Ежедневный общий отчет", "", "", "", "", "", "", "", "", "", ""],
      [
        `Станция: ${selectedStation?.stationName || "Неизвестная станция"}`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      [
        `Период: ${new Date(selectedMonth + "-01").toLocaleDateString("ru-RU", {
          month: "long",
          year: "numeric",
        })}`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      [], // Пустая строка

      // Заголовки таблицы
      [
        "№",
        "Дата",
        "Показание счетчика",
        "Разница счетчика",
        "Цена за м³",
        "Продано через шланги (м³)",
        "Продано партнерам (м³)",
        "Терминал Хумо (₽)",
        "Терминал Узкард (₽)",
        "Наличные (₽)",
        "Создан",
      ],

      // Данные
      ...reports.map((report, index) => {
        const previousReport = index > 0 ? reports[index - 1] : null;
        const counterDiff = calculateCounterDiff(report, previousReport);

        return [
          index + 1,
          new Date(report.date).toLocaleDateString("ru-RU"),
          report.autopilotReading || 0,
          counterDiff,
          report.gasPrice || 0,
          report.hoseTotalGas || 0,
          report.partnerTotalGas || 0,
          report.humoTerminal || 0,
          report.uzcardTerminal || 0,
          report.cashAmount || 0,
          report.createdBy || "Неизвестно",
        ];
      }),

      // Итоги
      [
        "ИТОГИ:",
        "",
        "",
        reports.reduce((sum, report, index) => {
          const previousReport = index > 0 ? reports[index - 1] : null;
          return sum + calculateCounterDiff(report, previousReport);
        }, 0),
        "",
        reports.reduce((sum, report) => sum + (report.hoseTotalGas || 0), 0),
        reports.reduce((sum, report) => sum + (report.partnerTotalGas || 0), 0),
        reports.reduce((sum, report) => sum + (report.humoTerminal || 0), 0),
        reports.reduce((sum, report) => sum + (report.uzcardTerminal || 0), 0),
        reports.reduce((sum, report) => sum + (report.cashAmount || 0), 0),
        "",
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Общий отчет");

    // Авто-ширина колонок
    const colWidths = [
      { wch: 5 }, // №
      { wch: 12 }, // Дата
      { wch: 18 }, // Показание счетчика
      { wch: 15 }, // Разница счетчика
      { wch: 12 }, // Цена за м³
      { wch: 20 }, // Продано через шланги
      { wch: 20 }, // Продано партнерам
      { wch: 15 }, // Терминал Хумо
      { wch: 15 }, // Терминал Узкард
      { wch: 15 }, // Наличные
      { wch: 20 }, // Создан
    ];
    ws["!cols"] = colWidths;

    XLSX.writeFile(
      wb,
      `общий_отчет_${selectedStation?.stationName}_${selectedMonth}.xlsx`
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Ежедневный общий отчет
          </h1>
          <p className="text-gray-600">
            Сводная информация по продажам и показаниям счетчиков
          </p>
        </div>

        {/* Панель управления */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Выбор станции */}
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Выберите станцию
              </label>
              <select
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
                value={selectedStation?.id || ""}
                onChange={(e) => {
                  const station = stations.find((s) => s.id === e.target.value);
                  setSelectedStation(station || null);
                  setSelectedMonth("");
                }}>
                <option value="">Выберите станцию...</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.stationName}
                  </option>
                ))}
              </select>
            </div>

            {/* Выбор месяца */}
            {selectedStation && (
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Выберите месяц
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}>
                  <option value="">Выберите месяц...</option>
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Кнопки действий */}
            <div className="flex gap-3 lg:ml-auto">
              <button
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={() => setShowAddModal(true)}
                disabled={!selectedStation}>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Новый отчет
              </button>

              <button
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={() => setShowUnifiedModal(true)}
                disabled={!selectedStation}>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Единый отчет
              </button>

              <button
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={exportToExcel}
                disabled={!reports.length}>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Экспорт в Excel
              </button>
            </div>
          </div>
        </div>

        {/* Статус загрузки */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Таблица отчетов */}
        {!loading && selectedStation && selectedMonth && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {reports.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        №
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Дата
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Показание счетчика
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Разница
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Цена за м³
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Шланги (м³)
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Партнеры (м³)
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Хумо (₽)
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Узкард (₽)
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Наличные (₽)
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Создан
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reports.map((report, index) => {
                      const previousReport =
                        index > 0 ? reports[index - 1] : null;
                      const counterDiff = calculateCounterDiff(
                        report,
                        previousReport
                      );

                      return (
                        <tr
                          key={report.id}
                          className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(report.date).toLocaleDateString("ru-RU")}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {report.autopilotReading?.toLocaleString() || "0"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold">
                            {counterDiff.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {report.gasPrice?.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                            }) || "0.00"}{" "}
                            ₽
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            {report.hoseTotalGas?.toLocaleString() || "0"} м³
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            {report.partnerTotalGas?.toLocaleString() || "0"} м³
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                            {report.humoTerminal?.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                            }) || "0.00"}{" "}
                            ₽
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                            {report.uzcardTerminal?.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                            }) || "0.00"}{" "}
                            ₽
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-semibold">
                            {report.cashAmount?.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                            }) || "0.00"}{" "}
                            ₽
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {report.createdBy || "Неизвестно"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Отчетов не найдено
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  За выбранный месяц отчетов по станции "
                  {selectedStation.stationName}" нет.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Сообщение о выборе параметров */}
        {!selectedStation && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Выберите станцию
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Для просмотра отчетов выберите станцию из списка выше.
              </p>
            </div>
          </div>
        )}

        {selectedStation && !selectedMonth && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Выберите месяц
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Выберите месяц для просмотра отчетов по станции "
                {selectedStation.stationName}".
              </p>
            </div>
          </div>
        )}
      </div>
      {/* Модальное окно добавления отчета */}
      {showAddModal && selectedStation && (
        <AddGeneralReportModal
          station={selectedStation}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            // Обновляем данные
            setSelectedMonth(selectedMonth);
            setShowAddModal(false);
          }}
        />
      )}
      {/* И модальное окно*/}
      {showUnifiedModal && selectedStation && (
        <UnifiedReportModal
          isOpen={showUnifiedModal}
          onClose={() => setShowUnifiedModal(false)}
          station={selectedStation}
        />
      )}
    </div>
  );
};

export default GeneralDailyReport;
