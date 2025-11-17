import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

const AddMeterResetModal = ({ isOpen, onClose, onSaved, stations }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    resetDate: "",
    stationId: "",
    hose: "",
    lastReadingFromReport: "", // Автоматическое из отчета
    lastReadingBeforeReset: "", // Ручной ввод
    newReadingAfterReset: "",
  });
  const [availableHoses, setAvailableHoses] = useState([]);
  const [lastReportData, setLastReportData] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Загрузка данных последнего отчета при выборе станции
  useEffect(() => {
    const loadLastReportData = async () => {
      if (!formData.stationId) return;

      try {
        // Ищем последний отчет для этой станции
        const lastReportQuery = query(
          collection(db, "unifiedDailyReports"),
          where("stationId", "==", formData.stationId),
          orderBy("reportDate", "desc"),
          limit(1)
        );

        const snapshot = await getDocs(lastReportQuery);

        if (!snapshot.empty) {
          const lastReport = snapshot.docs[0].data();
          setLastReportData(lastReport);

          // Создаем список доступных шлангов
          const hoses = lastReport.hoseData?.map((hose) => hose.hose) || [];
          setAvailableHoses(hoses);
        } else {
          setLastReportData(null);
          setAvailableHoses([]);
          toast.error("Для выбранной станции нет отчетов");
        }
      } catch (error) {
        console.error("Ошибка загрузки последнего отчета:", error);
        toast.error("Ошибка загрузки данных станции");
      }
    };

    loadLastReportData();
  }, [formData.stationId]);

  // Автозаполнение последнего показания из отчета при выборе шланга
  useEffect(() => {
    if (formData.hose && lastReportData) {
      const hoseData = lastReportData.hoseData?.find(
        (h) => h.hose === formData.hose
      );
      if (hoseData) {
        setFormData((prevData) => ({
          ...prevData,
          lastReadingFromReport: hoseData.current.toString(),
          lastReadingBeforeReset: hoseData.current.toString(), // По умолчанию ставим такое же значение
        }));
      }
    }
  }, [formData.hose, lastReportData]);

  // Проверка существующего обнуления
  const checkExistingReset = async (stationId, hose, resetDate) => {
    if (!stationId || !hose || !resetDate) return false;

    try {
      const resetQuery = query(
        collection(db, "meterResetEvents"),
        where("stationId", "==", stationId),
        where("hose", "==", hose),
        where("resetDate", "==", resetDate)
      );

      const snapshot = await getDocs(resetQuery);
      return !snapshot.empty;
    } catch (error) {
      console.error("Ошибка проверки обнулений:", error);
      return false;
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prevData) => ({
      ...prevData,
      [field]: value,
    }));

    // Очищаем ошибки при изменении поля
    setValidationErrors((prev) => ({
      ...prev,
      [field]: "",
    }));
  };

  // Валидация формы
  const validateForm = () => {
    const errors = {};

    // Проверка обязательных полей
    if (!formData.resetDate) errors.resetDate = "Обязательное поле";
    if (!formData.stationId) errors.stationId = "Обязательное поле";
    if (!formData.hose) errors.hose = "Обязательное поле";
    if (!formData.lastReadingBeforeReset)
      errors.lastReadingBeforeReset = "Обязательное поле";
    if (!formData.newReadingAfterReset)
      errors.newReadingAfterReset = "Обязательное поле";

    // Проверка числовых значений
    const lastReadingFromReport =
      parseFloat(formData.lastReadingFromReport) || 0;
    const lastReadingBeforeReset =
      parseFloat(formData.lastReadingBeforeReset) || 0;
    const newReadingAfterReset = parseFloat(formData.newReadingAfterReset) || 0;

    if (
      formData.lastReadingBeforeReset &&
      lastReadingBeforeReset < lastReadingFromReport
    ) {
      errors.lastReadingBeforeReset =
        "Не может быть меньше показания из отчета";
    }

    if (
      formData.newReadingAfterReset &&
      newReadingAfterReset >= lastReadingBeforeReset
    ) {
      errors.newReadingAfterReset =
        "Должно быть меньше последнего показания перед обнулением";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Проверка, активна ли кнопка сохранения
  const isSaveButtonDisabled = () => {
    // Проверяем, что все обязательные поля заполнены
    if (
      !formData.resetDate ||
      !formData.stationId ||
      !formData.hose ||
      !formData.lastReadingBeforeReset ||
      !formData.newReadingAfterReset
    ) {
      return true;
    }

    // Проверяем числовые значения
    const lastReadingFromReport =
      parseFloat(formData.lastReadingFromReport) || 0;
    const lastReadingBeforeReset =
      parseFloat(formData.lastReadingBeforeReset) || 0;
    const newReadingAfterReset = parseFloat(formData.newReadingAfterReset) || 0;

    if (lastReadingBeforeReset < lastReadingFromReport) return true;
    if (newReadingAfterReset >= lastReadingBeforeReset) return true;

    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Исправьте ошибки в форме");
      return;
    }

    // Проверяем существующее обнуление
    const hasExistingReset = await checkExistingReset(
      formData.stationId,
      formData.hose,
      formData.resetDate
    );

    if (hasExistingReset) {
      toast.error(
        "Обнуление для этого шланга на выбранную дату уже существует"
      );
      return;
    }

    try {
      setLoading(true);

      const selectedStation = stations.find((s) => s.id === formData.stationId);

      const resetEventData = {
        resetDate: formData.resetDate,
        stationId: formData.stationId,
        stationName: selectedStation?.stationName || "Неизвестная станция",
        hose: formData.hose,
        lastReadingFromReport: parseFloat(formData.lastReadingFromReport) || 0,
        lastReadingBeforeReset:
          parseFloat(formData.lastReadingBeforeReset) || 0,
        newReadingAfterReset: parseFloat(formData.newReadingAfterReset) || 0,
        createdAt: new Date(),
        createdBy: auth?.currentUser?.email || "unknown",
      };

      await addDoc(collection(db, "meterResetEvents"), resetEventData);

      toast.success("Событие обнуления успешно добавлено");
      onSaved();
      handleClose();
    } catch (error) {
      console.error("Ошибка сохранения:", error);
      toast.error("Ошибка при сохранении");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      resetDate: "",
      stationId: "",
      hose: "",
      lastReadingFromReport: "",
      lastReadingBeforeReset: "",
      newReadingAfterReset: "",
    });
    setAvailableHoses([]);
    setLastReportData(null);
    setValidationErrors({});
    onClose();
  };

  // Форматирование даты для отображения
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-");
    return `${day}-${month}-${year}`;
  };

  // Обработка ввода даты
  const handleDateChange = (value) => {
    // Удаляем все нецифровые символы
    const cleaned = value.replace(/\D/g, "");

    let formattedDate = "";

    if (cleaned.length <= 2) {
      formattedDate = cleaned;
    } else if (cleaned.length <= 4) {
      formattedDate = `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    } else {
      formattedDate = `${cleaned.slice(0, 2)}-${cleaned.slice(
        2,
        4
      )}-${cleaned.slice(4, 8)}`;
    }

    setFormData((prevData) => ({
      ...prevData,
      resetDate: formattedDate,
    }));

    setValidationErrors((prev) => ({
      ...prev,
      resetDate: "",
    }));
  };

  // Конвертация в формат YYYY-MM-DD для сохранения
  const convertToISODate = (dateString) => {
    if (!dateString) return "";
    const parts = dateString.split("-");
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    return dateString;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}>
          <motion.div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[95vh] overflow-hidden flex flex-col"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}>
            {/* Заголовок */}
            <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <h3 className="text-xl font-semibold">
                Добавить обнуление счетчика
              </h3>
            </div>

            {/* Форма */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-6">
              <div className="space-y-4">
                {/* Дата */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Дата обнуления *
                  </label>
                  <input
                    type="text"
                    value={formData.resetDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    placeholder="ДД-ММ-ГГГГ"
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      validationErrors.resetDate
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                    required
                  />
                  {validationErrors.resetDate && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.resetDate}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Формат: ДД-ММ-ГГГГ
                  </p>
                </div>

                {/* Станция */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Станция *
                  </label>
                  <select
                    value={formData.stationId}
                    onChange={(e) =>
                      handleInputChange("stationId", e.target.value)
                    }
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      validationErrors.stationId
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                    required>
                    <option value="">Выберите станцию</option>
                    {stations.map((station) => (
                      <option key={station.id} value={station.id}>
                        {station.stationName}
                      </option>
                    ))}
                  </select>
                  {validationErrors.stationId && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.stationId}
                    </p>
                  )}
                </div>

                {/* Шланг */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Шланг *
                  </label>
                  <select
                    value={formData.hose}
                    onChange={(e) => handleInputChange("hose", e.target.value)}
                    disabled={
                      !formData.stationId || availableHoses.length === 0
                    }
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 ${
                      validationErrors.hose
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                    required>
                    <option value="">Выберите шланг</option>
                    {availableHoses.map((hose) => (
                      <option key={hose} value={hose}>
                        {hose}
                      </option>
                    ))}
                  </select>
                  {validationErrors.hose && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.hose}
                    </p>
                  )}
                </div>

                {/* Последнее показание счетчика с отчета */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Последнее показание счетчика с отчета
                  </label>
                  <input
                    type="number"
                    value={formData.lastReadingFromReport}
                    readOnly
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-600"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Автоматически заполняется из последнего отчета
                  </p>
                </div>

                {/* Последнее показание перед обнулением */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Последнее показание перед обнулением *
                  </label>
                  <input
                    type="number"
                    value={formData.lastReadingBeforeReset}
                    onChange={(e) =>
                      handleInputChange(
                        "lastReadingBeforeReset",
                        e.target.value
                      )
                    }
                    step="0.01"
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      validationErrors.lastReadingBeforeReset
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Введите последнее показание перед обнулением"
                    required
                  />
                  {validationErrors.lastReadingBeforeReset && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.lastReadingBeforeReset}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Не может быть меньше показания из отчета (
                    {formData.lastReadingFromReport || 0})
                  </p>
                </div>

                {/* Новое показание после обнуления */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Новое показание после обнуления *
                  </label>
                  <input
                    type="number"
                    value={formData.newReadingAfterReset}
                    onChange={(e) =>
                      handleInputChange("newReadingAfterReset", e.target.value)
                    }
                    min="0"
                    step="0.01"
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      validationErrors.newReadingAfterReset
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Введите новое показание после обнуления"
                    required
                  />
                  {validationErrors.newReadingAfterReset && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.newReadingAfterReset}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Должно быть меньше последнего показания перед обнулением
                  </p>
                </div>
              </div>
            </form>

            {/* Кнопки */}
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100">
                Отмена
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || isSaveButtonDisabled()}
                className={`px-5 py-2 rounded-xl font-semibold ${
                  loading || isSaveButtonDisabled()
                    ? "bg-gray-400 cursor-not-allowed text-gray-600"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}>
                {loading ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddMeterResetModal;
