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

  const [useCalculatedConsumption, setUseCalculatedConsumption] =
    useState(false);
  const [actualConsumptionDays, setActualConsumptionDays] = useState("");
  const [remainingDays, setRemainingDays] = useState("");

  // ====== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======

  const getDaysInMonth = (yearMonth) => {
    if (!yearMonth) return 30;
    const [year, month] = yearMonth.split("-").map(Number);
    return new Date(year, month, 0).getDate();
  };

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

  const getActPrice = (data) => {
    const actVolume = parseFloat(
      String(data.gasAct || "").replace(/[\s,]/g, "")
    );
    const actAmount = parseFloat(
      String(data.gasActAmount || "").replace(/[\s,]/g, "")
    );
    if (
      !isNaN(actVolume) &&
      !isNaN(actAmount) &&
      actVolume !== 0 &&
      actAmount !== 0
    ) {
      return actAmount / actVolume;
    }
    return 0;
  };

  // 🔥 Округление: 38.48659 → 38, 38.5948 → 39
  const roundHalfUp = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 0;
    return Math.round(value);
  };

  // 🔥 Расчёт производных полей
  // Сумма трёх полей (Ошибка конф. + Низкий предел + Верхний предел) округляется до целого
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
    const highLimit = getNumericValue(data.highLimit);
    const gasAct = getNumericValue(data.gasAct);
    const gasActAmount = getNumericValue(data.gasActAmount);
    const limit = getNumericValue(data.limit);
    const actualConsumption = getNumericValue(data.actualConsumption);

    const price = getCurrentPriceForPeriod(period);

    const amountOfLimit = limit !== null ? limit * price : null;

    // 🔥 Сумма трёх полей и округление
    const confLowHighSum =
      (confError !== null ? confError : 0) +
      (lowPress !== null ? lowPress : 0) +
      (highLimit !== null ? highLimit : 0);
    const roundedConfLowHigh = roundHalfUp(confLowHighSum);

    let totalGas = null;
    let calculatedMonthlyConsumption = null;

    if (data.useCalculatedConsumption) {
      const daysValue = parseInt(actualConsumptionDays) || 0;
      const daysInMonth = getDaysInMonth(period);

      if (actualConsumption !== null && daysValue > 0) {
        calculatedMonthlyConsumption =
          (actualConsumption / daysValue) * daysInMonth;
        totalGas = calculatedMonthlyConsumption;
      }
    } else {
      // Всего газа = по счётчику + округлённая сумма трёх полей + акт
      const gasByMeterValue = gasByMeter !== null ? gasByMeter : 0;
      const actVolume = gasAct !== null ? gasAct : 0;

      const hasAny =
        gasByMeter !== null ||
        confError !== null ||
        lowPress !== null ||
        highLimit !== null ||
        gasAct !== null;

      if (hasAny) {
        totalGas = gasByMeterValue + roundedConfLowHigh + actVolume;
      }
    }

    let amountOfGas = null;
    if (data.useCalculatedConsumption) {
      amountOfGas = totalGas !== null ? totalGas * price : null;
    } else {
      const gasByMeterValue = gasByMeter !== null ? gasByMeter : 0;
      const gasWithoutAct = gasByMeterValue + roundedConfLowHigh;
      const amountWithoutAct = gasWithoutAct * price;
      const actAmountValue = gasActAmount !== null ? gasActAmount : 0;

      const hasAny =
        gasByMeter !== null ||
        confError !== null ||
        lowPress !== null ||
        highLimit !== null ||
        gasActAmount !== null ||
        gasAct !== null;

      if (hasAny) {
        amountOfGas = amountWithoutAct + actAmountValue;
      }
    }

    return {
      totalGas,
      amountOfLimit,
      amountOfGas,
      price,
      calculatedMonthlyConsumption,
      gasActAmount,
      confLowHighSum,
      roundedConfLowHigh,
    };
  };

  // 🔥 Расчёт сальдо на начало для периода
  const calculateBalanceForPeriod = (
    stationId,
    period,
    stationsData,
    allSettlementsData
  ) => {
    const station = stationsData.find(
      (s) => s.id && s.id.toString() === stationId.toString()
    );

    if (!station) return 0;

    let balance = parseFloat(station.startBalance) || 0;
    const currentPeriodDate = new Date(period + "-01");

    const startPeriodDate = station.startDate
      ? new Date(station.startDate + "-01")
      : new Date(period + "-01");

    if (currentPeriodDate < startPeriodDate) {
      return balance;
    }

    const stationSettlements = allSettlementsData.filter(
      (item) =>
        item.stationId &&
        item.stationId.toString() === stationId.toString() &&
        item.period
    );

    const sortedData = [...stationSettlements].sort((a, b) => {
      const dateA = new Date(a.period + "-01");
      const dateB = new Date(b.period + "-01");
      return dateA - dateB;
    });

    for (const dataItem of sortedData) {
      const itemDate = new Date(dataItem.period + "-01");

      if (itemDate >= currentPeriodDate) break;

      const gasAmount =
        dataItem.amountOfGas !== undefined &&
        dataItem.amountOfGas !== null &&
        dataItem.amountOfGas !== 0
          ? parseFloat(dataItem.amountOfGas) || 0
          : parseFloat(dataItem.amountOfLimit) || 0;

      const payment = parseFloat(dataItem.payment) || 0;
      balance = balance + gasAmount - payment;
    }

    return balance;
  };

  const updateUniquePeriods = (data) => {
    if (data.length > 0) {
      const periodsMap = {};
      data.forEach((item) => {
        if (item.period) periodsMap[item.period] = true;
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
    updateUniquePeriods(settlementsData);
  }, [settlementsData, refreshKey]);

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

  // ====== ОТКРЫТИЕ МОДАЛОК ======

  const handleView = (period) => {
    const dataForPeriod = settlementsData.filter(
      (item) => item.period === period
    );

    setSelectedData({ period, data: dataForPeriod });
    setViewModal(true);
  };

  const handleEdit = (period) => {
    const dataForPeriod = settlementsData.filter(
      (item) => item.period === period
    );

    const existingStationIds = dataForPeriod.map((item) =>
      item.stationId.toString()
    );

    const missingStations = stations.filter(
      (station) => !existingStationIds.includes(station.id.toString())
    );

    const newEntriesForMissingStations = missingStations.map((station) => {
      return {
        period: period,
        stationId: station.id,
        limit: 0,
        gasByMeter: 0,
        confError: 0,
        lowPress: 0,
        highLimit: 0,
        gasAct: 0,
        gasActAmount: null,
        actNote: null,
        payment: 0,
        actualConsumption: null,
        useCalculatedConsumption: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    const allDataForPeriod = [
      ...dataForPeriod,
      ...newEntriesForMissingStations,
    ];

    const hasCalculatedConsumption = allDataForPeriod.some(
      (item) => item.useCalculatedConsumption === true
    );

    if (hasCalculatedConsumption) {
      const firstItemWithCalc = allDataForPeriod.find(
        (item) => item.useCalculatedConsumption === true
      );
      setUseCalculatedConsumption(true);
      setActualConsumptionDays(
        firstItemWithCalc?.actualConsumptionDays?.toString() || ""
      );
    } else {
      setUseCalculatedConsumption(false);
      setActualConsumptionDays("");
    }

    setSelectedData({ period, data: allDataForPeriod });

    // 🔥 Обогащаем данные расчётным сальдо на начало
    const editingDataWithBalance = allDataForPeriod.map((item) => {
      const startBalance = calculateBalanceForPeriod(
        item.stationId,
        period,
        stations,
        settlementsData
      );

      return {
        ...item,
        calculatedStartBalance: startBalance,
      };
    });

    editingDataWithBalance.sort((a, b) => {
      const idA = parseInt(a.stationId) || 0;
      const idB = parseInt(b.stationId) || 0;
      return idA - idB;
    });

    setEditingData(editingDataWithBalance);
    setEditModal(true);
  };

  // ====== ИЗМЕНЕНИЯ В РЕДАКТОРЕ ======

  const handleEditChange = (index, field, value) => {
    const newEditingData = [...editingData];

    newEditingData[index] = {
      ...newEditingData[index],
      [field]: value,
    };

    const derived = calculateDerivedFields(
      newEditingData[index],
      selectedData.period
    );

    newEditingData[index] = {
      ...newEditingData[index],
      totalGas: derived.totalGas,
      amountOfGas: derived.amountOfGas,
      calculatedMonthlyConsumption: derived.calculatedMonthlyConsumption,
    };

    if (field === "limit") {
      const price = getCurrentPriceForPeriod(selectedData.period);
      const numLimit = parseFloat(value) || 0;
      newEditingData[index].amountOfLimit = numLimit * price;
    }

    setEditingData(newEditingData);
  };

  const handleModeChange = (e) => {
    const newMode = e.target.checked;
    setUseCalculatedConsumption(newMode);

    if (editingData.length > 0) {
      const newEditingData = editingData.map((item) => {
        const updatedItem = {
          ...item,
          useCalculatedConsumption: newMode,
        };

        const derived = calculateDerivedFields(
          updatedItem,
          selectedData.period
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

  // ====== СОХРАНЕНИЕ ======

  const handleSaveEdit = async () => {
    if (!selectedData || !editingData.length) return;

    setSaving(true);

    try {
      const mainDocRef = doc(db, "gasSettlements", "main");
      const currentData = [...settlementsData];

      editingData.forEach((editedItem) => {
        const index = currentData.findIndex(
          (item) =>
            item.period === editedItem.period &&
            item.stationId.toString() === editedItem.stationId.toString()
        );

        const price = getCurrentPriceForPeriod(editedItem.period);
        const derived = calculateDerivedFields(editedItem, editedItem.period);

        const updatedItem = {
          ...editedItem,
          amountOfLimit: (editedItem.limit || 0) * price,
          amountOfGas: derived.amountOfGas,
          totalGas: derived.totalGas,
          calculatedMonthlyConsumption: derived.calculatedMonthlyConsumption,
          highLimit: editedItem.highLimit || null,
          gasActAmount: editedItem.gasActAmount || null,
          actNote: editedItem.actNote || null,
          useCalculatedConsumption: useCalculatedConsumption,
          actualConsumptionDays: useCalculatedConsumption
            ? parseInt(actualConsumptionDays)
            : null,
          updatedAt: new Date().toISOString(),
        };

        // 🔥 Удаляем временное поле перед сохранением
        delete updatedItem.calculatedStartBalance;

        if (index !== -1) {
          currentData[index] = updatedItem;
        } else {
          currentData.push({
            ...updatedItem,
            createdAt: new Date().toISOString(),
          });
        }
      });

      await updateDoc(mainDocRef, {
        data: currentData,
        updatedAt: new Date().toISOString(),
      });

      await reloadData();
      setRefreshKey((prev) => prev + 1);

      setEditModal(false);
      alert("Данные успешно сохранены!");
    } catch (error) {
      console.error("Ошибка при сохранении данных:", error);
      alert("Ошибка при сохранении данных: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddModalClose = async () => {
    setOpenModal(false);
    await reloadData();
    setRefreshKey((prev) => prev + 1);
  };

  const handleRefresh = async () => {
    await reloadData();
    setRefreshKey((prev) => prev + 1);
  };

  const filteredPeriods = uniquePeriods.filter(
    (period) =>
      period.monthName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      period.year.toString().includes(searchTerm)
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
      {/* ====== ЗАГОЛОВОК ====== */}
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
              {settlementsData.length} • Всего станций: {stations.length}
            </span>
            <button
              onClick={handleRefresh}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Обновить
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/gassettlements")}
            className="bg-gray-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:bg-gray-700"
          >
            ← Назад
          </motion.button>
          <motion.button
            onClick={() => setOpenModal(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl shadow-md"
          >
            + Добавление новых данных
          </motion.button>
        </div>
      </div>

      {/* Поиск */}
      <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
        <input
          type="text"
          placeholder="Поиск по месяцу или году..."
          className="w-full p-3 border border-gray-300 rounded-xl"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* ТАБЛИЦА ПЕРИОДОВ */}
      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
              <tr>
                <th className="p-4 text-left">№</th>
                <th className="p-4 text-left">Год</th>
                <th className="p-4 text-left">Месяц</th>
                <th className="p-4 text-left">Количество записей</th>
                <th className="p-4 text-left">Режим расчета</th>
                <th className="p-4 text-left">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredPeriods.length > 0 ? (
                filteredPeriods.map((item, index) => {
                  const dataForPeriod = settlementsData.filter(
                    (d) => d.period === item.period
                  );
                  const count = dataForPeriod.length;
                  const hasCalculatedConsumption = dataForPeriod.some(
                    (d) => d.useCalculatedConsumption === true
                  );
                  const missingStationsCount = stations.length - count;

                  return (
                    <motion.tr
                      key={`${item.period}-${refreshKey}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`border-t hover:bg-blue-50 ${
                        index % 2 === 0 ? "bg-gray-50" : "bg-white"
                      }`}
                    >
                      <td className="p-4 font-medium">{index + 1}</td>
                      <td className="p-4">
                        <span className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 font-medium">
                          {item.year}
                        </span>
                      </td>
                      <td className="p-4 font-medium">{item.monthName}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{count}</span>
                          <span className="text-gray-500">заправок</span>
                          {missingStationsCount > 0 && (
                            <span className="text-xs text-orange-500">
                              (нет данных: {missingStationsCount})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {hasCalculatedConsumption ? (
                          <span className="px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800 font-medium">
                            Расчетный
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 font-medium">
                            Обычный
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleView(item.period)}
                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                          >
                            Просмотр
                          </button>
                          <button
                            onClick={() => handleEdit(item.period)}
                            className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                          >
                            Редактировать
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    {searchTerm ? "Ничего не найдено" : "Нет данных"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* МОДАЛКА ДОБАВЛЕНИЯ */}
      <AnimatePresence>
        {openModal && (
          <AddNewGasSettlementsData
            open={openModal}
            onClose={handleAddModalClose}
          />
        )}
      </AnimatePresence>

      {/* ==================== ПРОСМОТР ==================== */}
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
                  <h3 className="text-xl font-semibold text-white">
                    Данные за{" "}
                    {new Date(selectedData.period + "-01").toLocaleString(
                      "ru",
                      { month: "long", year: "numeric" }
                    )}
                  </h3>
                  <button
                    onClick={() => setViewModal(false)}
                    className="text-white hover:bg-blue-800 p-2 rounded-full"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[70vh]">
                {selectedData.data.map((item, index) => {
                  const station = stations.find(
                    (s) => String(s.id) === String(item.stationId)
                  );
                  const actPrice = getActPrice(item);

                  return (
                    <div
                      key={index}
                      className="bg-gray-50 rounded-xl p-4 border mb-4"
                    >
                      <h4 className="font-medium text-lg text-blue-600">
                        {station?.name || "Неизвестно"}
                      </h4>
                      <p className="text-sm text-gray-500 mb-3">
                        {station?.landmark || ""}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-gray-500">
                            По счётчику
                          </div>
                          <div className="font-mono">
                            {item.gasByMeter || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">
                            Ошибка конф.
                          </div>
                          <div className="font-mono">{item.confError || 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">
                            Низкий предел
                          </div>
                          <div className="font-mono">{item.lowPress || 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-pink-600">
                            Верхний предел
                          </div>
                          <div className="font-mono text-pink-700">
                            {item.highLimit || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-orange-600">
                            По акту (м³)
                          </div>
                          <div className="font-mono text-orange-600">
                            {item.gasAct || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-orange-600">
                            Сумма акта
                          </div>
                          <div className="font-mono text-orange-700">
                            {item.gasActAmount || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-orange-600">
                            Цена акта
                          </div>
                          <div className="font-mono text-orange-700">
                            {actPrice !== 0 ? actPrice.toFixed(2) : "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">
                            Всего газа
                          </div>
                          <div className="font-mono font-bold">
                            {item.totalGas || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">
                            Сумма газа
                          </div>
                          <div className="font-mono text-blue-600 font-bold">
                            {item.amountOfGas || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Оплата</div>
                          <div className="font-mono text-green-600">
                            {item.payment || 0}
                          </div>
                        </div>
                      </div>
                      {item.actNote && (
                        <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200">
                          <span className="text-xs font-semibold text-amber-700">
                            📝 Примечание:
                          </span>{" "}
                          <span className="text-xs text-amber-800">
                            {item.actNote}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="bg-gray-50 px-6 py-4 border-t flex justify-end gap-3">
                <button
                  onClick={() => {
                    setViewModal(false);
                    handleEdit(selectedData.period);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  Редактировать
                </button>
                <button
                  onClick={() => setViewModal(false)}
                  className="px-4 py-2 border rounded-lg"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== РЕДАКТИРОВАНИЕ ==================== */}
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
                        { month: "long", year: "numeric" }
                      )}
                    </h3>
                    <p className="text-green-100 text-sm">
                      Цена газа: {getCurrentPriceForPeriod(selectedData.period)}{" "}
                      сум/м³ • Всего станций: {editingData.length}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditModal(false)}
                    className="text-white hover:bg-green-800 p-2 rounded-full"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Блок режима */}
              <div className="bg-blue-50 p-4 border-b">
                <div className="grid grid-cols-3 gap-4 max-w-4xl mx-auto">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={useCalculatedConsumption}
                      onChange={handleModeChange}
                      disabled={saving}
                    />
                    <span className="text-sm">Расчетное потребление</span>
                  </label>
                  <div>
                    <label className="block text-xs mb-1">
                      Кол-во дней потребления
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={actualConsumptionDays}
                      onChange={(e) => setActualConsumptionDays(e.target.value)}
                      disabled={saving || !useCalculatedConsumption}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Оставшиеся дни</label>
                    <input
                      type="text"
                      value={remainingDays}
                      readOnly
                      className="w-full p-2 border rounded bg-gray-50"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[55vh]">
                <div className="space-y-6">
                  {editingData.map((item, index) => {
                    const station = stations.find(
                      (s) => String(s.id) === String(item.stationId)
                    );
                    const derived = calculateDerivedFields(
                      item,
                      selectedData.period
                    );

                    // 🔥 САЛЬДО НА НАЧАЛО
                    const startBalance = item.calculatedStartBalance || 0;
                    const gasAmount =
                      derived.amountOfGas || derived.amountOfLimit || 0;
                    // 🔥 САЛЬДО НА КОНЕЦ
                    const endBalance =
                      startBalance + gasAmount - (item.payment || 0);

                    const hasExistingData = settlementsData.some(
                      (d) =>
                        d.period === selectedData.period &&
                        d.stationId.toString() === item.stationId.toString()
                    );

                    const actPrice = getActPrice(item);

                    return (
                      <div
                        key={`${item.stationId}-${item.period}`}
                        className={`rounded-xl p-6 border ${
                          hasExistingData
                            ? "bg-gray-50 border-gray-200"
                            : "bg-yellow-50 border-yellow-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-6">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
                              hasExistingData
                                ? "bg-blue-100 text-blue-600"
                                : "bg-yellow-100 text-yellow-600"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-xl text-blue-600">
                              {station?.name || "Неизвестно"}
                            </h4>
                            <p className="text-sm text-gray-500">
                              ID: {item.stationId} • {station?.landmark || ""}
                            </p>
                          </div>
                          {!hasExistingData && (
                            <div className="px-3 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs">
                              Новые данные
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-6">
                          {/* Лимит */}
                          <div className="bg-white p-4 rounded-lg border">
                            <label className="block text-xs font-semibold mb-2">
                              Лимит газа (м³)
                            </label>
                            <NumericFormat
                              value={item.limit || ""}
                              onValueChange={({ floatValue }) =>
                                handleEditChange(
                                  index,
                                  "limit",
                                  floatValue || ""
                                )
                              }
                              thousandSeparator=" "
                              decimalScale={5}
                              className="w-full p-3 border rounded font-mono"
                              placeholder="0.00000"
                            />
                          </div>

                          {/* Сумма по лимиту */}
                          <div className="bg-gray-100 p-4 rounded-lg border">
                            <label className="block text-xs font-semibold mb-2">
                              Сумма по лимиту
                            </label>
                            <div className="text-xl font-mono">
                              {derived.amountOfLimit
                                ? Math.round(
                                    derived.amountOfLimit
                                  ).toLocaleString("ru-RU")
                                : "-"}
                            </div>
                          </div>

                          {/* Компоненты газа или режим расчёта */}
                          {useCalculatedConsumption ? (
                            <>
                              <div className="bg-white p-4 rounded-lg border">
                                <label className="block text-xs font-semibold mb-2">
                                  Факт. потребление
                                </label>
                                <NumericFormat
                                  value={item.actualConsumption || ""}
                                  onValueChange={({ floatValue }) =>
                                    handleEditChange(
                                      index,
                                      "actualConsumption",
                                      floatValue || ""
                                    )
                                  }
                                  thousandSeparator=" "
                                  decimalScale={5}
                                  className="w-full p-3 border rounded font-mono"
                                />
                              </div>
                              <div className="bg-gray-100 p-4 rounded-lg border">
                                <label className="block text-xs font-semibold mb-2">
                                  Расчет на месяц
                                </label>
                                <div className="text-xl font-mono">
                                  {derived.calculatedMonthlyConsumption
                                    ? derived.calculatedMonthlyConsumption.toFixed(
                                        2
                                      )
                                    : "-"}
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="bg-white p-4 rounded-lg border col-span-3">
                              <label className="block text-xs font-semibold mb-3">
                                Компоненты газа (м³)
                              </label>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    По счетчику
                                  </label>
                                  <NumericFormat
                                    value={item.gasByMeter || ""}
                                    onValueChange={({ floatValue }) =>
                                      handleEditChange(
                                        index,
                                        "gasByMeter",
                                        floatValue || ""
                                      )
                                    }
                                    thousandSeparator=" "
                                    decimalScale={5}
                                    className="w-full p-2 border rounded"
                                    placeholder="0.00000"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    Ошибка конфигурации
                                  </label>
                                  <NumericFormat
                                    value={item.confError ?? ""}
                                    onValueChange={({ floatValue }) =>
                                      handleEditChange(
                                        index,
                                        "confError",
                                        floatValue === undefined
                                          ? ""
                                          : floatValue
                                      )
                                    }
                                    thousandSeparator=" "
                                    decimalScale={5}
                                    allowNegative={true}
                                    className="w-full p-2 border rounded"
                                    placeholder="0.00000"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    Низкий предел
                                  </label>
                                  <NumericFormat
                                    value={item.lowPress || ""}
                                    onValueChange={({ floatValue }) =>
                                      handleEditChange(
                                        index,
                                        "lowPress",
                                        floatValue || ""
                                      )
                                    }
                                    thousandSeparator=" "
                                    decimalScale={5}
                                    className="w-full p-2 border rounded"
                                    placeholder="0.00000"
                                  />
                                </div>
                                {/* 🔥 Верхний предел */}
                                <div>
                                  <label className="block text-xs text-pink-600 font-semibold mb-1">
                                    Верхний предел (зашкал)
                                  </label>
                                  <NumericFormat
                                    value={item.highLimit || ""}
                                    onValueChange={({ floatValue }) =>
                                      handleEditChange(
                                        index,
                                        "highLimit",
                                        floatValue || ""
                                      )
                                    }
                                    thousandSeparator=" "
                                    decimalScale={5}
                                    className="w-full p-2 border border-pink-300 rounded bg-pink-50"
                                    placeholder="0.00000"
                                  />
                                </div>
                                {/* 🔥 По акту — можно минус */}
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    По акту (м³)
                                  </label>
                                  <NumericFormat
                                    value={item.gasAct ?? ""}
                                    onValueChange={({ floatValue }) =>
                                      handleEditChange(
                                        index,
                                        "gasAct",
                                        floatValue === undefined
                                          ? ""
                                          : floatValue
                                      )
                                    }
                                    thousandSeparator=" "
                                    decimalScale={5}
                                    allowNegative={true}
                                    className="w-full p-2 border rounded"
                                    placeholder="0.00000"
                                  />
                                </div>
                                {/* 🔥 Сумма акта — можно минус */}
                                <div>
                                  <label className="block text-xs text-orange-600 font-semibold mb-1">
                                    Сумма акта (сум)
                                  </label>
                                  <NumericFormat
                                    value={item.gasActAmount ?? ""}
                                    onValueChange={({ floatValue }) =>
                                      handleEditChange(
                                        index,
                                        "gasActAmount",
                                        floatValue === undefined
                                          ? ""
                                          : floatValue
                                      )
                                    }
                                    thousandSeparator=" "
                                    decimalScale={5}
                                    allowNegative={true}
                                    className="w-full p-2 border border-orange-300 rounded bg-orange-50"
                                    placeholder="0.00000"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-orange-600 font-semibold mb-1">
                                    Цена акта (сум/м³)
                                  </label>
                                  <div className="w-full p-2 border border-orange-200 rounded bg-orange-50 font-mono text-sm text-orange-700">
                                    {actPrice !== 0 ? actPrice.toFixed(2) : "-"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Расчётные значения */}
                          <div className="bg-gray-100 p-4 rounded-lg border">
                            <label className="block text-xs font-semibold mb-3">
                              Расчетные значения
                            </label>
                            <div className="space-y-3">
                              <div>
                                <div className="text-xs text-gray-600 mb-1">
                                  Всего газа (м³)
                                </div>
                                <div className="text-lg font-mono font-bold">
                                  {derived.totalGas
                                    ? derived.totalGas.toFixed(2)
                                    : "-"}
                                </div>
                                {!useCalculatedConsumption && (
                                  <p className="text-[10px] text-gray-500 leading-tight mt-1">
                                    = по счётчику +{" "}
                                    <span className="text-orange-600 font-semibold">
                                      округл. сумма (
                                      {derived.roundedConfLowHigh})
                                    </span>{" "}
                                    + акт
                                  </p>
                                )}
                              </div>
                              <div>
                                <div className="text-xs text-gray-600 mb-1">
                                  Сумма газа
                                </div>
                                <div className="text-lg font-mono font-bold text-blue-600">
                                  {derived.amountOfGas
                                    ? Math.round(
                                        derived.amountOfGas
                                      ).toLocaleString("ru-RU")
                                    : "-"}
                                </div>
                                {!useCalculatedConsumption && (
                                  <p className="text-[10px] text-gray-500 leading-tight mt-1">
                                    = (по счётчику +{" "}
                                    <span className="text-orange-600 font-semibold">
                                      округл. сумма
                                    </span>
                                    ) × цена + сумма акта
                                  </p>
                                )}
                              </div>
                              <div>
                                <div className="text-xs text-gray-600 mb-1">
                                  Оплата
                                </div>
                                <NumericFormat
                                  value={item.payment || ""}
                                  onValueChange={({ floatValue }) =>
                                    handleEditChange(
                                      index,
                                      "payment",
                                      floatValue || ""
                                    )
                                  }
                                  thousandSeparator=" "
                                  decimalScale={2}
                                  className="w-full p-2 border rounded font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 🔥 САЛЬДО НА НАЧАЛО И НА КОНЕЦ */}
                        <div className="mt-4 pt-4 border-t border-blue-200">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-gray-600">
                                Сальдо на начало:
                              </span>
                              <span
                                className={`font-bold ml-2 ${
                                  startBalance >= 0
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                {Math.round(startBalance).toLocaleString(
                                  "ru-RU"
                                )}{" "}
                                сум
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">
                                Сальдо на конец:
                              </span>
                              <span
                                className={`font-bold ml-2 ${
                                  endBalance >= 0
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                {Math.round(endBalance).toLocaleString("ru-RU")}{" "}
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

              <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
                <button
                  onClick={() => setEditModal(false)}
                  disabled={saving}
                  className="px-6 py-3 border rounded-lg"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="px-8 py-3 bg-green-600 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? "Сохранение..." : "Сохранить изменения"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GasSettlementsDataList;
