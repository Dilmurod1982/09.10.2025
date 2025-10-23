import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import ControlSumModal from "../components/ControlSumModal";

const ControlPayments = () => {
  const userData = useAppStore((state) => state.userData);
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Проверка роли пользователя
  const isBuxgalter = userData?.role === "buxgalter";

  // Генерация месяцев
  const monthOptions = useMemo(() => {
    const options = [];
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
      options.push({ value, label });
    }

    return options.reverse();
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
    if (!selectedMonth) {
      setReports([]);
      return;
    }

    const fetchReports = async () => {
      setLoading(true);
      try {
        const [year, month] = selectedMonth.split("-");
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-31`;

        let q;

        if (selectedStation) {
          // Загрузка для конкретной станции
          q = query(
            collection(db, "unifiedDailyReports"),
            where("stationId", "==", selectedStation.id),
            where("reportDate", ">=", startDate),
            where("reportDate", "<=", endDate),
            orderBy("reportDate", "asc")
          );
        } else {
          // Загрузка для всех станций пользователя
          const stationIds = userData?.stations || [];
          if (stationIds.length === 0) {
            setReports([]);
            return;
          }

          q = query(
            collection(db, "unifiedDailyReports"),
            where("stationId", "in", stationIds),
            where("reportDate", ">=", startDate),
            where("reportDate", "<=", endDate),
            orderBy("reportDate", "asc")
          );
        }

        const snapshot = await getDocs(q);
        const reportsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Добавляем информацию о станции к каждому отчету
        const reportsWithStationInfo = await Promise.all(
          reportsData.map(async (report) => {
            const stationInfo =
              stations.find((s) => s.id === report.stationId) ||
              (await getStationInfo(report.stationId));
            return {
              ...report,
              stationName: stationInfo?.stationName || "Неизвестная станция",
            };
          })
        );

        setReports(reportsWithStationInfo);
      } catch (error) {
        console.error("Ошибка при загрузке отчетов:", error);
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [selectedStation, selectedMonth, refreshTrigger, userData, stations]);

  // Функция для получения информации о станции
  const getStationInfo = async (stationId) => {
    try {
      const stationDoc = await getDocs(doc(db, "stations", stationId));
      return stationDoc.exists()
        ? { id: stationId, ...stationDoc.data() }
        : null;
    } catch (error) {
      console.error("Ошибка получения информации о станции:", error);
      return null;
    }
  };

  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Расчет процента по новым формулам
  const calculatePercentage = (controlSum, actualSum) => {
    if (!actualSum || actualSum === 0) return 0;
    const percentage = (controlSum / actualSum) * 100;
    return Math.round(percentage * 100) / 100;
  };

  // Открытие модального окна
  const handleOpenModal = (type) => {
    setModalType(type);
    setShowModal(true);
  };

  // Обновление данных после сохранения
  const handleSaveSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Экспорт в Excel
  const exportToExcel = () => {
    if (!reports.length) return;

    const worksheetData = [
      ["Контроль платежей"],
      [
        selectedStation
          ? `Станция: ${selectedStation.stationName}`
          : `Все станции пользователя`,
      ],
      [
        `Период: ${new Date(selectedMonth + "-01").toLocaleDateString("ru-RU", {
          month: "long",
          year: "numeric",
        })}`,
      ],
      [],
      [
        "Станция",
        "Дата",
        "Z-отчет",
        "Общая контрольная сумма",
        "Процент",
        "Сумма Humo",
        "Контрольная сумма Humo",
        "Процент Humo",
        "Сумма Uzcard",
        "Контрольная сумма Uzcard",
        "Процент Uzcard",
      ],
      ...reports.map((report) => {
        const generalData = report.generalData || {};

        const totalPercentage = calculatePercentage(
          generalData.controlTotalSum || 0,
          generalData.cashAmount || 0
        );

        const humoPercentage = calculatePercentage(
          generalData.controlHumoSum || 0,
          generalData.humoTerminal || 0
        );

        const uzcardPercentage = calculatePercentage(
          generalData.controlUzcardSum || 0,
          generalData.uzcardTerminal || 0
        );

        return [
          report.stationName,
          formatDate(report.reportDate),
          generalData.cashAmount || 0,
          generalData.controlTotalSum || 0,
          totalPercentage,
          generalData.humoTerminal || 0,
          generalData.controlHumoSum || 0,
          humoPercentage,
          generalData.uzcardTerminal || 0,
          generalData.controlUzcardSum || 0,
          uzcardPercentage,
        ];
      }),
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Контроль платежей");

    const colWidths = [
      { wch: 20 }, // Станция
      { wch: 12 }, // Дата
      { wch: 15 }, // Z-отчет
      { wch: 20 }, // Общая контрольная сумма
      { wch: 12 }, // Процент
      { wch: 15 }, // Сумма Humo
      { wch: 20 }, // Контрольная сумма Humo
      { wch: 12 }, // Процент Humo
      { wch: 15 }, // Сумма Uzcard
      { wch: 20 }, // Контрольная сумма Uzcard
      { wch: 12 }, // Процент Uzcard
    ];

    ws["!cols"] = colWidths;

    const fileName = selectedStation
      ? `Контроль_платежей_${selectedStation.stationName}_${selectedMonth}`
      : `Контроль_платежей_все_станции_${selectedMonth}`;

    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Контроль платежей
          </h1>
          <p className="text-gray-600">
            Контроль и сверка наличных и безналичных платежей
          </p>
          {/* {isBuxgalter && (
            <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Режим бухгалтера
            </div>
          )} */}
        </div>

        {/* Панель управления */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Выбор станции */}
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Заправка
              </label>
              <select
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
                value={selectedStation?.id || ""}
                onChange={(e) => {
                  const station = stations.find((s) => s.id === e.target.value);
                  setSelectedStation(station || null);
                }}>
                <option value="">Все заправки</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.stationName}
                  </option>
                ))}
              </select>
            </div>

            {/* Выбор месяца */}
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Месяц *
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

            {/* Кнопки действий */}
            <div className="flex flex-wrap gap-3 lg:ml-auto">
              {/* Кнопки добавления контрольных сумм - только для бухгалтера */}
              {isBuxgalter && (
                <>
                  <button
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    onClick={() => handleOpenModal("total")}
                    disabled={!selectedStation}>
                    Общая контрольная сумма
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    onClick={() => handleOpenModal("humo")}
                    disabled={!selectedStation}>
                    Контрольная сумма Humo
                  </button>
                  <button
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    onClick={() => handleOpenModal("uzcard")}
                    disabled={!selectedStation}>
                    Контрольная сумма Uzcard
                  </button>
                </>
              )}

              {/* Кнопка экспорта - для всех пользователей */}
              <button
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={exportToExcel}
                disabled={!reports.length || !selectedMonth}>
                Экспорт в Excel
              </button>
            </div>
          </div>
        </div>

        {/* Таблица */}
        {!loading && selectedMonth && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {reports.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Станция
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Дата
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Z-ҳисобот
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Общая контрольная сумма
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Процент
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Сумма Humo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Контрольная сумма Humo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Процент
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Сумма Uzcard
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Контрольная сумма Uzcard
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Процент
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reports.map((report) => {
                      const generalData = report.generalData || {};

                      const totalPercentage = calculatePercentage(
                        generalData.controlTotalSum || 0,
                        generalData.cashAmount || 0
                      );

                      const humoPercentage = calculatePercentage(
                        generalData.controlHumoSum || 0,
                        generalData.humoTerminal || 0
                      );

                      const uzcardPercentage = calculatePercentage(
                        generalData.controlUzcardSum || 0,
                        generalData.uzcardTerminal || 0
                      );

                      return (
                        <tr
                          key={report.id}
                          className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {report.stationName}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(report.reportDate)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-semibold">
                            {generalData.cashAmount?.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                            }) || "0.00"}{" "}
                            сўм
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600 font-semibold">
                            {generalData.controlTotalSum?.toLocaleString(
                              "ru-RU",
                              {
                                minimumFractionDigits: 2,
                              }
                            ) || "0.00"}{" "}
                            сўм
                          </td>
                          <td
                            className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${
                              totalPercentage >= 100
                                ? "text-green-600"
                                : "text-orange-600"
                            }`}>
                            {totalPercentage.toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-purple-600">
                            {generalData.humoTerminal?.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                            }) || "0.00"}{" "}
                            сўм
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600 font-semibold">
                            {generalData.controlHumoSum?.toLocaleString(
                              "ru-RU",
                              {
                                minimumFractionDigits: 2,
                              }
                            ) || "0.00"}{" "}
                            сўм
                          </td>
                          <td
                            className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${
                              humoPercentage >= 100
                                ? "text-green-600"
                                : "text-orange-600"
                            }`}>
                            {humoPercentage.toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-purple-600">
                            {generalData.uzcardTerminal?.toLocaleString(
                              "ru-RU",
                              {
                                minimumFractionDigits: 2,
                              }
                            ) || "0.00"}{" "}
                            сўм
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600 font-semibold">
                            {generalData.controlUzcardSum?.toLocaleString(
                              "ru-RU",
                              {
                                minimumFractionDigits: 2,
                              }
                            ) || "0.00"}{" "}
                            сўм
                          </td>
                          <td
                            className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${
                              uzcardPercentage >= 100
                                ? "text-green-600"
                                : "text-orange-600"
                            }`}>
                            {uzcardPercentage.toFixed(2)}%
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
                  Отчеты не найдены
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Для выбранных параметров отчеты отсутствуют
                </p>
              </div>
            )}
          </div>
        )}

        {/* Сообщение о выборе месяца */}
        {!selectedMonth && (
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
                Выберите месяц для просмотра отчетов
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно для добавления контрольных сумм - только для бухгалтера */}
      <AnimatePresence>
        {showModal && modalType && isBuxgalter && (
          <ControlSumModal
            isOpen={showModal}
            onClose={() => {
              setShowModal(false);
              setModalType(null);
            }}
            modalType={modalType}
            stations={stations}
            selectedStation={selectedStation}
            onSaved={handleSaveSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ControlPayments;
