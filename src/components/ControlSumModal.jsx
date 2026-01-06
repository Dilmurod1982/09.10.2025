import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
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
  const [receiptNumber, setReceiptNumber] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [existingSum, setExistingSum] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState(null);

  // Определение квартала по месяцу
  const getQuarterFromMonth = (month) => {
    const monthNum = parseInt(month);
    if (monthNum >= 1 && monthNum <= 3) return "I";
    if (monthNum >= 4 && monthNum <= 6) return "II";
    if (monthNum >= 7 && monthNum <= 9) return "III";
    if (monthNum >= 10 && monthNum <= 12) return "IV";
    return "I";
  };

  // Формирование названия коллекции
  const getCollectionNameFromDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = getQuarterFromMonth(month);
    return `unifiedDailyReports_${quarter}_${year}`;
  };

  // Загрузка методов платежей
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const snapshot = await getDocs(collection(db, "paymentMethods"));
        const methods = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log("Методы платежей в модальном окне:", methods);
        setPaymentMethods(methods);
      } catch (error) {
        console.error("Ошибка при загрузке методов платежей:", error);
      }
    };

    fetchPaymentMethods();
  }, []);

  // Определение текущего метода платежа
  useEffect(() => {
    if (modalType && paymentMethods.length > 0) {
      console.log("Определение метода для modalType:", modalType);

      // Для специальных типов (total, humo, uzcard)
      if (modalType === "total") {
        setCurrentPaymentMethod({
          name: "Жами сумма",
          dbFieldName: "zhisobot",
          fieldName: "controlTotalSum",
        });
      } else if (modalType === "humo") {
        setCurrentPaymentMethod({
          name: "Хумо терминали",
          dbFieldName: "humo",
          fieldName: "controlHumoSum",
        });
      } else if (modalType === "uzcard") {
        setCurrentPaymentMethod({
          name: "Узкард терминали",
          dbFieldName: "uzcard",
          fieldName: "controlUzcardSum",
        });
      } else {
        // Для электронных платежей
        const method = paymentMethods.find((m) => m.dbFieldName === modalType);
        console.log("Найден метод для электронного платежа:", method);
        if (method) {
          setCurrentPaymentMethod({
            name: method.name,
            dbFieldName: method.dbFieldName,
            fieldName: `control${
              method.dbFieldName.charAt(0).toUpperCase() +
              method.dbFieldName.slice(1)
            }Sum`,
          });
        } else {
          // Если метод не найден, создаем базовый
          setCurrentPaymentMethod({
            name: modalType,
            dbFieldName: modalType,
            fieldName: `control${
              modalType.charAt(0).toUpperCase() + modalType.slice(1)
            }Sum`,
          });
        }
      }

      console.log("Текущий метод платежа:", currentPaymentMethod);
    }
  }, [modalType, paymentMethods]);

  // Сброс формы при открытии/закрытии
  useEffect(() => {
    if (isOpen) {
      setReportDate("");
      setControlSum("");
      setReceiptNumber("");
      setPaymentDate("");
      setExistingSum(null);
      setCollectionName("");
      setIsConfirmModalOpen(false);
    }
  }, [isOpen]);

  // Обновление названия коллекции при изменении даты отчета
  useEffect(() => {
    if (reportDate) {
      const name = getCollectionNameFromDate(reportDate);
      setCollectionName(name);
    } else {
      setCollectionName("");
    }
  }, [reportDate]);

  // Проверка существующей суммы
  const checkExistingSum = async () => {
    if (
      !selectedStation ||
      !reportDate ||
      !collectionName ||
      !currentPaymentMethod
    ) {
      setExistingSum(null);
      return;
    }

    try {
      const reportQuery = query(
        collection(db, collectionName),
        where("stationId", "==", selectedStation.id),
        where("reportDate", "==", reportDate)
      );

      const snapshot = await getDocs(reportQuery);

      if (!snapshot.empty) {
        const report = snapshot.docs[0];
        const reportData = report.data();
        const existingValue =
          reportData.generalData?.[currentPaymentMethod.fieldName] || 0;

        const existingReceipt =
          reportData.generalData?.[
            `${currentPaymentMethod.fieldName}Receipt`
          ] || "";
        const existingPaymentDate =
          reportData.generalData?.[
            `${currentPaymentMethod.fieldName}PaymentDate`
          ] || "";

        setExistingSum({
          id: report.id,
          value: existingValue,
          receiptNumber: existingReceipt,
          paymentDate: existingPaymentDate,
          collectionName: collectionName,
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
    if (
      isOpen &&
      selectedStation &&
      reportDate &&
      collectionName &&
      currentPaymentMethod
    ) {
      checkExistingSum();
    }
  }, [
    selectedStation,
    reportDate,
    collectionName,
    isOpen,
    currentPaymentMethod,
  ]);

  // Проверяем, есть ли уже контрольная сумма и блокируем форму
  const hasExistingControlSum = existingSum && existingSum.value > 0;

  // Сброс формы
  const resetForm = () => {
    setReportDate("");
    setControlSum("");
    setReceiptNumber("");
    setPaymentDate("");
    setExistingSum(null);
    setCollectionName("");
  };

  // Валидация формы
  const validateForm = () => {
    if (!selectedStation) {
      toast.error("Заправкани танланг");
      return false;
    }

    if (!reportDate) {
      toast.error("Ҳисобот санасини танланг");
      return false;
    }

    if (!controlSum) {
      toast.error("Назорат суммасини киритинг");
      return false;
    }

    const numericValue = parseFloat(
      controlSum.replace(/\s/g, "").replace(",", ".")
    );
    if (isNaN(numericValue) || numericValue <= 0) {
      toast.error("Тўғри суммани киритинг");
      return false;
    }

    if (!receiptNumber) {
      toast.error("Квитанция рақамини киритинг");
      return false;
    }

    if (!paymentDate) {
      toast.error("Ҳисоб рақамга тушган санани киритинг");
      return false;
    }

    if (hasExistingControlSum) {
      toast.error("Бу санага назорат суммаси киритилган");
      return false;
    }

    return true;
  };

  // Открытие модального окна подтверждения
  const handleOpenConfirmModal = () => {
    if (!validateForm()) {
      return;
    }

    setIsConfirmModalOpen(true);
  };

  // Проверка соответствия суммы
  const verifyAmount = (reportData) => {
    if (!currentPaymentMethod) {
      return {
        actualAmount: 0,
        isMatch: true,
        paymentSystem: "Номаълум",
      };
    }

    const paymentData = reportData.paymentData || {};
    const actualAmount = paymentData[currentPaymentMethod.dbFieldName] || 0;
    const numericValue = parseFloat(
      controlSum.replace(/\s/g, "").replace(",", ".")
    );

    return {
      actualAmount,
      isMatch: Math.abs(actualAmount - numericValue) < 0.01,
      paymentSystem: currentPaymentMethod.name,
    };
  };

  // Сохранение контрольной суммы
  const handleSave = async () => {
    setLoading(true);
    try {
      // Находим отчет для выбранной даты и станции
      const reportQuery = query(
        collection(db, collectionName),
        where("stationId", "==", selectedStation.id),
        where("reportDate", "==", reportDate)
      );

      const snapshot = await getDocs(reportQuery);

      if (snapshot.empty) {
        toast.error("Танланган сана учун ҳисобот топилмади");
        setLoading(false);
        setIsConfirmModalOpen(false);
        return;
      }

      const reportDoc = snapshot.docs[0];
      const reportData = reportDoc.data();

      const numericValue = parseFloat(
        controlSum.replace(/\s/g, "").replace(",", ".")
      );

      // Проверяем соответствие суммы
      const { actualAmount, isMatch, paymentSystem } = verifyAmount(reportData);

      if (!isMatch) {
        const shouldContinue = window.confirm(
          `Ўзгартириш суммаси ${paymentSystem} суммасига (${actualAmount.toLocaleString(
            "ru-RU",
            { minimumFractionDigits: 2 }
          )} сўм) мос келмайди. Давом эттирасизми?`
        );

        if (!shouldContinue) {
          setLoading(false);
          setIsConfirmModalOpen(false);
          return;
        }
      }

      // Обновляем контрольную сумму и дополнительные поля
      await updateDoc(doc(db, collectionName, reportDoc.id), {
        generalData: {
          ...reportData.generalData,
          [currentPaymentMethod.fieldName]: numericValue,
          [`${currentPaymentMethod.fieldName}Receipt`]: receiptNumber,
          [`${currentPaymentMethod.fieldName}PaymentDate`]: paymentDate,
        },
      });

      toast.success("Назорат сумма мувафақиятли сақланди");
      resetForm();
      setIsConfirmModalOpen(false);
      onSaved();
      onClose();
    } catch (error) {
      console.error("Ошибка сохранения контрольной суммы:", error);
      toast.error("Сақлашда хатолик");
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
    if (hasExistingControlSum) return;
    const formattedValue = formatNumberInput(value);
    setControlSum(formattedValue);
  };

  // Форматирование даты для отображения
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Получение доступных дат для выбора
  const getMinMaxDates = () => {
    const now = new Date();
    const maxDate = now.toISOString().split("T")[0];

    // Минимальная дата - начало 2025 года
    const minDate = "2025-01-01";

    return { minDate, maxDate };
  };

  const { minDate, maxDate } = getMinMaxDates();

  // Получение цвета заголовка
  const getHeaderColor = () => {
    if (!currentPaymentMethod) return "from-teal-600 to-teal-700";

    const dbFieldName = currentPaymentMethod.dbFieldName;
    if (dbFieldName === "zhisobot" || dbFieldName === "total")
      return "from-green-600 to-green-700";
    if (dbFieldName === "humo") return "from-blue-600 to-blue-700";
    if (dbFieldName === "uzcard") return "from-purple-600 to-purple-700";
    if (dbFieldName === "click") return "from-red-600 to-red-700";
    if (dbFieldName === "payme") return "from-yellow-600 to-yellow-700";
    if (dbFieldName === "paynet") return "from-indigo-600 to-indigo-700";

    return "from-teal-600 to-teal-700";
  };

  if (!isOpen || !currentPaymentMethod) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Заголовок */}
              <div
                className={`p-6 border-b bg-gradient-to-r text-white ${getHeaderColor()}`}
              >
                <h3 className="text-xl font-semibold text-center">
                  {currentPaymentMethod.name}
                </h3>
                <p className="text-sm text-white/80 text-center mt-1">
                  {selectedStation?.stationName}
                </p>
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
                    Заправка асосий сахифада танланган
                  </p>
                </div>

                {/* Дата отчета */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ҳисобот санаси *
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
                    min={minDate}
                    max={maxDate}
                  />
                  {hasExistingControlSum && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start">
                        <svg
                          className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-red-700">
                            ⚠️ Назорат сумма мавжуд
                          </p>
                          <div className="mt-2 text-sm text-red-600 space-y-1">
                            <p>
                              <span className="font-medium">Сумма:</span>{" "}
                              {existingSum.value.toLocaleString("ru-RU", {
                                minimumFractionDigits: 2,
                              })}{" "}
                              сўм
                            </p>
                            <p>
                              <span className="font-medium">Квитанция:</span>{" "}
                              {existingSum.receiptNumber || "Кўрсатилмаган"}
                            </p>
                            <p>
                              <span className="font-medium">
                                Дата поступления:
                              </span>{" "}
                              {existingSum.paymentDate || "Кўрсатилмаган"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Контрольная сумма */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Назорат сумма *{hasExistingControlSum && " (блокланган)"}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`w-full px-3 py-2 border rounded-lg no-spinner text-lg font-medium ${
                      hasExistingControlSum
                        ? "bg-gray-100 border-gray-300 cursor-not-allowed"
                        : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    }`}
                    value={controlSum}
                    onChange={(e) => handleControlSumChange(e.target.value)}
                    disabled={loading || hasExistingControlSum}
                    placeholder={hasExistingControlSum ? "Блокланган" : "0"}
                  />
                  {hasExistingControlSum && (
                    <p className="text-sm text-red-600 mt-1">
                      Назорат сумма мавжуд
                    </p>
                  )}
                </div>

                {/* Номер квитанции */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Квитанция рақами *
                  </label>
                  <input
                    type="text"
                    className={`w-full px-3 py-2 border rounded-lg ${
                      hasExistingControlSum
                        ? "bg-gray-100 border-gray-300 cursor-not-allowed"
                        : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    }`}
                    value={receiptNumber}
                    onChange={(e) =>
                      !hasExistingControlSum && setReceiptNumber(e.target.value)
                    }
                    disabled={loading || hasExistingControlSum}
                    placeholder={
                      hasExistingControlSum
                        ? "Блокланган"
                        : "Квитанция рақамини киритинг"
                    }
                    maxLength={50}
                  />
                  <p className="text-sm text-gray-500 mt-1">Квитанция рақами</p>
                </div>

                {/* Дата поступления в расчетный счет */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ҳисоб рақамга тушган сана *
                  </label>
                  <input
                    type="date"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      hasExistingControlSum
                        ? "bg-gray-100 border-gray-300 cursor-not-allowed"
                        : "border-gray-300"
                    }`}
                    value={paymentDate}
                    onChange={(e) =>
                      !hasExistingControlSum && setPaymentDate(e.target.value)
                    }
                    disabled={loading || hasExistingControlSum}
                    max={maxDate}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Ҳисоб рақамга топширилган сана
                  </p>
                </div>

                {/* Информационное сообщение */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg
                      className="w-5 h-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        Маълумот:
                      </p>
                      <ul className="mt-1 text-sm text-blue-700 space-y-1">
                        <li>• Назорат сумма фақат бир марта киритилади</li>
                        <li>
                          • Сақлангандан сўнг қайта таҳрирлаш имконияти мавжуд
                          эмас
                        </li>
                        <li>• Ҳисоботлар кварталлар бўйича сақланади</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Кнопки */}
              <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                  disabled={loading}
                >
                  Бекор
                </button>
                <button
                  onClick={handleOpenConfirmModal}
                  disabled={
                    loading ||
                    !reportDate ||
                    !controlSum ||
                    !receiptNumber ||
                    !paymentDate ||
                    hasExistingControlSum
                  }
                  className={`px-5 py-2 rounded-lg text-white font-medium transition-colors ${
                    hasExistingControlSum
                      ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                      : modalType === "total"
                      ? "bg-green-600 hover:bg-green-700"
                      : modalType === "humo"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : modalType === "uzcard"
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "bg-teal-600 hover:bg-teal-700"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading
                    ? "Текширилмоқда..."
                    : hasExistingControlSum
                    ? "Блокланган"
                    : "НАЗОРАТ СУММАСИНИ САҚЛАШ"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модальное окно подтверждения сохранения */}
      <AnimatePresence>
        {isConfirmModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-[60] p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsConfirmModalOpen(false)}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-md"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Заголовок */}
              <div
                className={`p-6 border-b bg-gradient-to-r ${getHeaderColor()} text-white`}
              >
                <h3 className="text-xl font-semibold text-center">
                  Сақлашни тасдиқлаш!
                </h3>
                <p className="text-sm text-white/80 text-center mt-1">
                  Киритилган маълумотларни қайта текширинг
                </p>
              </div>

              <div className="p-6">
                {/* Информация о сохранении */}
                <div className="space-y-4">
                  {/* Станция */}
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">Заправка:</span>
                    <span className="font-semibold">
                      {selectedStation?.stationName}
                    </span>
                  </div>

                  {/* Тип контрольной суммы */}
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">
                      Назорат сумма тури:
                    </span>
                    <span className="font-semibold text-green-600">
                      {currentPaymentMethod?.name}
                    </span>
                  </div>

                  {/* Сумма */}
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">Сумма:</span>
                    <span className="text-lg font-bold text-green-600">
                      {controlSum.replace(/\s/g, "").replace(",", ".")} сўм
                    </span>
                  </div>

                  {/* Номер квитанции */}
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">
                      Квитанция рақами:
                    </span>
                    <span className="font-semibold">{receiptNumber}</span>
                  </div>

                  {/* Дата поступления */}
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">
                      Топширилган сана:
                    </span>
                    <span className="font-semibold">
                      {formatDateForDisplay(paymentDate)}
                    </span>
                  </div>

                  {/* Дата отчета */}
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">
                      Ҳисобот санаси:
                    </span>
                    <span className="font-semibold">
                      {formatDateForDisplay(reportDate)}
                    </span>
                  </div>
                </div>

                {/* Предупреждение */}
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start">
                    <svg
                      className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-yellow-800">
                        Муҳим: сақлангандан сўнг таҳрирлаш имконияти мавжуд
                        эмас!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Кнопки подтверждения */}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setIsConfirmModalOpen(false)}
                    disabled={loading}
                    className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50"
                  >
                    Бекор
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className={`px-5 py-2 rounded-lg text-white font-medium transition-colors bg-gradient-to-r ${getHeaderColor()} disabled:opacity-50 flex items-center`}
                  >
                    {loading ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Сақланмоқда...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        ТАСДИҚЛАШ ВА САҚЛАШ
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .no-spinner::-webkit-outer-spin-button,
        .no-spinner::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinner {
          -moz-appearance: textfield;
        }
      `}</style>
    </>
  );
};

export default ControlSumModal;
