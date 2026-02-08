import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useGasSettlements } from "../../hooks/useGasSettlements";
import AddNewGasSettlementsData from "./AddNewGasSettlementsData";
import { db } from "../../firebase/config";
import { doc, updateDoc } from "firebase/firestore";
import { NumericFormat } from "react-number-format";

const GasSettlementsDataList = () => {
  const navigate = useNavigate();
  const { settlementsData, stations, loading, reloadData, priceOfGas } =
    useGasSettlements();
  const [openModal, setOpenModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedData, setSelectedData] = useState(null);
  const [uniquePeriods, setUniquePeriods] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingData, setEditingData] = useState([]);
  const [saving, setSaving] = useState(false);

  // Новые состояния для режима редактирования
  const [useCalculatedConsumption, setUseCalculatedConsumption] =
    useState(false);
  const [actualConsumptionDays, setActualConsumptionDays] = useState("");
  const [remainingDays, setRemainingDays] = useState("");

  // Функция для получения количества дней в месяце
  const getDaysInMonth = (yearMonth) => {
    if (!yearMonth) return 30;
    const [year, month] = yearMonth.split("-").map(Number);
    return new Date(year, month, 0).getDate();
  };

  // Функция для получения текущей цены на газ для периода
  const getCurrentPriceForPeriod = (period) => {
    if (!priceOfGas || !priceOfGas.length) return 0;

    const periodDate = new Date(period + "-01");
    const priceEntry = priceOfGas.find((p) => {
      const startDate = new Date(p.startDate + "-01");
      const endDate = p.endDate ? new Date(p.endDate + "-01") : new Date();
      return periodDate >= startDate && periodDate <= endDate;
    });

    return priceEntry ? priceEntry.price : 0;
  };

  // Расчет производных полей с учетом режима расчета
  const calculateDerivedFields = (data, period) => {
    const getNumericValue = (value) => {
      if (!value || value === "" || value === null || value === undefined)
        return null;
      const cleaned = String(value).replace(/\s/g, "").replace(/,/g, ".");
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    };

    const gasByMeter = getNumericValue(data.gasByMeter);
    const confError = getNumericValue(data.confError);
    const lowPress = getNumericValue(data.lowPress);
    const gasAct = getNumericValue(data.gasAct);
    const limit = getNumericValue(data.limit);
    const actualConsumption = getNumericValue(data.actualConsumption);

    const price = getCurrentPriceForPeriod(period);

    // Расчет суммы лимита
    const amountOfLimit = limit !== null ? limit * price : null;

    // Расчет общего газа в зависимости от режима
    let totalGas = null;
    let calculatedMonthlyConsumption = null;

    if (data.useCalculatedConsumption) {
      // Режим расчетного потребления
      const daysValue = parseInt(actualConsumptionDays) || 0;
      const daysInMonth = getDaysInMonth(period);

      if (actualConsumption !== null && daysValue > 0) {
        calculatedMonthlyConsumption =
          (actualConsumption / daysValue) * daysInMonth;
        totalGas = calculatedMonthlyConsumption;
      }
    } else {
      // Обычный режим
      const values = [gasByMeter, confError, lowPress, gasAct];
      const validValues = values.filter((val) => val !== null);

      if (validValues.length > 0) {
        totalGas = validValues.reduce((sum, val) => sum + val, 0);
      }
    }

    // Расчет суммы газа
    const amountOfGas = totalGas !== null ? totalGas * price : null;

    return {
      totalGas,
      amountOfLimit,
      amountOfGas,
      price,
      calculatedMonthlyConsumption,
    };
  };

  // Функция для расчета сальдо на начало редактируемого месяца
  const calculateBalanceForPeriod = (
    stationId,
    period,
    stationsData,
    allSettlementsData,
  ) => {
    // Находим станцию в mainData
    const station = stationsData.find(
      (s) => s.id && s.id.toString() === stationId.toString(),
    );

    if (!station) {
      console.log(`Станция с ID ${stationId} не найдена`);
      return 0;
    }

    let balance = parseFloat(station.startBalance) || 0;
    const currentPeriodDate = new Date(period + "-01");

    // Если у станции нет startDate, используем начало текущего месяца
    const startPeriodDate = station.startDate
      ? new Date(station.startDate + "-01")
      : new Date(period + "-01");

    console.log(
      `Расчет сальдо для станции ${stationId} (${station.name}) за период ${period}`,
    );
    console.log(`Начальное сальдо из базы: ${balance}`);

    // Если текущий период раньше стартового периода, возвращаем стартовый баланс
    if (currentPeriodDate < startPeriodDate) {
      console.log(
        `Текущий период ${period} раньше стартового ${station.startDate}, возвращаем ${balance}`,
      );
      return balance;
    }

    // Получаем все данные для этой станции
    const stationSettlements = allSettlementsData.filter(
      (item) =>
        item.stationId &&
        item.stationId.toString() === stationId.toString() &&
        item.period,
    );

    // Сортируем по дате периода (от старых к новым)
    const sortedData = [...stationSettlements].sort((a, b) => {
      const dateA = new Date(a.period + "-01");
      const dateB = new Date(b.period + "-01");
      return dateA - dateB;
    });

    console.log(
      `Найдено ${sortedData.length} записей для станции ${stationId}`,
    );

    // Рассчитываем баланс для всех периодов до редактируемого (не включая его)
    for (const dataItem of sortedData) {
      const itemDate = new Date(dataItem.period + "-01");

      // Если период позже или равен текущему редактируемому периоду, останавливаемся
      if (itemDate >= currentPeriodDate) {
        console.log(
          `Пропускаем период ${dataItem.period} (текущий или будущий)`,
        );
        break;
      }

      // Используем amountOfGas, если оно есть и не равно 0, иначе amountOfLimit
      const gasAmount =
        dataItem.amountOfGas !== undefined &&
        dataItem.amountOfGas !== null &&
        dataItem.amountOfGas !== 0
          ? parseFloat(dataItem.amountOfGas) || 0
          : parseFloat(dataItem.amountOfLimit) || 0;

      const payment = parseFloat(dataItem.payment) || 0;

      const oldBalance = balance;
      balance = balance + gasAmount - payment;

      console.log(`Период ${dataItem.period}: 
        amountOfGas=${dataItem.amountOfGas}, 
        amountOfLimit=${dataItem.amountOfLimit}, 
        использовано=${gasAmount}, 
        payment=${payment}, 
        сальдо ${oldBalance} -> ${balance}`);
    }

    console.log(`Итоговое сальдо на начало периода ${period}: ${balance}`);
    return balance;
  };

  // Функция для обновления уникальных периодов
  const updateUniquePeriods = (data) => {
    if (data.length > 0) {
      const periodsMap = {};
      data.forEach((item) => {
        if (item.period) {
          periodsMap[item.period] = true;
        }
      });

      const periods = Object.keys(periodsMap)
        .sort((a, b) => new Date(b + "-01") - new Date(a + "-01"))
        .map((period) => {
          const date = new Date(period + "-01");
          return {
            period,
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            monthName: date.toLocaleString("ru", { month: "long" }),
          };
        });

      setUniquePeriods(periods);
    } else {
      setUniquePeriods([]);
    }
  };

  useEffect(() => {
    console.log("Settlements data updated:", settlementsData.length);
    updateUniquePeriods(settlementsData);
  }, [settlementsData, refreshKey]);

  // Эффект для расчета оставшихся дней в режиме редактирования
  useEffect(() => {
    if (selectedData?.period && actualConsumptionDays !== "") {
      const daysInMonth = getDaysInMonth(selectedData.period);
      const days = parseInt(actualConsumptionDays) || 0;
      const remaining = daysInMonth - days;
      setRemainingDays(remaining >= 0 ? remaining.toString() : "0");
    } else {
      setRemainingDays("");
    }
  }, [selectedData?.period, actualConsumptionDays]);

  const handleView = (period) => {
    const dataForPeriod = settlementsData.filter(
      (item) => item.period === period,
    );
    console.log(dataForPeriod);

    setSelectedData({
      period,
      data: dataForPeriod,
    });
    setViewModal(true);
  };

  const handleEdit = (period) => {
    const dataForPeriod = settlementsData.filter(
      (item) => item.period === period,
    );

    // Проверяем, есть ли в данных режим расчетного потребления
    const hasCalculatedConsumption = dataForPeriod.some(
      (item) => item.useCalculatedConsumption === true,
    );

    if (hasCalculatedConsumption) {
      // Получаем данные для режима расчета
      const firstItemWithCalc = dataForPeriod.find(
        (item) => item.useCalculatedConsumption === true,
      );
      setUseCalculatedConsumption(true);
      setActualConsumptionDays(
        firstItemWithCalc?.actualConsumptionDays?.toString() || "",
      );
    } else {
      setUseCalculatedConsumption(false);
      setActualConsumptionDays("");
    }

    setSelectedData({
      period,
      data: dataForPeriod,
    });

    // Создаем копию данных для редактирования с рассчитанным сальдо на начало
    const editingDataWithBalance = dataForPeriod.map((item) => {
      const startBalance = calculateBalanceForPeriod(
        item.stationId,
        period,
        stations,
        settlementsData,
      );

      return {
        ...item,
        calculatedStartBalance: startBalance,
      };
    });

    setEditingData(editingDataWithBalance);
    setEditModal(true);
  };

  // Обработка изменений в форме редактирования
  const handleEditChange = (index, field, value) => {
    const newEditingData = [...editingData];

    // NumericFormat передает нам числовое значение через floatValue
    const numericValue = value || 0;

    newEditingData[index] = {
      ...newEditingData[index],
      [field]: numericValue,
    };

    // Пересчитываем производные поля
    const derived = calculateDerivedFields(
      newEditingData[index],
      selectedData.period,
    );

    newEditingData[index] = {
      ...newEditingData[index],
      totalGas: derived.totalGas,
      amountOfGas: derived.amountOfGas,
      calculatedMonthlyConsumption: derived.calculatedMonthlyConsumption,
    };

    // Пересчитываем amountOfLimit на основе лимита и текущей цены
    if (field === "limit") {
      const price = getCurrentPriceForPeriod(selectedData.period);
      newEditingData[index].amountOfLimit = numericValue * price;
    }

    setEditingData(newEditingData);
  };

  // Обработка изменений режима расчета
  const handleModeChange = (e) => {
    const newMode = e.target.checked;
    setUseCalculatedConsumption(newMode);

    // Обновляем данные при смене режима
    if (editingData.length > 0) {
      const newEditingData = editingData.map((item) => {
        const updatedItem = {
          ...item,
          useCalculatedConsumption: newMode,
        };

        const derived = calculateDerivedFields(
          updatedItem,
          selectedData.period,
        );

        return {
          ...updatedItem,
          totalGas: derived.totalGas,
          amountOfGas: derived.amountOfGas,
          calculatedMonthlyConsumption: derived.calculatedMonthlyConsumption,
        };
      });

      setEditingData(newEditingData);
    }
  };

  // Сохранение отредактированных данных
  const handleSaveEdit = async () => {
    if (!selectedData || !editingData.length) return;

    setSaving(true);

    try {
      // 1. Получаем ссылку на документ main в коллекции gasSettlements
      const mainDocRef = doc(db, "gasSettlements", "main");

      // 2. Получаем текущие данные
      const currentData = [...settlementsData];

      // 3. Обновляем данные в массиве currentData
      editingData.forEach((editedItem) => {
        const index = currentData.findIndex(
          (item) =>
            item.period === editedItem.period &&
            item.stationId === editedItem.stationId,
        );

        if (index !== -1) {
          const price = getCurrentPriceForPeriod(editedItem.period);
          const derived = calculateDerivedFields(editedItem, editedItem.period);

          const updatedItem = {
            ...currentData[index],
            ...editedItem,
            amountOfLimit: (editedItem.limit || 0) * price,
            amountOfGas: derived.amountOfGas,
            totalGas: derived.totalGas,
            calculatedMonthlyConsumption: derived.calculatedMonthlyConsumption,
            useCalculatedConsumption: useCalculatedConsumption,
            actualConsumptionDays: useCalculatedConsumption
              ? parseInt(actualConsumptionDays)
              : null,
            updatedAt: new Date().toISOString(),
          };

          // Удаляем временные поля перед сохранением
          delete updatedItem.calculatedStartBalance;

          currentData[index] = updatedItem;
        }
      });

      // 4. Сохраняем обновленные данные в Firebase
      await updateDoc(mainDocRef, {
        data: currentData,
        updatedAt: new Date().toISOString(),
      });

      // 5. Обновляем локальные данные
      await reloadData();
      setRefreshKey((prev) => prev + 1);

      // 6. Закрываем модальное окно
      setEditModal(false);
      alert("Данные успешно сохранены!");
    } catch (error) {
      console.error("Ошибка при сохранении данных:", error);
      alert("Ошибка при сохранении данных: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Обработка закрытия модального окна добавления данных
  const handleAddModalClose = async () => {
    setOpenModal(false);
    await reloadData();
    setRefreshKey((prev) => prev + 1);
  };

  // Функция для принудительного обновления данных
  const handleRefresh = async () => {
    await reloadData();
    setRefreshKey((prev) => prev + 1);
  };

  const filteredPeriods = uniquePeriods.filter(
    (period) =>
      period.monthName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      period.year.toString().includes(searchTerm),
  );

  if (loading && settlementsData.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-1">
            Список введенных данных
          </h2>
          <p className="text-gray-600">
            Просмотр и управление историческими данными
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-gray-500">
              Всего периодов: {uniquePeriods.length} • Всего записей:{" "}
              {settlementsData.length}
            </span>
            <button
              onClick={handleRefresh}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              title="Обновить данные"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Обновить
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/gassettlements")}
            className="bg-gray-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:bg-gray-700 transition-colors"
          >
            ← Назад
          </motion.button>
          <motion.button
            onClick={() => setOpenModal(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl shadow-md hover:from-blue-700 hover:to-blue-800 transition-all"
          >
            + Добавление новых данных
          </motion.button>
        </div>
      </div>

      {/* Поле поиска */}
      <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Поиск по месяцу или году..."
            className="w-full pl-10 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Индикатор загрузки */}
      {loading && settlementsData.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-2xl">
          <div className="flex items-center gap-2 text-blue-700">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
            <span className="text-sm">Обновление данных...</span>
          </div>
        </div>
      )}

      {/* ТАБЛИЦА СО СПИСКОМ ПЕРИОДОВ */}
      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
              <tr>
                <th className="p-4 text-left font-semibold text-gray-700">№</th>
                <th className="p-4 text-left font-semibold text-gray-700">
                  Год
                </th>
                <th className="p-4 text-left font-semibold text-gray-700">
                  Месяц
                </th>
                <th className="p-4 text-left font-semibold text-gray-700">
                  Количество записей
                </th>
                <th className="p-4 text-left font-semibold text-gray-700">
                  Режим расчета
                </th>
                <th className="p-4 text-left font-semibold text-gray-700">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPeriods.length > 0 ? (
                filteredPeriods.map((item, index) => {
                  const dataForPeriod = settlementsData.filter(
                    (d) => d.period === item.period,
                  );
                  const count = dataForPeriod.length;
                  const hasCalculatedConsumption = dataForPeriod.some(
                    (d) => d.useCalculatedConsumption === true,
                  );

                  return (
                    <motion.tr
                      key={`${item.period}-${refreshKey}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className={`border-t hover:bg-blue-50 transition-colors ${
                        index % 2 === 0 ? "bg-gray-50" : "bg-white"
                      }`}
                    >
                      <td className="p-4 font-medium">{index + 1}</td>
                      <td className="p-4">
                        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 font-medium">
                          {item.year}
                        </div>
                      </td>
                      <td className="p-4 font-medium text-gray-800">
                        {item.monthName}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{count}</span>
                          <span className="text-gray-500">заправок</span>
                        </div>
                      </td>
                      <td className="p-4">
                        {hasCalculatedConsumption ? (
                          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800 font-medium">
                            <svg
                              className="w-3 h-3 mr-1"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Расчетный
                          </div>
                        ) : (
                          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 font-medium">
                            <svg
                              className="w-3 h-3 mr-1"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Обычный
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleView(item.period)}
                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                            Просмотр
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleEdit(item.period)}
                            className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center gap-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                            Редактировать
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <div className="text-gray-400 mb-4">
                      <svg
                        className="w-16 h-16 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-600 mb-2">
                      {searchTerm
                        ? "По вашему запросу ничего не найдено"
                        : "Нет введенных данных"}
                    </h3>
                    <p className="text-gray-400 mb-4">
                      {searchTerm
                        ? "Попробуйте изменить поисковый запрос"
                        : "Добавьте данные для начала работы"}
                    </p>
                    {!searchTerm && (
                      <motion.button
                        onClick={() => setOpenModal(true)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Добавить первые данные
                      </motion.button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredPeriods.length > 0 && (
          <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center text-sm text-gray-600">
            <div>
              <span className="font-medium">Показано:</span>{" "}
              {filteredPeriods.length} из {uniquePeriods.length} периодов
            </div>
            <div>
              <span className="font-medium">Записей:</span>{" "}
              {settlementsData.length}
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно добавления данных */}
      <AnimatePresence>
        {openModal && (
          <AddNewGasSettlementsData
            open={openModal}
            onClose={handleAddModalClose}
          />
        )}
      </AnimatePresence>

      {/* Модальное окно просмотра данных */}
      <AnimatePresence>
        {viewModal && selectedData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
            >
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-1">
                      Данные за{" "}
                      {new Date(selectedData.period + "-01").toLocaleString(
                        "ru",
                        {
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </h3>
                    <p className="text-blue-100 text-sm">
                      {selectedData.data.length} заправок, период:{" "}
                      {selectedData.period}
                    </p>
                    {/* Отображение режима расчета */}
                    {selectedData.data.some(
                      (d) => d.useCalculatedConsumption,
                    ) && (
                      <p className="text-blue-100 text-sm mt-1">
                        <svg
                          className="w-4 h-4 inline mr-1"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Режим: Расчетное потребление
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setViewModal(false)}
                    className="text-white hover:bg-blue-800 p-2 rounded-full transition-colors"
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

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-1 gap-4">
                  {selectedData.data.map((item, index) => {
                    const station = stations.find(
                      (s) =>
                        s.id && s.id.toString() === item.stationId.toString(),
                    );

                    return (
                      <motion.div
                        key={`${item.stationId}-${item.period}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-gray-50 rounded-xl p-4 border border-gray-200"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium text-lg text-blue-600">
                              {station?.name || "Неизвестно"}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {station?.landmark || "Нет ориентира"}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">
                              ID: {item.stationId}
                            </div>
                            {item.useCalculatedConsumption && (
                              <div className="text-xs text-purple-600 font-medium mt-1">
                                <svg
                                  className="w-3 h-3 inline mr-1"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Расчетный режим
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                          {/* Лимит */}
                          <div className="bg-white p-3 rounded-lg border">
                            <div className="text-sm text-gray-500 mb-1">
                              Лимит
                            </div>
                            <div className="font-mono font-medium">
                              {item.limit ? (
                                <NumericFormat
                                  value={item.limit}
                                  displayType="text"
                                  thousandSeparator=" "
                                  decimalScale={0}
                                />
                              ) : (
                                "-"
                              )}
                            </div>
                          </div>

                          {/* Сумма по лимиту */}
                          <div className="bg-white p-3 rounded-lg border">
                            <div className="text-sm text-gray-500 mb-1">
                              Сумма по лимиту
                            </div>
                            <div className="font-mono font-medium">
                              {item.amountOfLimit ? (
                                <NumericFormat
                                  value={item.amountOfLimit}
                                  displayType="text"
                                  thousandSeparator=" "
                                  decimalScale={0}
                                  suffix=" сум"
                                />
                              ) : (
                                "-"
                              )}
                            </div>
                          </div>

                          {/* Фактическое потребление газа (только в расчетном режиме) */}
                          {item.useCalculatedConsumption && (
                            <div className="bg-white p-3 rounded-lg border">
                              <div className="text-sm text-gray-500 mb-1">
                                Факт. потребление
                              </div>
                              <div className="font-mono font-medium">
                                {item.actualConsumption ? (
                                  <NumericFormat
                                    value={item.actualConsumption}
                                    displayType="text"
                                    thousandSeparator=" "
                                    decimalScale={0}
                                  />
                                ) : (
                                  "-"
                                )}
                              </div>
                            </div>
                          )}

                          {/* Расчетное потребление газа в месяц (только в расчетном режиме) */}
                          {item.useCalculatedConsumption && (
                            <div className="bg-white p-3 rounded-lg border">
                              <div className="text-sm text-gray-500 mb-1">
                                Расчет на месяц
                              </div>
                              <div className="font-mono font-medium">
                                {item.calculatedMonthlyConsumption ? (
                                  <NumericFormat
                                    value={item.calculatedMonthlyConsumption}
                                    displayType="text"
                                    thousandSeparator=" "
                                    decimalScale={0}
                                  />
                                ) : (
                                  "-"
                                )}
                              </div>
                            </div>
                          )}

                          {/* Всего получено газа */}
                          <div className="bg-white p-3 rounded-lg border">
                            <div className="text-sm text-gray-500 mb-1">
                              Всего получено газа
                            </div>
                            <div className="font-mono font-medium">
                              {item.totalGas ? (
                                <NumericFormat
                                  value={item.totalGas}
                                  displayType="text"
                                  thousandSeparator=" "
                                  decimalScale={0}
                                />
                              ) : (
                                "-"
                              )}
                            </div>

                            {/* Детали только в обычном режиме */}
                            {!item.useCalculatedConsumption && (
                              <div className="mt-3 space-y-1">
                                <div className="text-xs text-gray-500">
                                  В том числе:
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <div className="text-xs text-gray-500">
                                      По счетчику
                                    </div>
                                    <div className="text-xs font-mono">
                                      {item.gasByMeter ? (
                                        <NumericFormat
                                          value={item.gasByMeter}
                                          displayType="text"
                                          thousandSeparator=" "
                                          decimalScale={0}
                                        />
                                      ) : (
                                        "-"
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500">
                                      Ошибка конфигурации
                                    </div>
                                    <div className="text-xs font-mono">
                                      {item.confError ? (
                                        <NumericFormat
                                          value={item.confError}
                                          displayType="text"
                                          thousandSeparator=" "
                                          decimalScale={0}
                                        />
                                      ) : (
                                        "-"
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500">
                                      Низкий предел
                                    </div>
                                    <div className="text-xs font-mono">
                                      {item.lowPress ? (
                                        <NumericFormat
                                          value={item.lowPress}
                                          displayType="text"
                                          thousandSeparator=" "
                                          decimalScale={0}
                                        />
                                      ) : (
                                        "-"
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500">
                                      По акту
                                    </div>
                                    <div className="text-xs font-mono">
                                      {item.gasAct ? (
                                        <NumericFormat
                                          value={item.gasAct}
                                          displayType="text"
                                          thousandSeparator=" "
                                          decimalScale={0}
                                        />
                                      ) : (
                                        "-"
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Сумма всего газа */}
                          <div className="bg-white p-3 rounded-lg border">
                            <div className="text-sm text-gray-500 mb-1">
                              Сумма газа
                            </div>
                            <div className="font-mono font-medium">
                              {item.amountOfGas ? (
                                <NumericFormat
                                  value={item.amountOfGas}
                                  displayType="text"
                                  thousandSeparator=" "
                                  decimalScale={0}
                                  suffix=" сум"
                                />
                              ) : (
                                "-"
                              )}
                            </div>
                          </div>

                          {/* Оплата */}
                          <div className="bg-white p-3 rounded-lg border">
                            <div className="text-sm text-gray-500 mb-1">
                              Оплата
                            </div>
                            <div className="font-mono font-medium text-green-600">
                              {item.payment ? (
                                <NumericFormat
                                  value={item.payment}
                                  displayType="text"
                                  thousandSeparator=" "
                                  decimalScale={0}
                                  suffix=" сум"
                                />
                              ) : (
                                "-"
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Всего заправок в этом периоде: {selectedData.data.length}
                </div>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setViewModal(false);
                      handleEdit(selectedData.period);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Редактировать
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setViewModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Закрыть
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Модальное окно редактирования данных */}
      <AnimatePresence>
        {editModal && selectedData && editingData.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-1">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-8xl max-h-[90vh] overflow-hidden"
            >
              <div className="bg-gradient-to-r from-green-600 to-green-700 p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-1">
                      Редактирование данных за{" "}
                      {new Date(selectedData.period + "-01").toLocaleString(
                        "ru",
                        {
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </h3>
                    <p className="text-green-100 text-sm">
                      Текущая цена на газ:{" "}
                      <NumericFormat
                        value={getCurrentPriceForPeriod(selectedData.period)}
                        displayType="text"
                        thousandSeparator=" "
                        decimalScale={0}
                      />{" "}
                      сум/м³
                    </p>
                  </div>
                  <button
                    onClick={() => setEditModal(false)}
                    className="text-white hover:bg-green-800 p-2 rounded-full transition-colors"
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

              {/* Блок настройки режима расчета */}
              <div className="bg-blue-50 p-1 border-b">
                <div className="max-w-4xl mx-auto">
                  <div className="mb-1">
                    <div className="grid grid-cols-3 gap-4">
                      <label className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          checked={useCalculatedConsumption}
                          onChange={handleModeChange}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          disabled={saving}
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Использовать расчетное потребление
                        </span>
                      </label>
                      <div
                        className={`${!useCalculatedConsumption ? "opacity-50" : ""} flex`}
                      >
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Кол-во дней потр-ния газа
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={
                            selectedData.period
                              ? getDaysInMonth(selectedData.period)
                              : 31
                          }
                          value={actualConsumptionDays}
                          onChange={(e) =>
                            setActualConsumptionDays(e.target.value)
                          }
                          className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            !useCalculatedConsumption
                              ? "bg-gray-100 cursor-not-allowed"
                              : ""
                          }`}
                          disabled={saving || !useCalculatedConsumption}
                        />
                      </div>

                      <div
                        className={`${!useCalculatedConsumption ? "opacity-50" : ""} flex`}
                      >
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Оставшиеся дни месяца
                        </label>
                        <input
                          type="text"
                          value={remainingDays}
                          className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                          readOnly
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[50vh]">
                <div className="space-y-6">
                  {editingData.map((item, index) => {
                    const station = stations.find(
                      (s) =>
                        s.id && s.id.toString() === item.stationId.toString(),
                    );
                    const derived = calculateDerivedFields(
                      item,
                      selectedData.period,
                    );

                    // Рассчитываем сальдо на конец периода
                    const startBalance = item.calculatedStartBalance || 0;
                    const gasAmount =
                      derived.amountOfGas || derived.amountOfLimit || 0;
                    const endBalance =
                      startBalance + gasAmount - (item.payment || 0);

                    return (
                      <div
                        key={`${item.stationId}-${item.period}`}
                        className="bg-gray-50 rounded-xl p-6 border border-gray-200"
                      >
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-bold text-xl text-blue-600">
                              {station?.name || "Неизвестно"}
                            </h4>
                            <p className="text-sm text-gray-500">
                              ID: {item.stationId} • {station?.landmark || ""}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
                          {/* Лимит газа */}
                          <div className="bg-white p-4 rounded-lg border border-gray-300">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Лимит газа (м³)
                            </label>
                            <NumericFormat
                              value={item.limit || ""}
                              onValueChange={(values) => {
                                const { floatValue } = values;
                                handleEditChange(
                                  index,
                                  "limit",
                                  floatValue || "",
                                );
                              }}
                              thousandSeparator=" "
                              decimalScale={0}
                              allowNegative={false}
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg font-mono"
                              placeholder=""
                            />
                          </div>

                          {/* Сумма по лимиту */}
                          <div className="bg-gray-100 p-4 rounded-lg border border-gray-300">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Сумма по лимиту (сум)
                            </label>
                            <div className="text-xl font-mono text-gray-800">
                              {derived.amountOfLimit ? (
                                <NumericFormat
                                  value={derived.amountOfLimit}
                                  displayType="text"
                                  thousandSeparator=" "
                                  decimalScale={0}
                                />
                              ) : (
                                "-"
                              )}
                            </div>
                            {item.limit && (
                              <p className="text-xs text-gray-500 mt-1">
                                <NumericFormat
                                  value={item.limit}
                                  displayType="text"
                                  thousandSeparator=" "
                                  decimalScale={0}
                                />{" "}
                                м³ ×{" "}
                                <NumericFormat
                                  value={derived.price}
                                  displayType="text"
                                  thousandSeparator=" "
                                  decimalScale={0}
                                />{" "}
                                сум/м³
                              </p>
                            )}
                          </div>

                          {/* Поля в зависимости от режима */}
                          {useCalculatedConsumption ? (
                            // Режим расчетного потребления
                            <>
                              <div className="bg-white p-4 rounded-lg border border-gray-300">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  Фактическое потребление газа (м³)
                                </label>
                                <NumericFormat
                                  value={item.actualConsumption || ""}
                                  onValueChange={(values) => {
                                    const { floatValue } = values;
                                    handleEditChange(
                                      index,
                                      "actualConsumption",
                                      floatValue || "",
                                    );
                                  }}
                                  thousandSeparator=" "
                                  decimalScale={0}
                                  allowNegative={false}
                                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg font-mono"
                                  placeholder=""
                                />
                              </div>

                              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  Расчетное потребление газа в месяц (м³)
                                </label>
                                <div className="text-xl font-mono text-gray-800">
                                  {derived.calculatedMonthlyConsumption ? (
                                    <NumericFormat
                                      value={
                                        derived.calculatedMonthlyConsumption
                                      }
                                      displayType="text"
                                      thousandSeparator=" "
                                      decimalScale={0}
                                    />
                                  ) : (
                                    "-"
                                  )}
                                </div>
                                {item.actualConsumption &&
                                  actualConsumptionDays && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      <NumericFormat
                                        value={item.actualConsumption}
                                        displayType="text"
                                        thousandSeparator=" "
                                        decimalScale={0}
                                      />{" "}
                                      ÷ {actualConsumptionDays} ×{" "}
                                      {getDaysInMonth(selectedData.period)}
                                    </p>
                                  )}
                              </div>
                            </>
                          ) : (
                            // Обычный режим
                            <div className="bg-white p-4 rounded-lg border border-gray-300 col-span-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Компоненты газа (м³)
                              </label>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    По счетчику
                                  </label>
                                  <NumericFormat
                                    value={item.gasByMeter || ""}
                                    onValueChange={(values) => {
                                      const { floatValue } = values;
                                      handleEditChange(
                                        index,
                                        "gasByMeter",
                                        floatValue || "",
                                      );
                                    }}
                                    thousandSeparator=" "
                                    decimalScale={0}
                                    allowNegative={false}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    placeholder=""
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    Ошибка конфигурации
                                  </label>
                                  <NumericFormat
                                    value={item.confError || ""}
                                    onValueChange={(values) => {
                                      const { floatValue } = values;
                                      handleEditChange(
                                        index,
                                        "confError",
                                        floatValue || "",
                                      );
                                    }}
                                    thousandSeparator=" "
                                    decimalScale={0}
                                    allowNegative={false}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    placeholder=""
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    Низкий предел
                                  </label>
                                  <NumericFormat
                                    value={item.lowPress || ""}
                                    onValueChange={(values) => {
                                      const { floatValue } = values;
                                      handleEditChange(
                                        index,
                                        "lowPress",
                                        floatValue || "",
                                      );
                                    }}
                                    thousandSeparator=" "
                                    decimalScale={0}
                                    allowNegative={false}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    placeholder=""
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    По акту
                                  </label>
                                  <NumericFormat
                                    value={item.gasAct || ""}
                                    onValueChange={(values) => {
                                      const { floatValue } = values;
                                      handleEditChange(
                                        index,
                                        "gasAct",
                                        floatValue || "",
                                      );
                                    }}
                                    thousandSeparator=" "
                                    decimalScale={0}
                                    allowNegative={false}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    placeholder=""
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Расчетные поля */}
                          <div className="bg-gray-100 p-4 rounded-lg border border-gray-300">
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                              Расчетные значения
                            </label>
                            <div className="space-y-3">
                              <div>
                                <div className="text-xs text-gray-600 mb-1">
                                  Всего газа (м³)
                                </div>
                                <div className="text-lg font-mono font-bold">
                                  {derived.totalGas ? (
                                    <NumericFormat
                                      value={derived.totalGas}
                                      displayType="text"
                                      thousandSeparator=" "
                                      decimalScale={0}
                                    />
                                  ) : (
                                    "-"
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-600 mb-1">
                                  Сумма газа (сум)
                                </div>
                                <div className="text-lg font-mono font-bold text-blue-600">
                                  {derived.amountOfGas ? (
                                    <NumericFormat
                                      value={derived.amountOfGas}
                                      displayType="text"
                                      thousandSeparator=" "
                                      decimalScale={0}
                                    />
                                  ) : (
                                    "-"
                                  )}
                                </div>
                                {derived.totalGas && (
                                  <p className="text-xs text-gray-500">
                                    <NumericFormat
                                      value={derived.totalGas}
                                      displayType="text"
                                      thousandSeparator=" "
                                      decimalScale={0}
                                    />{" "}
                                    м³ ×{" "}
                                    <NumericFormat
                                      value={derived.price}
                                      displayType="text"
                                      thousandSeparator=" "
                                      decimalScale={0}
                                    />{" "}
                                    сум/м³
                                  </p>
                                )}
                              </div>
                              <div>
                                <div className="text-xs text-gray-600 mb-1">
                                  Оплата (сум)
                                </div>
                                <NumericFormat
                                  value={item.payment || ""}
                                  onValueChange={(values) => {
                                    const { floatValue } = values;
                                    handleEditChange(
                                      index,
                                      "payment",
                                      floatValue || "",
                                    );
                                  }}
                                  thousandSeparator=" "
                                  decimalScale={0}
                                  allowNegative={false}
                                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono"
                                  placeholder=""
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Сводка по станции */}
                        <div className="mt-1 pt-1 border-t border-blue-200">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-gray-600">
                                Сальдо на начало:
                              </span>
                              <span
                                className={`font-bold ml-2 ${startBalance >= 0 ? "text-red-600" : "text-green-600"}`}
                              >
                                <NumericFormat
                                  value={startBalance}
                                  displayType="text"
                                  thousandSeparator=" "
                                  decimalScale={0}
                                />{" "}
                                сум
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">
                                Сальдо на конец:
                              </span>
                              <span
                                className={`font-bold ml-2 ${endBalance >= 0 ? "text-red-600" : "text-green-600"}`}
                              >
                                <NumericFormat
                                  value={endBalance}
                                  displayType="text"
                                  thousandSeparator=" "
                                  decimalScale={0}
                                />{" "}
                                сум
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-1 border-t flex justify-between items-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setEditModal(false)}
                  disabled={saving}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Отмена
                </motion.button>

                <div className="flex items-center gap-4">
                  {saving && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                      <span className="text-sm">Сохранение...</span>
                    </div>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Сохранение..." : "Сохранить изменения"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GasSettlementsDataList;
