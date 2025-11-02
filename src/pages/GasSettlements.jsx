import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { AddGasQuantityModal, DetailsModal } from "../components";

const GasSettlements = () => {
  const userData = useAppStore((state) => state.userData);
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Годы для выбора
  const yearOptions = useMemo(() => {
    const options = [];
    const currentYear = new Date().getFullYear();
    const startYear = 2025;

    for (let year = startYear; year <= currentYear; year++) {
      options.push({ value: year.toString(), label: year.toString() });
    }

    return options.reverse();
  }, []);

  // Месяцы для выбора
  const monthOptions = [
    { value: "01", label: "Январь" },
    { value: "02", label: "Февраль" },
    { value: "03", label: "Март" },
    { value: "04", label: "Апрель" },
    { value: "05", label: "Май" },
    { value: "06", label: "Июнь" },
    { value: "07", label: "Июль" },
    { value: "08", label: "Август" },
    { value: "09", label: "Сентябрь" },
    { value: "10", label: "Октябрь" },
    { value: "11", label: "Ноябрь" },
    { value: "12", label: "Декабрь" },
  ];

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

  // Получение данных предыдущего месяца
  const getPreviousMonthData = async (year, month) => {
    try {
      let prevMonth = parseInt(month) - 1;
      let prevYear = parseInt(year);

      if (prevMonth === 0) {
        prevYear = prevYear - 1;
        prevMonth = 12;
      }

      const prevMonthStr = String(prevMonth).padStart(2, "0");
      const prevPeriod = `${prevYear}-${prevMonthStr}`;

      const q = query(
        collection(db, "gasSettlements"),
        where("period", "==", prevPeriod)
      );

      const snapshot = await getDocs(q);
      const data = {};

      snapshot.docs.forEach((doc) => {
        const settlement = doc.data();
        data[settlement.stationId] = {
          endBalance: settlement.endBalance || 0,
          period: settlement.period,
        };
      });

      return data;
    } catch (error) {
      console.error("Ошибка загрузки данных предыдущего месяца:", error);
      return {};
    }
  };

  // Получение всех периодов с данными
  const getAllPeriods = async () => {
    try {
      let stationIds = [];
      if (selectedStation) {
        stationIds = [selectedStation];
      } else {
        stationIds = userData?.stations || [];
      }

      if (stationIds.length === 0) return [];

      const q = query(
        collection(db, "gasSettlements"),
        where("stationId", "in", stationIds),
        orderBy("period", "asc")
      );

      const snapshot = await getDocs(q);
      const periodsSet = new Set();

      snapshot.docs.forEach((doc) => {
        const settlement = doc.data();
        periodsSet.add(settlement.period);
      });

      const periods = Array.from(periodsSet).sort();
      console.log("Найдены периоды:", periods);
      return periods;
    } catch (error) {
      console.error("Ошибка получения периодов:", error);
      return [];
    }
  };

  // Синхронизация сальдо с предыдущим месяцем для текущего периода
  const handleSyncBalances = async () => {
    if (!selectedYear || !selectedMonth) {
      toast.error("Выберите год и месяц для синхронизации");
      return;
    }

    setSyncing(true);
    try {
      const prevData = await getPreviousMonthData(selectedYear, selectedMonth);

      if (Object.keys(prevData).length === 0) {
        toast.error("Данные предыдущего месяца не найдены");
        return;
      }

      const syncPromises = settlements.map(async (settlement) => {
        const prevSettlement = prevData[settlement.stationId];

        if (prevSettlement && prevSettlement.endBalance !== undefined) {
          const newStartBalance = prevSettlement.endBalance;
          const newEndBalance =
            newStartBalance +
            (settlement.totalAccruedAmount || 0) -
            (settlement.paid || 0);

          await updateDoc(doc(db, "gasSettlements", settlement.id), {
            startBalance: newStartBalance,
            endBalance: newEndBalance,
            updatedAt: serverTimestamp(),
          });

          return {
            ...settlement,
            startBalance: newStartBalance,
            endBalance: newEndBalance,
          };
        }

        return settlement;
      });

      const updatedSettlements = await Promise.all(syncPromises);
      setSettlements(updatedSettlements);

      const syncedCount = settlements.filter(
        (s) => prevData[s.stationId]
      ).length;
      toast.success(
        `Сальдо синхронизировано для ${syncedCount} станций за ${selectedYear}-${selectedMonth}`
      );
    } catch (error) {
      console.error("Ошибка синхронизации сальдо:", error);
      toast.error("Ошибка при синхронизации сальдо");
    } finally {
      setSyncing(false);
    }
  };

  // Синхронизация всего периода
  const handleSyncAllPeriods = async () => {
    setSyncingAll(true);
    try {
      // Получаем все периоды с данными
      const allPeriods = await getAllPeriods();

      if (allPeriods.length === 0) {
        toast.error("Нет данных для синхронизации");
        return;
      }

      let totalSynced = 0;
      let totalErrors = 0;

      // Синхронизируем каждый период начиная со второго
      for (let i = 1; i < allPeriods.length; i++) {
        const currentPeriod = allPeriods[i];
        const [currentYear, currentMonth] = currentPeriod.split("-");

        // Получаем данные предыдущего месяца
        const prevData = await getPreviousMonthData(currentYear, currentMonth);

        if (Object.keys(prevData).length === 0) {
          console.log(
            `Нет данных предыдущего месяца для периода ${currentPeriod}`
          );
          continue;
        }

        // Получаем settlements текущего периода
        let stationIds = [];
        if (selectedStation) {
          stationIds = [selectedStation];
        } else {
          stationIds = userData?.stations || [];
        }

        const q = query(
          collection(db, "gasSettlements"),
          where("stationId", "in", stationIds),
          where("period", "==", currentPeriod)
        );

        const snapshot = await getDocs(q);
        const currentSettlements = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Синхронизируем каждый settlement текущего периода
        const syncPromises = currentSettlements.map(async (settlement) => {
          const prevSettlement = prevData[settlement.stationId];

          if (prevSettlement && prevSettlement.endBalance !== undefined) {
            const newStartBalance = prevSettlement.endBalance;
            const newEndBalance =
              newStartBalance +
              (settlement.totalAccruedAmount || 0) -
              (settlement.paid || 0);

            await updateDoc(doc(db, "gasSettlements", settlement.id), {
              startBalance: newStartBalance,
              endBalance: newEndBalance,
              updatedAt: serverTimestamp(),
            });

            totalSynced++;
            return true;
          }

          return false;
        });

        await Promise.all(syncPromises);

        // Небольшая задержка между периодами чтобы не перегружать систему
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      toast.success(
        `Синхронизировано ${totalSynced} записей за ${
          allPeriods.length - 1
        } периодов`
      );

      // Обновляем текущие данные если синхронизировали текущий период
      if (selectedYear && selectedMonth) {
        const currentPeriod = `${selectedYear}-${selectedMonth}`;
        if (allPeriods.includes(currentPeriod)) {
          setRefreshTrigger((prev) => prev + 1);
        }
      }
    } catch (error) {
      console.error("Ошибка синхронизации всего периода:", error);
      toast.error("Ошибка при синхронизации всего периода");
    } finally {
      setSyncingAll(false);
    }
  };

  // Проверка возможности синхронизации
  const canSync = settlements.length > 0 && selectedYear && selectedMonth;

  // Загрузка данных расчетов
  useEffect(() => {
    if (!selectedYear || !selectedMonth) {
      setSettlements([]);
      return;
    }

    const fetchSettlements = async () => {
      setLoading(true);
      try {
        const period = `${selectedYear}-${selectedMonth}`;

        let stationIds = [];
        if (selectedStation) {
          stationIds = [selectedStation];
        } else {
          stationIds = userData?.stations || [];
        }

        if (stationIds.length === 0) {
          setSettlements([]);
          return;
        }

        const q = query(
          collection(db, "gasSettlements"),
          where("stationId", "in", stationIds),
          where("period", "==", period),
          orderBy("stationName", "asc")
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setSettlements([]);
        } else {
          const settlementsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setSettlements(settlementsData);
        }
      } catch (error) {
        console.error("Ошибка при загрузке расчетов:", error);
        setSettlements([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSettlements();
  }, [
    selectedStation,
    selectedYear,
    selectedMonth,
    stations,
    userData,
    refreshTrigger,
  ]);

  // Обновление данных после сохранения
  const handleSaveSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Открытие модального окна с деталями
  const handleRowClick = (settlement) => {
    setSelectedSettlement(settlement);
    setShowDetailsModal(true);
  };

  // Форматирование чисел
  const formatNumber = (number) => {
    const num = parseFloat(number) || 0;
    return num.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Экспорт в Excel
  const handleExportToExcel = () => {
    toast.success("Функция экспорта в Excel будет реализована позже");
  };

  // Добавление оплаты
  const handleAddPayment = () => {
    toast.success("Функция добавления оплаты будет реализована позже");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Расчеты по получаемому газу
          </h1>
          <p className="text-gray-600">Расчеты станций с рай/горгазами</p>
        </div>

        {/* Панель управления */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Выбор станции */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Станция
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}>
                <option value="">Все станции</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.stationName}
                  </option>
                ))}
              </select>
            </div>

            {/* Выбор года */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Год *
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}>
                <option value="">Выберите год...</option>
                {yearOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Выбор месяца */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Месяц *
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            <div className="flex items-end gap-2">
              <button
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setShowAddModal(true)}
                disabled={!selectedYear || !selectedMonth}>
                Добавление количества газа
              </button>
            </div>
          </div>

          {/* Дополнительные кнопки */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleAddPayment}
              disabled={!selectedYear || !selectedMonth}>
              Добавление оплаты
            </button>
            <button
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleExportToExcel}
              disabled={settlements.length === 0}>
              Экспорт в Excel
            </button>
            <button
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onClick={handleSyncBalances}
              disabled={!canSync || syncing}>
              {syncing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Синхронизация...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Синхронизировать текущий
                </>
              )}
            </button>
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onClick={handleSyncAllPeriods}
              disabled={syncingAll}>
              {syncingAll ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Синхронизация всех...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Синхронизировать весь период
                </>
              )}
            </button>
          </div>

          {/* Информация о синхронизации */}
          {settlements.length > 0 && selectedYear && selectedMonth && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                <strong>Синхронизация сальдо:</strong>
                <br />• <strong>Синхронизировать текущий</strong> - обновляет
                сальдо только для выбранного месяца
                <br />• <strong>Синхронизировать весь период</strong> -
                обновляет сальдо для всех месяцев с данными
              </p>
            </div>
          )}
        </div>

        {/* Индикатор загрузки */}
        {(loading || syncing || syncingAll) && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            {(syncing || syncingAll) && (
              <span className="ml-4 text-gray-600">
                {syncingAll
                  ? "Синхронизация всех периодов..."
                  : "Синхронизация текущего месяца..."}
              </span>
            )}
          </div>
        )}

        {/* Таблица расчетов */}
        {!loading &&
          !syncing &&
          !syncingAll &&
          selectedYear &&
          selectedMonth && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {settlements.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          №
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Станция
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Цена газа за 1 м³
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Сальдо на начало месяца
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Лимит
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Всего начислено м³
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Всего начислено
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Оплачено
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Сальдо на конец месяца
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {settlements.map((settlement, index) => (
                        <tr
                          key={settlement.id}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => handleRowClick(settlement)}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {settlement.stationName}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatNumber(settlement.gasPrice)} сўм
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatNumber(settlement.startBalance)} сўм
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatNumber(settlement.limit)} м³
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600">
                            {formatNumber(settlement.totalAccruedM3)} м³
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-semibold">
                            {formatNumber(settlement.totalAccruedAmount)} сўм
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-orange-600">
                            {formatNumber(settlement.paid)} сўм
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold">
                            <span
                              className={
                                settlement.endBalance >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }>
                              {formatNumber(settlement.endBalance)} сўм
                            </span>
                          </td>
                        </tr>
                      ))}
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
                    Данные не найдены
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Для выбранных параметров данные отсутствуют
                  </p>
                </div>
              )}
            </div>
          )}

        {/* Сообщение о выборе параметров */}
        {(!selectedYear || !selectedMonth) &&
          !loading &&
          !syncing &&
          !syncingAll && (
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
                  Выберите параметры
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Выберите год и месяц для просмотра расчетов
                </p>
              </div>
            </div>
          )}
      </div>

      {/* Модальное окно добавления количества газа */}
      <AnimatePresence>
        {showAddModal && (
          <AddGasQuantityModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            stations={stations}
            onSaved={handleSaveSuccess}
          />
        )}
      </AnimatePresence>

      {/* Модальное окно с деталями */}
      <AnimatePresence>
        {showDetailsModal && (
          <DetailsModal
            isOpen={showDetailsModal}
            onClose={() => setShowDetailsModal(false)}
            settlement={selectedSettlement}
            onSaved={handleSaveSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GasSettlements;
