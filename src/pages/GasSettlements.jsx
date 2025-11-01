import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import AddGasQuantityModal from "./AddGasQuantityModal";

const GasSettlements = () => {
  const userData = useAppStore((state) => state.userData);
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
          </div>
        </div>

        {/* Индикатор загрузки */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Таблица расчетов */}
        {!loading && selectedYear && selectedMonth && (
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
                        className="hover:bg-gray-50 transition-colors">
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
        {(!selectedYear || !selectedMonth) && !loading && (
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
    </div>
  );
};

export default GasSettlements;
