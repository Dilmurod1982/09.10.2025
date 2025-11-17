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
import DetailedReportModal from "../components/DetailedReportModal";

const GeneralDailyReport = () => {
  const userData = useAppStore((state) => state.userData);
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [showDetailedModal, setShowDetailedModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Новое состояние для обновления

  // Проверка роли пользователя
  const isOperator = useMemo(() => {
    return userData?.role === "operator";
  }, [userData?.role]);

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

  // Функция для загрузки отчетов
  const fetchReportsData = async () => {
    if (!selectedStation || !selectedMonth) {
      setReports([]);
      return;
    }

    setLoading(true);
    try {
      const [year, month] = selectedMonth.split("-");
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-31`;

      const q = query(
        collection(db, "unifiedDailyReports"),
        where("stationId", "==", selectedStation.id),
        where("reportDate", ">=", startDate),
        where("reportDate", "<=", endDate),
        orderBy("reportDate", "asc")
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

  // Загрузка отчетов при изменении станции, месяца или триггера обновления
  useEffect(() => {
    fetchReportsData();
  }, [selectedStation, selectedMonth, refreshTrigger]);

  // Функция для принудительного обновления списка отчетов
  const refreshReports = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Расчет разницы между показаниями шлангов и счетчика
  const calculateCounterDiff = (report) => {
    const hoseTotal = report.hoseTotalGas || 0;
    const autopilotReading = report.generalData?.autopilotReading || 0;
    return hoseTotal - autopilotReading;
  };

  // Форматирование даты в ДД-ММ-ГГГГ
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Обработчик клика по строке отчета
  const handleReportClick = (report) => {
    setSelectedReport(report);
    setShowDetailedModal(true);
  };

  // Экспорт в Excel
  const exportToExcel = () => {
    if (!reports.length) return;

    const worksheetData = [
      // Заголовок
      ["Кунлик ҳисобот", "", "", "", "", "", "", "", "", "", "", ""],
      [
        `Станция: ${selectedStation?.stationName || "Ноъмалум заправка"}`,
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
        "",
      ],
      [
        `Давр: ${new Date(selectedMonth + "-01").toLocaleDateString("ru-RU", {
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
        "",
      ],
      [], // Пустая строка

      // Заголовки таблицы
      [
        "№",
        "Сана",
        "Ҳисоблагич кўрсаткичи",
        "Фарқи",
        "Жами шланглар (м³)",
        "Жами хамкорлар (м³)",
        "1м³нархи",
        "Терминал Узкард (сўм)",
        "Терминал Хумо (сўм)",
        "ЭТТ (сўм)",
        "Z-ҳисобот (сўм)",
        ...(isOperator ? [] : ["Назорат суммаси"]),
        "Яратилди",
      ],

      // Данные
      ...reports.map((report, index) => {
        const counterDiff = calculateCounterDiff(report);

        const row = [
          index + 1,
          formatDate(report.reportDate),
          report.generalData?.autopilotReading || 0,
          counterDiff,
          report.hoseTotalGas || 0,
          report.partnerTotalM3 || 0,
          report.generalData?.gasPrice || 0,
          report.generalData?.uzcardTerminal || 0,
          report.generalData?.humoTerminal || 0,
          report.generalData?.electronicPaymentSystem || 0,
          report.generalData?.cashAmount || 0,
        ];

        // Добавляем контрольную сумму только если пользователь не оператор
        if (!isOperator) {
          row.push(report.controlSum || 0);
        }

        row.push(report.createdBy || "Номаълум");

        return row;
      }),

      // Итоги
      [
        "ЖАМИ:",
        "",
        "",
        reports.reduce((sum, report) => sum + calculateCounterDiff(report), 0),
        reports.reduce((sum, report) => sum + (report.hoseTotalGas || 0), 0),
        reports.reduce((sum, report) => sum + (report.partnerTotalM3 || 0), 0),
        "",
        reports.reduce(
          (sum, report) => sum + (report.generalData?.uzcardTerminal || 0),
          0
        ),
        reports.reduce(
          (sum, report) => sum + (report.generalData?.humoTerminal || 0),
          0
        ),
        reports.reduce(
          (sum, report) =>
            sum + (report.generalData?.electronicPaymentSystem || 0),
          0
        ),
        reports.reduce(
          (sum, report) => sum + (report.generalData?.cashAmount || 0),
          0
        ),
        ...(isOperator ? [] : [""]),
        "",
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Умумий ҳисобот");

    // Авто-ширина колонок
    const colWidths = [
      { wch: 5 }, // №
      { wch: 12 }, // Дата
      { wch: 18 }, // Показание счетчика
      { wch: 15 }, // Разница счетчика
      { wch: 15 }, // Свод шланги
      { wch: 15 }, // Свод партнеры
      { wch: 12 }, // Цена за м³
      { wch: 15 }, // Терминал Узкард
      { wch: 15 }, // Терминал Хумо
      { wch: 15 }, // ЭТТ
      { wch: 15 }, // Наличные
    ];

    // Добавляем ширину для контрольной суммы если нужно
    if (!isOperator) {
      colWidths.push({ wch: 15 }); // Контрольная сумма
    }

    colWidths.push({ wch: 20 }); // Создан

    ws["!cols"] = colWidths;

    XLSX.writeFile(
      wb,
      `Умумий_хисобот_${selectedStation?.stationName}_${selectedMonth}.xlsx`
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Кунлик ҳисобот
          </h1>
          <p className="text-gray-600">
            Кўрсаткичлар ва сотувлар бўйича йиғма ҳисобот
          </p>
        </div>

        {/* Панель управления */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Выбор станции */}
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Заправкани танланг
              </label>
              <select
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
                value={selectedStation?.id || ""}
                onChange={(e) => {
                  const station = stations.find((s) => s.id === e.target.value);
                  setSelectedStation(station || null);
                  setSelectedMonth("");
                }}>
                <option value="">танланг...</option>
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
                  Ойни танланг
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}>
                  <option value="">танланг...</option>
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
              {/* Показываем кнопку "Ягона ҳисобот" только для операторов */}
              {isOperator && (
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
                  Ягона ҳисобот
                </button>
              )}

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
                Excel га экспорт
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
                        Сана
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Автопилот кўрсаткичи
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Фарқи
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Шланглар (м³)
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Хамкорлар (м³)
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        1м³ нархи
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Узкард (сўм)
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Хумо (сўм)
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        ЭТТ (сўм)
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Z-ҳисобот (сўм)
                      </th>
                      {!isOperator && (
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Назорат суммаси
                        </th>
                      )}
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Яратилди
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reports.map((report, index) => {
                      const counterDiff = calculateCounterDiff(report);

                      return (
                        <tr
                          key={report.id}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => handleReportClick(report)}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(report.reportDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {report.generalData?.autopilotReading?.toLocaleString() ||
                              "0"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold">
                            {counterDiff.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            {report.hoseTotalGas?.toLocaleString() || "0"} м³
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            {report.partnerTotalM3?.toLocaleString() || "0"} м³
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {report.generalData?.gasPrice?.toLocaleString(
                              "ru-RU",
                              {
                                minimumFractionDigits: 2,
                              }
                            ) || "0.00"}{" "}
                            сўм
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                            {report.generalData?.uzcardTerminal?.toLocaleString(
                              "ru-RU",
                              {
                                minimumFractionDigits: 2,
                              }
                            ) || "0.00"}{" "}
                            сўм
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                            {report.generalData?.humoTerminal?.toLocaleString(
                              "ru-RU",
                              {
                                minimumFractionDigits: 2,
                              }
                            ) || "0.00"}{" "}
                            сўм
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                            {report.generalData?.electronicPaymentSystem?.toLocaleString(
                              "ru-RU",
                              {
                                minimumFractionDigits: 2,
                              }
                            ) || "0.00"}{" "}
                            сўм
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-semibold">
                            {report.generalData?.cashAmount?.toLocaleString(
                              "ru-RU",
                              {
                                minimumFractionDigits: 2,
                              }
                            ) || "0.00"}{" "}
                            сўм
                          </td>
                          {!isOperator && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">
                              {report.controlSum?.toLocaleString("ru-RU", {
                                minimumFractionDigits: 2,
                              }) || "0.00"}{" "}
                              сўм
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {report.createdBy || "Ноъмалум"}
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
                  Ҳисоботлар топилмади
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedStation.stationName} заправка бўйича танланган даврга
                  ҳисобот мавжуд эмас
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
                Заправкани танланг
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Ҳисоботни кўриш учун юқорида заправкани танланг.
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
                Ойни танланг
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {selectedStation.stationName} заправка ҳисоботини кўриш учун
                ойни танланг
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
            refreshReports(); // Используем новую функцию обновления
            setShowAddModal(false);
          }}
        />
      )}

      {/* Модальное окно единого отчета */}
      {showUnifiedModal && selectedStation && (
        <UnifiedReportModal
          isOpen={showUnifiedModal}
          onClose={() => setShowUnifiedModal(false)}
          station={selectedStation}
          onSaved={refreshReports} // Передаем исправленную функцию
        />
      )}

      {/* Модальное окно подробного отчета */}
      {showDetailedModal && selectedReport && (
        <DetailedReportModal
          isOpen={showDetailedModal}
          onClose={() => {
            setShowDetailedModal(false);
            setSelectedReport(null);
          }}
          report={selectedReport}
        />
      )}
    </div>
  );
};

export default GeneralDailyReport;
