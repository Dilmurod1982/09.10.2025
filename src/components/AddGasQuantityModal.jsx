import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

const AddGasQuantityModal = ({ isOpen, onClose, stations, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [gasData, setGasData] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [previousMonthData, setPreviousMonthData] = useState({});
  const [existingData, setExistingData] = useState({});

  // Годы для выбора
  const yearOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();
    const startYear = 2025;

    for (let year = startYear; year <= currentYear; year++) {
      options.push({ value: year.toString(), label: year.toString() });
    }

    return options.reverse();
  };

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

  // Получение данных предыдущего месяца
  const getPreviousMonthData = async (year, month) => {
    try {
      const prevMonth = parseInt(month) - 1;
      let prevYear = parseInt(year);

      if (prevMonth === 0) {
        prevYear = prevYear - 1;
        prevMonth = 12;
      }

      const prevMonthStr = String(prevMonth).padStart(2, "0");
      const prevPeriod = `${prevYear}-${prevMonthStr}`;

      console.log("Загрузка данных за предыдущий период:", prevPeriod);

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
          gasPrice: settlement.gasPrice || 0,
        };
      });

      console.log("Данные предыдущего месяца:", data);
      return data;
    } catch (error) {
      console.error("Ошибка загрузки данных предыдущего месяца:", error);
      return {};
    }
  };

  // Загрузка данных при изменении периода
  useEffect(() => {
    if (!isOpen || !selectedYear || !selectedMonth) return;

    const loadData = async () => {
      try {
        // Загрузка данных предыдущего месяца
        const prevData = await getPreviousMonthData(
          selectedYear,
          selectedMonth
        );
        setPreviousMonthData(prevData);

        // Загрузка существующих данных для выбранного периода
        const currentPeriod = `${selectedYear}-${selectedMonth}`;
        const currentQ = query(
          collection(db, "gasSettlements"),
          where("period", "==", currentPeriod)
        );

        const currentSnapshot = await getDocs(currentQ);
        const currentData = {};

        currentSnapshot.docs.forEach((doc) => {
          const settlement = doc.data();
          currentData[settlement.stationId] = {
            ...settlement,
            docId: doc.id,
          };
        });

        setExistingData(currentData);

        // Инициализация данных
        initializeGasData(prevData, currentData);
      } catch (error) {
        console.error("Ошибка загрузки данных:", error);
        initializeGasData({}, {});
      }
    };

    loadData();
  }, [isOpen, selectedYear, selectedMonth]);

  // Инициализация данных для станций
  const initializeGasData = (prevData, currentData) => {
    if (stations.length > 0 && selectedYear && selectedMonth) {
      const initialData = stations.map((station) => {
        const existing = currentData[station.id];
        const prev = prevData[station.id];

        if (existing) {
          // Если данные уже существуют, используем их
          return {
            ...existing,
            stationName: station.stationName,
            period: `${selectedYear}-${selectedMonth}`,
          };
        } else {
          // Новые данные - сальдо на начало берется из конечного сальдо предыдущего месяца
          const startBalance = prev?.endBalance || 0;

          return {
            stationId: station.id,
            stationName: station.stationName,
            period: `${selectedYear}-${selectedMonth}`,
            gasPrice: prev?.gasPrice || 0,
            startBalance: startBalance,
            limit: 0,
            totalAccruedM3: 0,
            meterReading: 0,
            configError: 0,
            lowPressure: 0,
            actCalculation: 0,
            meterDifference: 0,
            other: 0,
            totalAccruedAmount: 0,
            paid: 0,
            endBalance: startBalance, // Начальное значение равно сальдо на начало
          };
        }
      });
      setGasData(initialData);
    }
  };

  // Обновление общего количества м³
  const updateTotalM3 = (index, value) => {
    const newData = [...gasData];
    const numericValue = parseFloat(value) || 0;

    newData[index] = {
      ...newData[index],
      totalAccruedM3: numericValue,
    };

    // Пересчитываем общую сумму
    newData[index].totalAccruedAmount =
      numericValue * (newData[index].gasPrice || 0);

    // Пересчитываем конечное сальдо
    newData[index].endBalance =
      (newData[index].startBalance || 0) +
      newData[index].totalAccruedAmount -
      (newData[index].paid || 0);

    setGasData(newData);
  };

  // Обновление цены газа
  const updateGasPrice = (index, value) => {
    const newData = [...gasData];
    const numericValue = parseFloat(value) || 0;

    newData[index] = {
      ...newData[index],
      gasPrice: numericValue,
      totalAccruedAmount: (newData[index].totalAccruedM3 || 0) * numericValue,
    };

    // Пересчитываем конечное сальдо
    newData[index].endBalance =
      (newData[index].startBalance || 0) +
      newData[index].totalAccruedAmount -
      (newData[index].paid || 0);

    setGasData(newData);
  };

  // Обновление оплаты
  const updatePaid = (index, value) => {
    const newData = [...gasData];
    const numericValue = parseFloat(value) || 0;

    newData[index] = {
      ...newData[index],
      paid: numericValue,
      endBalance:
        (newData[index].startBalance || 0) +
        (newData[index].totalAccruedAmount || 0) -
        numericValue,
    };

    setGasData(newData);
  };

  // Обновление начального сальдо (только если нет данных предыдущего месяца)
  const updateStartBalance = (index, value) => {
    const newData = [...gasData];
    const numericValue = parseFloat(value) || 0;
    const hasPreviousData = previousMonthData[newData[index].stationId];

    // Разрешаем редактирование только если нет данных предыдущего месяца
    if (!hasPreviousData) {
      newData[index] = {
        ...newData[index],
        startBalance: numericValue,
        endBalance:
          numericValue +
          (newData[index].totalAccruedAmount || 0) -
          (newData[index].paid || 0),
      };

      setGasData(newData);
    }
  };

  // Проверка возможности сохранения
  const canSave = selectedYear && selectedMonth && gasData.length > 0;

  // Сохранение данных
  const handleSave = async () => {
    if (!canSave) return;

    setLoading(true);
    try {
      const savePromises = gasData.map(async (data) => {
        const settlementData = {
          stationId: data.stationId,
          stationName: data.stationName,
          period: data.period,
          gasPrice: data.gasPrice || 0,
          startBalance: data.startBalance || 0,
          limit: data.limit || 0,
          totalAccruedM3: data.totalAccruedM3 || 0,
          meterReading: data.meterReading || 0,
          configError: data.configError || 0,
          lowPressure: data.lowPressure || 0,
          actCalculation: data.actCalculation || 0,
          meterDifference: data.meterDifference || 0,
          other: data.other || 0,
          totalAccruedAmount: data.totalAccruedAmount || 0,
          paid: data.paid || 0,
          endBalance: data.endBalance || 0,
          createdAt: data.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const existing = existingData[data.stationId];

        if (existing && existing.docId) {
          // Обновляем существующую запись
          await updateDoc(
            doc(db, "gasSettlements", existing.docId),
            settlementData
          );
        } else {
          // Создаем новую запись
          await addDoc(collection(db, "gasSettlements"), settlementData);
        }
      });

      await Promise.all(savePromises);

      toast.success("Данные по газу успешно сохранены");
      onSaved();
      onClose();
    } catch (error) {
      console.error("Ошибка сохранения данных:", error);
      toast.error("Ошибка при сохранении данных");
    } finally {
      setLoading(false);
    }
  };

  // Сброс данных при закрытии
  const handleClose = () => {
    setSelectedYear("");
    setSelectedMonth("");
    setGasData([]);
    setPreviousMonthData({});
    setExistingData({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleClose}>
      <motion.div
        className="bg-white rounded-2xl shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}>
        {/* Заголовок */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-semibold">
                Добавление количества газа
              </h3>
              <p className="text-blue-100 mt-1">
                Введите данные по начислению газа для станций
              </p>
            </div>
          </div>
        </div>

        {/* Выбор периода */}
        <div className="p-6 border-b bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Год *
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}>
                <option value="">Выберите год...</option>
                {yearOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

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
          </div>
          {selectedYear && selectedMonth && (
            <div className="mt-4 text-sm text-gray-600">
              <p>
                Сальдо на начало месяца будет автоматически заполнено из данных
                за предыдущий месяц
              </p>
            </div>
          )}
        </div>

        {/* Таблица данных */}
        <div className="flex-1 overflow-auto p-6">
          {selectedYear && selectedMonth ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Станция
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Цена газа за 1 м³
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Сальдо на начало
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Всего начислено (м³)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Всего начислено
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Оплачено
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Сальдо на конец
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {gasData.map((station, index) => {
                    const hasPreviousData =
                      previousMonthData[station.stationId];
                    const isStartBalanceEditable = !hasPreviousData;

                    return (
                      <tr key={station.stationId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {station.stationName}
                          {hasPreviousData && (
                            <div className="text-xs text-green-600 mt-1">
                              Данные из предыдущего месяца
                            </div>
                          )}
                        </td>

                        {/* Цена газа за 1 м³ */}
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                            value={station.gasPrice}
                            onChange={(e) =>
                              updateGasPrice(index, e.target.value)
                            }
                          />
                        </td>

                        {/* Сальдо на начало */}
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            className={`w-24 px-2 py-1 border rounded text-sm ${
                              isStartBalanceEditable
                                ? "border-gray-300"
                                : "border-gray-200 bg-gray-100"
                            }`}
                            value={station.startBalance}
                            onChange={(e) =>
                              updateStartBalance(index, e.target.value)
                            }
                            disabled={!isStartBalanceEditable}
                            placeholder="0.00"
                          />
                          {!isStartBalanceEditable ? (
                            <div className="text-xs text-gray-500 mt-1">
                              Авто из пред. месяца
                            </div>
                          ) : (
                            <div className="text-xs text-orange-600 mt-1">
                              Введите вручную
                            </div>
                          )}
                        </td>

                        {/* Всего начислено (м³) */}
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                            value={station.totalAccruedM3}
                            onChange={(e) =>
                              updateTotalM3(index, e.target.value)
                            }
                            placeholder="0.00"
                          />
                        </td>

                        {/* Всего начислено */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-semibold bg-gray-50">
                          {station.totalAccruedAmount.toLocaleString("ru-RU", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>

                        {/* Оплачено */}
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                            value={station.paid}
                            onChange={(e) => updatePaid(index, e.target.value)}
                            placeholder="0.00"
                          />
                        </td>

                        {/* Сальдо на конец */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold bg-gray-50">
                          <span
                            className={
                              station.endBalance >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }>
                            {station.endBalance.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Выберите период
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Выберите год и месяц для добавления данных по газу
              </p>
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            disabled={loading}>
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AddGasQuantityModal;
