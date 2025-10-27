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
        "Электронные платежи",
        "Контрольная сумма электронных платежей",
        "Процент электронных платежей",
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

        const electronicPercentage = calculatePercentage(
          generalData.controlElectronicSum || 0,
          generalData.electronicPaymentSystem || 0
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
          generalData.electronicPaymentSystem || 0,
          generalData.controlElectronicSum || 0,
          electronicPercentage,
        ];
      }),
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Контроль платежей");

    const colWidths = [
      { wch: 20 },
      { wch: 12 },
      { wch: 15 },
      { wch: 20 },
      { wch: 12 },
      { wch: 15 },
      { wch: 20 },
      { wch: 12 },
      { wch: 15 },
      { wch: 20 },
      { wch: 12 },
      { wch: 20 },
      { wch: 25 },
      { wch: 20 },
    ];

    ws["!cols"] = colWidths;

    const fileName = selectedStation
      ? `Контроль_платежей_${selectedStation.stationName}_${selectedMonth}`
      : `Контроль_платежей_все_станции_${selectedMonth}`;

    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-6 sm:mb-8 text-center sm:text-left">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/20">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Контроль платежей
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Контроль и сверка наличных и безналичных платежей
            </p>
            {isBuxgalter && (
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 mt-2">
                👑 Режим бухгалтера
              </div>
            )}
          </div>
        </div>

        {/* Панель управления */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/20 p-4 sm:p-6 mb-6">
          <div className="space-y-4">
            {/* Первая строка - выбор станции и месяца */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Выбор станции */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  🏪 Заправка
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-200 hover:border-gray-300"
                  value={selectedStation?.id || ""}
                  onChange={(e) => {
                    const station = stations.find(
                      (s) => s.id === e.target.value
                    );
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
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  📅 Месяц *
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-200 hover:border-gray-300"
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
            </div>

            {/* Вторая строка - кнопки действий */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                🛠️ Действия
              </label>

              {/* Кнопки добавления контрольных сумм - только для бухгалтера */}
              {isBuxgalter && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <button
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
                    onClick={() => handleOpenModal("total")}
                    disabled={!selectedStation}>
                    <span className="text-lg">💰</span>
                    <span className="text-sm font-medium">Общая сумма</span>
                  </button>

                  <button
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
                    onClick={() => handleOpenModal("humo")}
                    disabled={!selectedStation}>
                    <span className="text-lg">💳</span>
                    <span className="text-sm font-medium">Humo</span>
                  </button>

                  <button
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
                    onClick={() => handleOpenModal("uzcard")}
                    disabled={!selectedStation}>
                    <span className="text-lg">💳</span>
                    <span className="text-sm font-medium">Uzcard</span>
                  </button>

                  <button
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl hover:from-teal-600 hover:to-teal-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
                    onClick={() => handleOpenModal("electronic")}
                    disabled={!selectedStation}>
                    <span className="text-lg">⚡</span>
                    <span className="text-sm font-medium">Электронные</span>
                  </button>
                </div>
              )}

              {/* Кнопка экспорта - для всех пользователей */}
              <div
                className={`${
                  isBuxgalter ? "pt-3 border-t border-gray-200" : ""
                }`}>
                <button
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale font-medium"
                  onClick={exportToExcel}
                  disabled={!reports.length || !selectedMonth}>
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
        </div>

        {/* Статус загрузки */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-gray-600">Загрузка отчетов...</p>
            </div>
          </div>
        )}

        {/* Таблица */}
        {!loading && selectedMonth && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/20 overflow-hidden">
            {reports.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-gray-50 to-blue-50">
                      <tr>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                          Станция
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                          Дата
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                          Z-отчет
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                          Контр. сумма
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                          %
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                          Humo
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                          Контр. Humo
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                          %
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                          Uzcard
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                          Контр. Uzcard
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                          %
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                          Электронные
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                          Контр. электро
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                          %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
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

                        const electronicPercentage = calculatePercentage(
                          generalData.controlElectronicSum || 0,
                          generalData.electronicPaymentSystem || 0
                        );

                        return (
                          <tr
                            key={report.id}
                            className="hover:bg-blue-50/50 transition-colors duration-150">
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {report.stationName}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(report.reportDate)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                              {generalData.cashAmount?.toLocaleString("ru-RU", {
                                minimumFractionDigits: 2,
                              }) || "0.00"}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                              {generalData.controlTotalSum?.toLocaleString(
                                "ru-RU",
                                {
                                  minimumFractionDigits: 2,
                                }
                              ) || "0.00"}
                            </td>
                            <td
                              className={`px-4 py-4 whitespace-nowrap text-sm font-bold ${
                                totalPercentage >= 100
                                  ? "text-green-600"
                                  : "text-orange-600"
                              }`}>
                              {totalPercentage.toFixed(2)}%
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-purple-600">
                              {generalData.humoTerminal?.toLocaleString(
                                "ru-RU",
                                {
                                  minimumFractionDigits: 2,
                                }
                              ) || "0.00"}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                              {generalData.controlHumoSum?.toLocaleString(
                                "ru-RU",
                                {
                                  minimumFractionDigits: 2,
                                }
                              ) || "0.00"}
                            </td>
                            <td
                              className={`px-4 py-4 whitespace-nowrap text-sm font-bold ${
                                humoPercentage >= 100
                                  ? "text-green-600"
                                  : "text-orange-600"
                              }`}>
                              {humoPercentage.toFixed(2)}%
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-purple-600">
                              {generalData.uzcardTerminal?.toLocaleString(
                                "ru-RU",
                                {
                                  minimumFractionDigits: 2,
                                }
                              ) || "0.00"}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                              {generalData.controlUzcardSum?.toLocaleString(
                                "ru-RU",
                                {
                                  minimumFractionDigits: 2,
                                }
                              ) || "0.00"}
                            </td>
                            <td
                              className={`px-4 py-4 whitespace-nowrap text-sm font-bold ${
                                uzcardPercentage >= 100
                                  ? "text-green-600"
                                  : "text-orange-600"
                              }`}>
                              {uzcardPercentage.toFixed(2)}%
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-teal-600">
                              {generalData.electronicPaymentSystem?.toLocaleString(
                                "ru-RU",
                                {
                                  minimumFractionDigits: 2,
                                }
                              ) || "0.00"}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                              {generalData.controlElectronicSum?.toLocaleString(
                                "ru-RU",
                                {
                                  minimumFractionDigits: 2,
                                }
                              ) || "0.00"}
                            </td>
                            <td
                              className={`px-4 py-4 whitespace-nowrap text-sm font-bold ${
                                electronicPercentage >= 100
                                  ? "text-green-600"
                                  : "text-orange-600"
                              }`}>
                              {electronicPercentage.toFixed(2)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-8 max-w-md mx-auto border border-white/20">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-blue-600"
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
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Отчеты не найдены
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Для выбранных параметров отчеты отсутствуют
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Сообщение о выборе месяца */}
        {!selectedMonth && (
          <div className="text-center py-12">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 max-w-md mx-auto border border-white/20">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-orange-600"
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
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Выберите месяц
              </h3>
              <p className="text-gray-600 text-sm">
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
