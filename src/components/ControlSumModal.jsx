import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

const ControlSumModal = ({
  isOpen,
  onClose,
  modalType,
  stations,
  selectedStation,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState("");
  const [controlSum, setControlSum] = useState("");
  const [existingSum, setExistingSum] = useState(null);

  // Заголовки для разных типов модальных окон
  const modalTitles = {
    total: "Окно для добавления общей контрольной суммы",
    humo: "Окно для добавления контрольной суммы Хумо",
    uzcard: "Окно для добавления контрольной суммы Узкард",
    electronic: "Окно для добавления контрольной суммы электронных платежей", // ДОБАВЛЕНО
  };

  // Названия полей в базе данных
  const fieldNames = {
    total: "controlTotalSum",
    humo: "controlHumoSum",
    uzcard: "controlUzcardSum",
    electronic: "controlElectronicSum", // ДОБАВЛЕНО
  };

  // Сброс формы при открытии/закрытии
  useEffect(() => {
    if (isOpen) {
      setReportDate("");
      setControlSum("");
      setExistingSum(null);
    }
  }, [isOpen]);

  // Проверка существующей суммы
  const checkExistingSum = async () => {
    if (!selectedStation || !reportDate) {
      setExistingSum(null);
      return;
    }

    try {
      const reportQuery = query(
        collection(db, "unifiedDailyReports"),
        where("stationId", "==", selectedStation.id),
        where("reportDate", "==", reportDate)
      );

      const snapshot = await getDocs(reportQuery);

      if (!snapshot.empty) {
        const report = snapshot.docs[0];
        const reportData = report.data();
        const existingValue =
          reportData.generalData?.[fieldNames[modalType]] || 0;

        setExistingSum({
          id: report.id,
          value: existingValue,
        });
      } else {
        setExistingSum(null);
      }
    } catch (error) {
      console.error("Ошибка проверки существующей суммы:", error);
      setExistingSum(null);
    }
  };

  useEffect(() => {
    if (isOpen && selectedStation && reportDate) {
      checkExistingSum();
    }
  }, [selectedStation, reportDate, isOpen, modalType]);

  // Проверяем, есть ли уже контрольная сумма и блокируем форму
  const hasExistingControlSum = existingSum && existingSum.value > 0;

  // Сброс формы
  const resetForm = () => {
    setReportDate("");
    setControlSum("");
    setExistingSum(null);
  };

  // Сохранение контрольной суммы
  const handleSave = async () => {
    if (
      !selectedStation ||
      !reportDate ||
      !controlSum ||
      hasExistingControlSum
    ) {
      toast.error("Невозможно сохранить - контрольная сумма уже существует");
      return;
    }

    const numericValue = parseFloat(
      controlSum.replace(/\s/g, "").replace(",", ".")
    );
    if (isNaN(numericValue) || numericValue <= 0) {
      toast.error("Введите корректную сумму");
      return;
    }

    setLoading(true);
    try {
      // Находим отчет для выбранной даты и станции
      const reportQuery = query(
        collection(db, "unifiedDailyReports"),
        where("stationId", "==", selectedStation.id),
        where("reportDate", "==", reportDate)
      );

      const snapshot = await getDocs(reportQuery);

      if (snapshot.empty) {
        toast.error("Отчет за выбранную дату не найден");
        setLoading(false);
        return;
      }

      const reportDoc = snapshot.docs[0];
      const reportData = reportDoc.data();

      // Обновляем контрольную сумму
      await updateDoc(doc(db, "unifiedDailyReports", reportDoc.id), {
        generalData: {
          ...reportData.generalData,
          [fieldNames[modalType]]: numericValue,
        },
      });

      toast.success("Контрольная сумма успешно сохранена");
      resetForm();
      onSaved();
      onClose();
    } catch (error) {
      console.error("Ошибка сохранения контрольной суммы:", error);
      toast.error("Ошибка при сохранении");
    } finally {
      setLoading(false);
    }
  };

  // Форматирование числа
  const formatNumberInput = (value) => {
    if (value === "" || value === null || value === undefined) return "";
    const cleaned = value.toString().replace(/[^\d,.]/g, "");
    const number = parseFloat(cleaned.replace(",", "."));
    if (isNaN(number)) return cleaned;
    return number.toLocaleString("ru-RU", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
  };

  const handleControlSumChange = (value) => {
    if (hasExistingControlSum) return; // Блокируем ввод если есть существующая сумма
    const formattedValue = formatNumberInput(value);
    setControlSum(formattedValue);
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
          onClick={onClose}>
          <motion.div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}>
            {/* Заголовок */}
            <div
              className={`p-6 border-b bg-gradient-to-r text-white ${
                modalType === "total"
                  ? "from-green-600 to-green-700"
                  : modalType === "humo"
                  ? "from-blue-600 to-blue-700"
                  : modalType === "uzcard"
                  ? "from-purple-600 to-purple-700"
                  : "from-teal-600 to-teal-700" // ДОБАВЛЕНО для electronic
              }`}>
              <h3 className="text-xl font-semibold text-center">
                {modalTitles[modalType]}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {/* Станция (только для чтения) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Заправка
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  value={selectedStation?.stationName || ""}
                  disabled
                  readOnly
                />
                <p className="text-sm text-gray-500 mt-1">
                  Станция выбрана на основной странице
                </p>
              </div>

              {/* Дата */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Дата *
                </label>
                <input
                  type="date"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    hasExistingControlSum
                      ? "bg-gray-100 border-gray-300 cursor-not-allowed"
                      : "border-gray-300"
                  }`}
                  value={reportDate}
                  onChange={(e) =>
                    !hasExistingControlSum && setReportDate(e.target.value)
                  }
                  disabled={loading || hasExistingControlSum}
                />
                {hasExistingControlSum && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-700 font-medium">
                      ⚠️ На эту дату уже введена контрольная сумма
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      Существующая сумма:{" "}
                      {existingSum.value.toLocaleString("ru-RU", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      сўм
                    </p>
                  </div>
                )}
              </div>

              {/* Контрольная сумма */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Контрольная сумма {hasExistingControlSum && "(заблокировано)"}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className={`w-full px-3 py-2 border rounded-lg no-spinner ${
                    hasExistingControlSum
                      ? "bg-gray-100 border-gray-300 cursor-not-allowed"
                      : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                  value={controlSum}
                  onChange={(e) => handleControlSumChange(e.target.value)}
                  disabled={loading || hasExistingControlSum}
                  placeholder={hasExistingControlSum ? "Заблокировано" : "0"}
                />
                {hasExistingControlSum && (
                  <p className="text-sm text-red-600 mt-1">
                    Редактирование заблокировано, так как контрольная сумма уже
                    существует
                  </p>
                )}
              </div>
            </div>

            {/* Кнопки */}
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                disabled={loading}>
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={
                  loading || !reportDate || !controlSum || hasExistingControlSum
                }
                className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                  hasExistingControlSum
                    ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                    : modalType === "total"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : modalType === "humo"
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : modalType === "uzcard"
                    ? "bg-purple-600 text-white hover:bg-purple-700"
                    : "bg-teal-600 text-white hover:bg-teal-700" // ДОБАВЛЕНО для electronic
                } disabled:opacity-50 disabled:cursor-not-allowed`}>
                {loading
                  ? "Сохранение..."
                  : hasExistingControlSum
                  ? "Заблокировано"
                  : "Сохранить"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ControlSumModal;
