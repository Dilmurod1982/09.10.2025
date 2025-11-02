import React, { useState, useEffect } from "react";
import {
  updateDoc,
  doc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

const DetailsModal = ({ isOpen, onClose, settlement, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [previousMonthData, setPreviousMonthData] = useState(null);

  // Получение данных предыдущего месяца
  const getPreviousMonthData = async (period) => {
    try {
      const [year, month] = period.split("-");
      const prevMonth = parseInt(month) - 1;
      let prevYear = parseInt(year);

      if (prevMonth === 0) {
        prevYear = prevYear - 1;
        prevMonth = 12;
      }

      const prevMonthStr = String(prevMonth).padStart(2, "0");
      const prevPeriod = `${prevYear}-${prevMonthStr}`;

      console.log("Поиск данных за предыдущий период:", prevPeriod);

      const q = query(
        collection(db, "gasSettlements"),
        where("period", "==", prevPeriod),
        where("stationId", "==", settlement.stationId)
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const prevSettlement = snapshot.docs[0].data();
        console.log("Найдены данные предыдущего месяца:", prevSettlement);
        return prevSettlement;
      } else {
        console.log("Данные предыдущего месяца не найдены");
        return null;
      }
    } catch (error) {
      console.error("Ошибка загрузки данных предыдущего месяца:", error);
      return null;
    }
  };

  // Инициализация данных при открытии
  useEffect(() => {
    if (settlement && isOpen) {
      const initializeData = async () => {
        // Загружаем данные предыдущего месяца
        const prevData = await getPreviousMonthData(settlement.period);
        setPreviousMonthData(prevData);

        // Если есть данные предыдущего месяца, обновляем сальдо
        if (prevData && prevData.endBalance !== undefined) {
          const updatedData = {
            ...settlement,
            startBalance: prevData.endBalance,
          };

          // Пересчитываем все поля
          const recalculatedData = recalculateFields(updatedData);
          setFormData(recalculatedData);

          console.log("Сальдо обновлено из предыдущего месяца:", {
            previousEndBalance: prevData.endBalance,
            newStartBalance: recalculatedData.startBalance,
          });
        } else {
          setFormData(settlement);
        }
      };

      initializeData();
    }
  }, [settlement, isOpen]);

  // Функция для пересчета всех зависимых полей
  const recalculateFields = (data) => {
    const totalAccruedAmount =
      (data.totalAccruedM3 || 0) * (data.gasPrice || 0);
    const endBalance =
      (data.startBalance || 0) + totalAccruedAmount - (data.paid || 0);

    return {
      ...data,
      totalAccruedAmount,
      endBalance,
    };
  };

  // Обновление поля формы
  const handleInputChange = (field, value) => {
    const numericValue = parseFloat(value) || 0;

    setFormData((prev) => {
      const updated = {
        ...prev,
        [field]: numericValue,
      };

      // Всегда пересчитываем все зависимые поля
      return recalculateFields(updated);
    });
  };

  // Синхронизация с предыдущим месяцем
  const handleSyncWithPreviousMonth = async () => {
    if (!previousMonthData) {
      toast.error("Данные предыдущего месяца не найдены");
      return;
    }

    const updatedData = {
      ...formData,
      startBalance: previousMonthData.endBalance,
    };

    const recalculatedData = recalculateFields(updatedData);
    setFormData(recalculatedData);

    toast.success("Сальдо синхронизировано с предыдущим месяцем");
  };

  // Сохранение изменений
  const handleSave = async () => {
    if (!settlement?.id) return;

    setLoading(true);
    try {
      // Перед сохранением убедимся, что все поля пересчитаны
      const finalData = recalculateFields(formData);

      const settlementData = {
        ...finalData,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "gasSettlements", settlement.id), settlementData);

      toast.success("Данные успешно обновлены");
      setIsEditing(false);
      onSaved();
    } catch (error) {
      console.error("Ошибка сохранения данных:", error);
      toast.error("Ошибка при сохранении данных");
    } finally {
      setLoading(false);
    }
  };

  // Форматирование чисел
  const formatNumber = (number) => {
    const num = parseFloat(number) || 0;
    return num.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (!isOpen || !settlement) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}>
        {/* Заголовок */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-semibold">
                Детали расчета - {settlement.stationName}
              </h3>
              <p className="text-blue-100 mt-1">Период: {settlement.period}</p>
              {previousMonthData && (
                <p className="text-blue-200 text-sm mt-1">
                  Доступны данные за предыдущий месяц
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <>
                  {previousMonthData && (
                    <button
                      onClick={handleSyncWithPreviousMonth}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                      title="Синхронизировать сальдо с предыдущим месяцем">
                      Синхронизировать
                    </button>
                  )}
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                    Редактировать
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setFormData(settlement); // Сброс изменений
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium">
                    Отмена
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50">
                    {loading ? "Сохранение..." : "Сохранить"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Содержимое */}
        <div className="flex-1 overflow-auto p-6">
          {/* Информация о синхронизации */}
          {previousMonthData && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-green-800">
                    Данные предыдущего месяца доступны
                  </h4>
                  <p className="text-sm text-green-600 mt-1">
                    Сальдо на конец {previousMonthData.period}:{" "}
                    <strong>
                      {formatNumber(previousMonthData.endBalance)} сўм
                    </strong>
                  </p>
                </div>
                {!isEditing && (
                  <button
                    onClick={handleSyncWithPreviousMonth}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors">
                    Обновить сальдо
                  </button>
                )}
              </div>
            </div>
          )}

          {!previousMonthData && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">
                Данные предыдущего месяца не найдены. Сальдо на начало месяца
                можно ввести вручную.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Основная информация */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900">
                Основная информация
              </h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Цена газа за 1 м³
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={formData.gasPrice || 0}
                    onChange={(e) =>
                      handleInputChange("gasPrice", e.target.value)
                    }
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 rounded-lg">
                    {formatNumber(formData.gasPrice)} сўм
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Лимит
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={formData.limit || 0}
                    onChange={(e) => handleInputChange("limit", e.target.value)}
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 rounded-lg">
                    {formatNumber(formData.limit)} м³
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Всего начислено м³
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={formData.totalAccruedM3 || 0}
                    onChange={(e) =>
                      handleInputChange("totalAccruedM3", e.target.value)
                    }
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-blue-600">
                    {formatNumber(formData.totalAccruedM3)} м³
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Оплачено
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={formData.paid || 0}
                    onChange={(e) => handleInputChange("paid", e.target.value)}
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-orange-600">
                    {formatNumber(formData.paid)} сўм
                  </div>
                )}
              </div>
            </div>

            {/* Детализация начислений */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900">
                Детализация начислений (м³)
              </h4>

              {[
                { field: "meterReading", label: "Показание счетчика" },
                {
                  field: "configError",
                  label: "Ошибки конфигурации п.6.2.1.1",
                },
                {
                  field: "lowPressure",
                  label: "Низкий перепад давления п.6.2.7",
                },
                { field: "actCalculation", label: "По акту" },
                { field: "meterDifference", label: "По разнице счетчиков" },
                { field: "other", label: "Другие" },
              ].map(({ field, label }) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      value={formData[field] || 0}
                      onChange={(e) => handleInputChange(field, e.target.value)}
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 rounded-lg">
                      {formatNumber(formData[field])} м³
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Сальдо */}
            <div className="md:col-span-2 space-y-4">
              <h4 className="text-lg font-medium text-gray-900">Сальдо</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Сальдо на начало месяца
                  </label>
                  {isEditing ? (
                    <>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        value={formData.startBalance || 0}
                        onChange={(e) =>
                          handleInputChange("startBalance", e.target.value)
                        }
                      />
                      {previousMonthData && (
                        <p className="text-xs text-gray-500 mt-1">
                          Рекомендуется:{" "}
                          {formatNumber(previousMonthData.endBalance)} сўм
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="px-3 py-2 bg-gray-50 rounded-lg">
                        {formatNumber(formData.startBalance)} сўм
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {previousMonthData
                          ? `Синхронизировано с ${previousMonthData.period}`
                          : "Введено вручную"}
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Всего начислено
                  </label>
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-green-600 font-semibold">
                    {formatNumber(formData.totalAccruedAmount)} сўм
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    ({formatNumber(formData.totalAccruedM3)} м³ ×{" "}
                    {formatNumber(formData.gasPrice)} сўм)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Сальдо на конец месяца
                  </label>
                  <div
                    className={`px-3 py-2 rounded-lg font-semibold ${
                      formData.endBalance >= 0
                        ? "bg-green-50 text-green-600"
                        : "bg-red-50 text-red-600"
                    }`}>
                    {formatNumber(formData.endBalance)} сўм
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    ({formatNumber(formData.startBalance)} +{" "}
                    {formatNumber(formData.totalAccruedAmount)} -{" "}
                    {formatNumber(formData.paid)})
                  </p>
                </div>
              </div>
            </div>

            {/* Формула расчета */}
            <div className="md:col-span-2 p-4 bg-blue-50 rounded-lg">
              <h5 className="font-medium text-blue-900 mb-2">
                Формула расчета:
              </h5>
              <p className="text-sm text-blue-800">
                <strong>Всего начислено</strong> = Всего начислено м³ × Цена
                газа за 1 м³
              </p>
              <p className="text-sm text-blue-800 mt-1">
                <strong>Сальдо на конец месяца</strong> = Сальдо на начало
                месяца + Всего начислено - Оплачено
              </p>
            </div>
          </div>
        </div>

        {/* Кнопка закрытия */}
        <div className="p-6 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium">
            Закрыть
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default DetailsModal;
