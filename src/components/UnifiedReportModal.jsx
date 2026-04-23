import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAppStore } from "../lib/zustand";

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ КВАРТАЛЬНЫХ КОЛЛЕКЦИЙ ==========

// Функция для определения номера квартала по дате
const getQuarterFromDate = (dateString) => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;

  if (month >= 1 && month <= 3) return "I";
  if (month >= 4 && month <= 6) return "II";
  if (month >= 7 && month <= 9) return "III";
  if (month >= 10 && month <= 12) return "IV";

  return "I";
};

// Функция для получения имени коллекции по кварталу и году
const getCollectionNameByDate = (reportDate) => {
  const date = new Date(reportDate);
  const year = date.getFullYear();
  const quarter = getQuarterFromDate(reportDate);
  return `unifiedDailyReports_${quarter}_${year}`;
};

// Функция для проверки существующего отчета в правильной коллекции
const checkExistingReportInQuarterCollection = async (
  db,
  stationId,
  reportDate,
) => {
  try {
    const collectionName = getCollectionNameByDate(reportDate);
    const collectionRef = collection(db, collectionName);

    const reportQuery = query(
      collectionRef,
      where("stationId", "==", stationId),
      where("reportDate", "==", reportDate),
    );

    const snapshot = await getDocs(reportQuery);
    return !snapshot.empty;
  } catch (error) {
    if (error.code === "not-found") {
      return false;
    }
    console.error(
      "Error checking existing report in quarter collection:",
      error,
    );
    return false;
  }
};

// Функция для сохранения в правильную коллекцию
const saveReportToQuarterCollection = async (db, reportData) => {
  const collectionName = getCollectionNameByDate(reportData.reportDate);
  const collectionRef = collection(db, collectionName);
  return await addDoc(collectionRef, reportData);
};

// Функция для загрузки последнего отчета из всех квартальных коллекций
const getLastReportFromAllQuarterCollections = async (db, stationId) => {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    let currentQuarter;
    if (currentMonth >= 1 && currentMonth <= 3) currentQuarter = "I";
    else if (currentMonth >= 4 && currentMonth <= 6) currentQuarter = "II";
    else if (currentMonth >= 7 && currentMonth <= 9) currentQuarter = "III";
    else currentQuarter = "IV";

    const collectionsToSearch = [];

    for (let i = 0; i < 8; i++) {
      let quarter = currentQuarter;
      let year = currentYear;

      for (let j = 0; j < i; j++) {
        if (quarter === "I") {
          quarter = "IV";
          year--;
        } else if (quarter === "II") {
          quarter = "I";
        } else if (quarter === "III") {
          quarter = "II";
        } else {
          quarter = "III";
        }
      }

      const collectionName = `unifiedDailyReports_${quarter}_${year}`;
      if (!collectionsToSearch.includes(collectionName)) {
        collectionsToSearch.push(collectionName);
      }
    }

    let latestReport = null;
    let latestReportDate = null;

    for (const collectionName of collectionsToSearch) {
      try {
        const collectionRef = collection(db, collectionName);
        const reportQuery = query(
          collectionRef,
          where("stationId", "==", stationId),
        );
        const snapshot = await getDocs(reportQuery);

        if (!snapshot.empty) {
          snapshot.docs.forEach((doc) => {
            const reportData = doc.data();
            const reportDate = reportData.reportDate;

            if (!latestReportDate || reportDate > latestReportDate) {
              latestReportDate = reportDate;
              latestReport = {
                ...reportData,
                id: doc.id,
                collectionName: collectionName,
              };
            }
          });
        }
      } catch (error) {
        if (
          error.code === "not-found" ||
          error.code === "failed-precondition"
        ) {
          // Пропускаем
        }
      }
    }

    return latestReport;
  } catch (error) {
    console.error("Ошибка при поиске отчетов:", error);
    return null;
  }
};

// Функция для удаления отчета из квартальной коллекции
const deleteReportFromQuarterCollection = async (
  db,
  collectionName,
  reportId,
) => {
  try {
    const reportRef = doc(db, collectionName, reportId);
    await deleteDoc(reportRef);
    return true;
  } catch (error) {
    console.error("Error deleting report from quarter collection:", error);
    return false;
  }
};

// ОБНОВЛЕННЫЙ компонент модального окна для установки цены
const PriceSetupModal = ({
  isOpen,
  onClose,
  partnerData,
  onSave,
  previousReportDate,
  stationId,
}) => {
  const [price, setPrice] = useState("");
  const [priceDate, setPriceDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingPriceForDate, setExistingPriceForDate] = useState(false);

  // Инициализация при открытии
  useEffect(() => {
    if (isOpen && partnerData) {
      setPrice(partnerData.currentPrice || "");

      // Устанавливаем дату по умолчанию: следующий день после последнего отчета
      let defaultDate;
      if (previousReportDate) {
        const nextDay = new Date(previousReportDate);
        nextDay.setDate(nextDay.getDate() + 1);
        defaultDate = nextDay.toISOString().split("T")[0];
      } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        defaultDate = yesterday.toISOString().split("T")[0];
      }

      setPriceDate(defaultDate);
      setError("");
      setExistingPriceForDate(false);

      // Проверяем, есть ли уже цена на выбранную дату
      checkExistingPriceForDate(partnerData.partnerId, defaultDate);
    }
  }, [isOpen, partnerData, previousReportDate]);

  // Функция для проверки существующей цены на конкретную дату
  const checkExistingPriceForDate = async (partnerId, date) => {
    try {
      const contractRef = doc(db, "contracts", partnerId);
      const contractDoc = await getDoc(contractRef);

      if (contractDoc.exists()) {
        const contractData = contractDoc.data();

        if (contractData.prices && Array.isArray(contractData.prices)) {
          const priceForDate = contractData.prices.find(
            (price) => price.priceDate === date,
          );

          if (priceForDate) {
            setExistingPriceForDate(true);
            toast.error(`${date} сана учун нарх аллакачон ўрнатилган`);
          } else {
            setExistingPriceForDate(false);
          }
        }
      }
    } catch (error) {
      console.error("Error checking existing price:", error);
    }
  };

  // Валидация ввода
  const formatNumberInput = (value) => {
    if (value === "" || value === null || value === undefined) return "";

    const stringValue = String(value);
    const validChars = /^[\d,.]*$/;

    if (!validChars.test(stringValue)) {
      return stringValue.slice(0, -1);
    }

    const parts = stringValue.split(".");
    if (parts.length > 1 && parts[1].length > 2) {
      return parts[0] + "." + parts[1].substring(0, 2);
    }

    return stringValue;
  };

  // ОБНОВЛЕННАЯ валидация даты - теперь можно на любую дату, если нет отчета
  const validateDate = (date) => {
    if (!date) return "Санани киритинг";

    // Проверяем, чтобы дата не была раньше предыдущего отчета
    if (previousReportDate && date <= previousReportDate) {
      return `Сана ${previousReportDate} дан кейинги булиши керак`;
    }

    // Убираем проверку на сегодняшнюю дату
    return "";
  };

  const handlePriceChange = (value) => {
    setPrice(formatNumberInput(value));
  };

  const handleDateChange = async (date) => {
    setPriceDate(date);
    const errorMsg = validateDate(date);
    setError(errorMsg);

    if (!errorMsg && partnerData) {
      await checkExistingPriceForDate(partnerData.partnerId, date);
    }
  };

  const handleSave = async () => {
    if (!price || parseFloat(price) <= 0) {
      toast.error("Нархни тўғри киритинг");
      return;
    }

    if (!priceDate) {
      toast.error("Санани киритинг");
      return;
    }

    const dateError = validateDate(priceDate);
    if (dateError) {
      setError(dateError);
      toast.error(dateError);
      return;
    }

    if (existingPriceForDate) {
      toast.error(`${priceDate} сана учун нарх аллакачон ўрнатилган`);
      return;
    }

    setLoading(true);
    try {
      await onSave(partnerData.partnerId, parseFloat(price), priceDate);
      onClose();
      toast.success("Нарх мувафақиятли ўрнатилди");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Хатолик юз берди");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !partnerData) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-[100] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b bg-gradient-to-r from-purple-600 to-purple-700 text-white flex-shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-semibold">
                    Хамкор учун нарх ўрнатиш
                  </h3>
                  <p className="text-purple-100 mt-1">
                    {partnerData.partnerName}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Хамкор:</span>
                      <div className="font-semibold mt-1">
                        {partnerData.partnerName}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-gray-600">Договор №:</span>
                        <div className="font-semibold mt-1">
                          {partnerData.contractNumber}
                        </div>
                      </div>
                      {partnerData.autoId && (
                        <div>
                          <span className="text-gray-600">AutoID:</span>
                          <div className="font-semibold mt-1">
                            {partnerData.autoId}
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-600">Жорий нарх:</span>
                      <div className="font-semibold mt-1 text-lg">
                        {partnerData.currentPrice
                          ? `${parseFloat(partnerData.currentPrice).toLocaleString("ru-RU")} сўм`
                          : "Ўрнатилмаган"}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    1 м³ нархи (сўм) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 no-spinner text-lg text-right font-semibold"
                    placeholder="Например: 5200"
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Нархни ўрнатиш санаси *
                  </label>
                  <input
                    type="date"
                    value={priceDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className={`w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                      error
                        ? "border-red-500 ring-2 ring-red-200"
                        : "border-gray-300"
                    }`}
                    disabled={loading}
                  />
                  {error && (
                    <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                      {error}
                    </p>
                  )}
                  {previousReportDate && !error && (
                    <p className="mt-1 text-sm text-gray-500">
                      Охирги ҳисобот санаси: {previousReportDate}
                    </p>
                  )}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="mr-3 text-yellow-600">⚠️</div>
                    <div>
                      <p className="text-sm font-medium text-yellow-800 mb-1">
                        Эслатма:
                      </p>
                      <ul className="text-xs text-yellow-700 space-y-1">
                        <li>• Нарх ҳар қандай санага ўрнатилиши мумкин</li>
                        <li>
                          • Нарх фақат ҳисобот яратилмаган саналар учун
                          ўзгартирилиши мумкин
                        </li>
                        <li>
                          • Ҳар бир сана учун фақат 1 марта нарх ўрнатилади
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-2">
                    Охирги нархлар:
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {partnerData.priceHistory &&
                    partnerData.priceHistory.length > 0 ? (
                      partnerData.priceHistory.map((priceItem, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center text-sm p-2 bg-white rounded border"
                        >
                          <div>
                            <span className="font-medium">
                              {priceItem.priceDate}
                            </span>
                            <div className="text-xs text-gray-500">
                              {priceItem.setBy}
                            </div>
                          </div>
                          <div className="font-bold text-blue-700">
                            {parseFloat(priceItem.pricePerM3).toLocaleString(
                              "ru-RU",
                            )}{" "}
                            сўм
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-2">
                        Нархлар тарихи мавжуд эмас
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Бекор
              </button>
              <button
                onClick={handleSave}
                disabled={loading || existingPriceForDate}
                className={`px-5 py-2 rounded-xl font-semibold ${
                  existingPriceForDate
                    ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                    : "bg-purple-600 text-white hover:bg-purple-700"
                } disabled:opacity-50`}
              >
                {loading ? "Сақланмоқда..." : "Сақлаш"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Компонент для полей ввода платежных систем
const PaymentInputField = React.memo(
  ({ method, value, onChange, disabled, required }) => {
    const inputRef = useRef(null);

    const handleChange = (e) => {
      const newValue = e.target.value;
      onChange(method.dbFieldName, newValue);
    };

    const handleFocus = (e) => {
      e.target.select();
    };

    return (
      <div className="relative">
        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
          {method.name}
          {required && <span className="text-red-500 ml-1">*</span>}
          <div className="relative group ml-1">
            <button
              type="button"
              className="w-4 h-4 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs hover:bg-blue-200 transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              ?
            </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 pointer-events-none">
              <div className="font-medium mb-1">{method.name}</div>
              <div className="text-gray-300">{method.description}</div>
              <div className="mt-2 pt-2 border-t border-gray-700 text-blue-300">
                База майдони: {method.dbFieldName}
              </div>
              <div className="mt-1 text-xs">
                Статус: {method.isActive === 1 ? "Актив" : "Неактив"}
              </div>
            </div>
          </div>
          {disabled && (
            <span className="ml-2 px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
              Неактив
            </span>
          )}
        </label>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          disabled={disabled}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner transition-colors ${
            disabled
              ? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed"
              : required && (!value || value.trim() === "")
                ? "border-red-300 bg-red-50 focus:bg-white"
                : "border-gray-300 hover:border-blue-400"
          }`}
          placeholder="0"
          required={required}
        />
        {disabled && (
          <div className="mt-1 text-xs text-gray-500">
            Автоматически установлено в 0 (неактивный метод)
          </div>
        )}
      </div>
    );
  },
);

PaymentInputField.displayName = "PaymentInputField";

const UnifiedReportModal = ({ isOpen, onClose, station, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState("");
  const [dateDisabled, setDateDisabled] = useState(false);
  const [savedReportId, setSavedReportId] = useState(null);
  const [savedReportCollection, setSavedReportCollection] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [selectedPartnerData, setSelectedPartnerData] = useState(null);
  const [previousReportDateForPartner, setPreviousReportDateForPartner] =
    useState("");
  const [partnerData, setPartnerData] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [hoseRows, setHoseRows] = useState([]);
  const [hoseTotal, setHoseTotal] = useState(0);
  const [hoseTotalSum, setHoseTotalSum] = useState(0);
  const [generalData, setGeneralData] = useState({
    autopilotReading: "",
    gasPrice: "",
  });
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentValues, setPaymentValues] = useState({});

  const userData = useAppStore((state) => state.userData);

  const hosesCount = React.useMemo(() => {
    const d = Array.isArray(station?.dispensers)
      ? station.dispensers.length
      : 0;
    return d * 2;
  }, [station?.dispensers]);

  const hoseNames = React.useMemo(() => {
    return Array.from({ length: hosesCount }, (_, i) => `Шланг-${i + 1}`);
  }, [hosesCount]);

  const activePaymentMethods = React.useMemo(() => {
    return paymentMethods.filter((method) => method.isActive === 1);
  }, [paymentMethods]);

  const addDays = useCallback((dateString, days) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }, []);

  const loadPaymentMethods = useCallback(async () => {
    try {
      const paymentMethodsCollection = collection(db, "paymentMethods");
      const snapshot = await getDocs(paymentMethodsCollection);
      let methods = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      methods.sort((a, b) => {
        if (a.isActive !== b.isActive) return b.isActive - a.isActive;
        return (a.name || "").localeCompare(b.name || "");
      });
      const initialValues = {};
      methods.forEach((method) => {
        initialValues[method.dbFieldName] = method.isActive === 1 ? "" : "0";
      });
      setPaymentMethods(methods);
      setPaymentValues(initialValues);
      return methods;
    } catch (error) {
      const fallbackMethods = [
        {
          id: "humo_terminal_fallback",
          dbFieldName: "humo_terminal",
          name: "Хумо терминал",
          description: "Терминал платёжной системы Хумо",
          isActive: 1,
        },
        {
          id: "uzcard_terminal_fallback",
          dbFieldName: "uzcard_terminal",
          name: "Узкард терминал",
          description: "Терминал платёжной системы Узкард",
          isActive: 1,
        },
        {
          id: "electronic_payment_system_fallback",
          dbFieldName: "electronic_payment_system",
          name: "Электрон тўлов тизими",
          description: "Электронные платежи через мобильные приложения",
          isActive: 1,
        },
        {
          id: "zhisobot_fallback",
          dbFieldName: "zhisobot",
          name: "Z-ҳисобот",
          description: "Наличные деньги (Z-отчет)",
          isActive: 1,
        },
      ];
      const initialValues = {};
      fallbackMethods.forEach((method) => {
        initialValues[method.dbFieldName] = method.isActive === 1 ? "" : "0";
      });
      setPaymentMethods(fallbackMethods);
      setPaymentValues(initialValues);
      return fallbackMethods;
    }
  }, []);

  const getMeterResetData = useCallback(async (stationId, reportDate) => {
    if (!stationId || !reportDate) return [];
    try {
      const [year, month, day] = reportDate.split("-");
      const resetDateFormatted = `${day}-${month}-${year}`;
      const resetQuery = query(
        collection(db, "meterResetEvents"),
        where("stationId", "==", stationId),
        where("resetDate", "==", resetDateFormatted),
      );
      const snapshot = await getDocs(resetQuery);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      return [];
    }
  }, []);

  const formatNumberInput = useCallback((value) => {
    if (value === "" || value === null || value === undefined) return "";
    const stringValue = String(value);
    const validChars = /^-?[\d,.]*$/;
    if (!validChars.test(stringValue)) return stringValue.slice(0, -1);
    if (stringValue.includes("-") && stringValue.indexOf("-") > 0)
      return stringValue.replace(/-/g, "");
    const parts = stringValue.split(".");
    if (parts.length > 1 && parts[1].length > 2)
      return parts[0] + "." + parts[1].substring(0, 2);
    return stringValue;
  }, []);

  const formatNumberForDisplay = useCallback((value) => {
    try {
      if (value === "" || value === null || value === undefined) return "";
      if (value === "-") return "-";
      const stringValue = String(value);
      const hasMinus = stringValue.startsWith("-");
      const numberString = hasMinus ? stringValue.substring(1) : stringValue;
      if (numberString === "" || numberString === "0")
        return hasMinus ? "-0" : "0";
      const cleanNumberString = numberString.replace(",", ".");
      const number = parseFloat(cleanNumberString);
      if (isNaN(number)) return stringValue;
      const formatted = number.toLocaleString("ru-RU", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      });
      return hasMinus ? `-${formatted}` : formatted;
    } catch (error) {
      return String(value);
    }
  }, []);

  const parseFormattedNumber = useCallback((value) => {
    if (!value || value === "-" || value.trim() === "") return 0;
    try {
      const stringValue = String(value);
      const hasMinus = stringValue.startsWith("-");
      const cleaned = stringValue.replace(/\s/g, "").replace(/,/g, ".");
      const numberString = hasMinus ? cleaned.substring(1) : cleaned;
      const number = parseFloat(numberString) || 0;
      return hasMinus ? -number : number;
    } catch (error) {
      return 0;
    }
  }, []);

  const checkExistingReport = useCallback(async () => {
    if (!station?.id || !reportDate) return false;
    try {
      const exists = await checkExistingReportInQuarterCollection(
        db,
        station.id,
        reportDate,
      );
      if (exists) toast.error("Бу санага ҳисобот мавжуд");
      return exists;
    } catch (error) {
      console.error("Error checking existing report:", error);
      return false;
    }
  }, [station?.id, reportDate]);

  const getLatestPartnerReportDate = async (partnerId) => {
    try {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentQuarter = getQuarterFromDate(
        currentDate.toISOString().split("T")[0],
      );
      const quartersToSearch = [currentQuarter];
      const yearsToSearch = [currentYear];
      if (currentQuarter === "I") {
        quartersToSearch.push("IV");
        yearsToSearch.push(currentYear - 1);
      } else if (currentQuarter === "II") {
        quartersToSearch.push("I");
      } else if (currentQuarter === "III") {
        quartersToSearch.push("II");
      } else {
        quartersToSearch.push("III");
      }
      let latestReportDate = null;
      for (const year of yearsToSearch) {
        for (const quarter of quartersToSearch) {
          const collectionName = `unifiedDailyReports_${quarter}_${year}`;
          try {
            const collectionRef = collection(db, collectionName);
            const reportQuery = query(
              collectionRef,
              where("stationId", "==", station.id),
              where("partnerData", "array-contains", {
                field: "partnerId",
                value: partnerId,
              }),
              orderBy("reportDate", "desc"),
              limit(1),
            );
            const snapshot = await getDocs(reportQuery);
            if (!snapshot.empty) {
              const report = snapshot.docs[0];
              const reportDate = report.data().reportDate;
              if (!latestReportDate || reportDate > latestReportDate)
                latestReportDate = reportDate;
            }
          } catch (error) {
            if (
              error.code !== "not-found" &&
              error.code !== "failed-precondition"
            ) {
              console.error(`Error searching in ${collectionName}:`, error);
            }
          }
        }
      }
      return latestReportDate;
    } catch (error) {
      console.error("Error getting partner report date:", error);
      return null;
    }
  };

  const loadAndApplyResetData = useCallback(
    async (stationId, reportDate, hasPreviousReport, lastReport) => {
      if (!stationId || !reportDate) return [];
      const resetEvents = await getMeterResetData(stationId, reportDate);
      if (resetEvents.length > 0) {
        setHoseRows((prevRows) =>
          prevRows.map((row) => {
            const hoseResetEvents = resetEvents.filter(
              (event) => event.hose === row.hose,
            );
            if (hoseResetEvents.length > 0) {
              const latestReset = hoseResetEvents[0];
              return {
                ...row,
                prev: latestReset.newReadingAfterReset,
                hasReset: true,
                resetInfo: latestReset,
                prevDisabled: true,
              };
            } else {
              if (hasPreviousReport && lastReport && lastReport.hoseData) {
                const lastHose = lastReport.hoseData.find(
                  (h) => h.hose === row.hose,
                );
                if (lastHose)
                  return {
                    ...row,
                    prev: lastHose.current || 0,
                    hasReset: false,
                    resetInfo: null,
                    prevDisabled: true,
                  };
              }
              return {
                ...row,
                hasReset: false,
                resetInfo: null,
                prevDisabled: false,
              };
            }
          }),
        );
      } else {
        if (hasPreviousReport && lastReport && lastReport.hoseData) {
          setHoseRows((prevRows) =>
            prevRows.map((row) => {
              const lastHose = lastReport.hoseData.find(
                (h) => h.hose === row.hose,
              );
              if (lastHose)
                return {
                  ...row,
                  prev: lastHose.current || 0,
                  prevDisabled: true,
                };
              return row;
            }),
          );
        }
      }
      return resetEvents;
    },
    [getMeterResetData],
  );

  const getLatestPartnerPrice = async (partnerId) => {
    try {
      const contractRef = doc(db, "contracts", partnerId);
      const contractDoc = await getDoc(contractRef);
      if (!contractDoc.exists()) return 0;
      const contractData = contractDoc.data();
      if (contractData.prices && Array.isArray(contractData.prices)) {
        const sortedPrices = [...contractData.prices].sort((a, b) => {
          const dateA = a.priceDate ? new Date(a.priceDate) : new Date(0);
          const dateB = b.priceDate ? new Date(b.priceDate) : new Date(0);
          return dateB - dateA;
        });
        if (sortedPrices.length > 0) return sortedPrices[0].pricePerM3 || 0;
      }
      if (contractData.transactions && contractData.transactions.length > 0) {
        const sortedTransactions = [...contractData.transactions].sort(
          (a, b) => {
            const dateA = a.reportDate ? new Date(a.reportDate) : new Date(0);
            const dateB = b.reportDate ? new Date(b.reportDate) : new Date(0);
            return dateB - dateA;
          },
        );
        if (sortedTransactions.length > 0)
          return sortedTransactions[0].pricePerM3 || 0;
      }
      return 0;
    } catch (error) {
      console.error("Error getting partner price:", error);
      return 0;
    }
  };

  const getPartnerPriceHistory = async (partnerId) => {
    try {
      const contractRef = doc(db, "contracts", partnerId);
      const contractDoc = await getDoc(contractRef);
      if (!contractDoc.exists()) return [];
      const contractData = contractDoc.data();
      if (contractData.prices && Array.isArray(contractData.prices)) {
        return [...contractData.prices]
          .sort((a, b) => {
            const dateA = a.priceDate ? new Date(a.priceDate) : new Date(0);
            const dateB = b.priceDate ? new Date(b.priceDate) : new Date(0);
            return dateB - dateA;
          })
          .slice(0, 5);
      }
      return [];
    } catch (error) {
      console.error("Error getting price history:", error);
      return [];
    }
  };

  const savePartnerPrice = async (partnerId, price, priceDate) => {
    try {
      const contractRef = doc(db, "contracts", partnerId);
      const contractDoc = await getDoc(contractRef);
      if (!contractDoc.exists()) throw new Error("Contract not found");
      const contractData = contractDoc.data();
      const currentPrices = contractData.prices || [];
      const existingPriceForDate = currentPrices.find(
        (p) => p.priceDate === priceDate,
      );
      if (existingPriceForDate) {
        toast.error("Ушбу сана учун нарх аллакачон мавжуд");
        return;
      }
      const newPriceEntry = {
        pricePerM3: price,
        priceDate: priceDate,
        setBy: auth?.currentUser?.email || "unknown",
        setAt: new Date().toISOString(),
        stationId: station.id,
        stationName: station.stationName,
      };
      const updatedPrices = [...currentPrices, newPriceEntry];
      updatedPrices.sort(
        (a, b) => new Date(b.priceDate) - new Date(a.priceDate),
      );
      await updateDoc(contractRef, {
        prices: updatedPrices,
        lastUpdated: serverTimestamp(),
      });
      setPartnerData((prev) =>
        prev.map((partner) => {
          if (partner.partnerId === partnerId)
            return { ...partner, pricePerM3: price };
          return partner;
        }),
      );
    } catch (error) {
      console.error("Error saving price:", error);
      throw error;
    }
  };

  const handlePaymentValueChange = useCallback(
    (dbFieldName, value) => {
      const formattedValue = formatNumberInput(value);
      setPaymentValues((prev) => {
        if (prev[dbFieldName] === formattedValue) return prev;
        return { ...prev, [dbFieldName]: formattedValue };
      });
    },
    [formatNumberInput],
  );

  const handleGeneralInputChange = useCallback(
    (field, value) => {
      const formattedValue = formatNumberInput(value);
      setGeneralData((prev) => {
        if (prev[field] === formattedValue) return prev;
        return { ...prev, [field]: formattedValue };
      });
    },
    [formatNumberInput],
  );

  const initializeData = async () => {
    if (!isOpen || !station?.id) return;
    try {
      setLoading(true);
      await loadPaymentMethods();
      const lastReport = await getLastReportFromAllQuarterCollections(
        db,
        station.id,
      );
      const hasPreviousReport = lastReport !== null;
      let nextDate = "";
      if (hasPreviousReport) {
        nextDate = addDays(lastReport.reportDate, 1);
        setReportDate(nextDate);
        setDateDisabled(true);
        if (lastReport.paymentData) {
          const newPaymentValues = {};
          paymentMethods.forEach((method) => {
            if (lastReport.paymentData[method.dbFieldName] !== undefined) {
              newPaymentValues[method.dbFieldName] =
                lastReport.paymentData[method.dbFieldName].toString() || "";
            }
          });
          setPaymentValues((prev) => ({ ...prev, ...newPaymentValues }));
        }
      } else {
        const today = new Date().toISOString().split("T")[0];
        setReportDate(today);
        setDateDisabled(false);
      }
      const contractsQuery = query(
        collection(db, "contracts"),
        where("stationId", "==", station.id),
      );
      const contractsSnapshot = await getDocs(contractsQuery);
      const contractsData = contractsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const sortedContracts = [...contractsData].sort((a, b) => {
        const autoIdA = a.autoId || 0;
        const autoIdB = b.autoId || 0;
        if (autoIdA !== autoIdB) return autoIdA - autoIdB;
        return (a.partner || "").localeCompare(b.partner || "");
      });
      setContracts(sortedContracts);
      const initializedPartnerData = await Promise.all(
        sortedContracts.map(async (contract) => {
          const latestPrice = await getLatestPartnerPrice(contract.id);
          return {
            partnerId: contract.id,
            partnerName: contract.partner,
            contractNumber: contract.contractNumber,
            pricePerM3: latestPrice,
            soldM3: "",
            totalAmount: 0,
            autoId: contract.autoId || 0,
          };
        }),
      );
      setPartnerData(initializedPartnerData);
      const initializedHoseRows = hoseNames.map((name) => {
        let prev = 0;
        let price = 0;
        let prevDisabled = false;
        if (hasPreviousReport && lastReport.hoseData) {
          const lastHose = lastReport.hoseData.find((h) => h.hose === name);
          if (lastHose) {
            prev = lastHose.current || 0;
            price = lastHose.price || 0;
            prevDisabled = true;
          } else {
            prevDisabled = false;
          }
        } else {
          prevDisabled = false;
        }
        return {
          hose: name,
          prev,
          current: "",
          price,
          diff: 0,
          sum: 0,
          prevDisabled,
          hasReset: false,
          resetInfo: null,
        };
      });
      setHoseRows(initializedHoseRows);
      if (hasPreviousReport) {
        setGeneralData((prev) => ({
          ...prev,
          autopilotReading: lastReport.generalData?.autopilotReading
            ? lastReport.generalData.autopilotReading.toString()
            : "",
          gasPrice: lastReport.generalData?.gasPrice
            ? lastReport.generalData.gasPrice.toString()
            : "",
        }));
      }
      if (nextDate) {
        await loadAndApplyResetData(
          station.id,
          nextDate,
          hasPreviousReport,
          lastReport,
        );
      }
      if (hasPreviousReport) {
        toast.success(`${lastReport.reportDate} кунги хисобот юкланди`);
      } else {
        toast.info("Базада олдинги хисобот топилмади. Узингиз тулдиринг.");
      }
    } catch (error) {
      toast.error("Маълумотлар юкланишида хатолик");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) initializeData();
  }, [isOpen, station?.id, hoseNames]);

  useEffect(() => {
    if (isOpen) loadPaymentMethods();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && station?.id && reportDate) {
      const reloadResetData = async () => {
        try {
          await loadAndApplyResetData(station.id, reportDate, true, null);
        } catch (error) {}
      };
      reloadResetData();
    }
  }, [reportDate, isOpen, station?.id]);

  const handlePartnerPriceDoubleClick = (partner) => {
    handlePriceSetup(partner);
  };

  const handlePartnerSoldM3Change = (partnerId, soldM3) => {
    if (soldM3 === "") {
      setPartnerData((prev) =>
        prev.map((partner) => {
          if (partner.partnerId === partnerId)
            return { ...partner, soldM3: "", totalAmount: 0 };
          return partner;
        }),
      );
      return;
    }
    const formattedValue = formatNumberInput(soldM3);
    const numericValue = parseFormattedNumber(formattedValue);
    setPartnerData((prev) =>
      prev.map((partner) => {
        if (partner.partnerId === partnerId) {
          const totalAmount = numericValue * partner.pricePerM3;
          return { ...partner, soldM3: formattedValue, totalAmount };
        }
        return partner;
      }),
    );
  };

  const partnerTotals = partnerData.reduce(
    (acc, partner) => {
      const soldM3Value =
        partner.soldM3 === "" ? 0 : parseFormattedNumber(partner.soldM3);
      acc.totalM3 += soldM3Value;
      acc.totalAmount += partner.totalAmount;
      return acc;
    },
    { totalM3: 0, totalAmount: 0 },
  );

  const calculateHoseRowDiff = useCallback(
    (row) => {
      const prev = Number(row.prev) || 0;
      const current =
        row.current === "" ? 0 : parseFormattedNumber(row.current);
      const price = Number(row.price) || 0;
      let diff = 0;
      if (row.hasReset && row.resetInfo) {
        const lastReadingBeforeReset = row.resetInfo.lastReadingBeforeReset;
        const lastReadingFromReport = row.resetInfo.lastReadingFromReport;
        const newReadingAfterReset = row.resetInfo.newReadingAfterReset;
        diff =
          lastReadingBeforeReset -
          lastReadingFromReport +
          (current - newReadingAfterReset);
      } else {
        if (current >= prev) diff = current - prev;
        else diff = 0;
      }
      const sum = diff * price;
      return {
        ...row,
        diff: Math.max(0, isNaN(diff) ? 0 : diff),
        sum: Math.max(0, isNaN(sum) ? 0 : sum),
      };
    },
    [parseFormattedNumber],
  );

  const handleHoseCurrentChange = (index, value) => {
    const formattedValue = formatNumberInput(value);
    setHoseRows((prev) => {
      const newRows = [...prev];
      const updatedRow = { ...newRows[index], current: formattedValue };
      const rowWithDiff = calculateHoseRowDiff(updatedRow);
      newRows[index] = rowWithDiff;
      const totals = newRows.reduce(
        (acc, row) => ({
          totalGas:
            acc.totalGas + (Number(row.diff) > 0 ? Number(row.diff) : 0),
          totalSum: acc.totalSum + Number(row.sum),
        }),
        { totalGas: 0, totalSum: 0 },
      );
      setHoseTotal(totals.totalGas);
      setHoseTotalSum(totals.totalSum);
      return newRows;
    });
  };

  const isHoseReportValid = () => {
    const allCurrentFilled = hoseRows.every(
      (row) =>
        row.current !== "" &&
        row.current !== null &&
        row.current !== undefined &&
        !isNaN(parseFormattedNumber(row.current)),
    );
    if (!allCurrentFilled) return false;
    const hasInvalidCurrent = hoseRows.some((row) => {
      const current = parseFormattedNumber(row.current);
      const prev = Number(row.prev);
      return current < prev && !row.hasReset;
    });
    if (hasInvalidCurrent) return false;
    return true;
  };

  const calculateCashAmount = () => {
    const gasPrice = parseFormattedNumber(generalData.gasPrice);
    let totalPaymentMethods = 0;
    paymentMethods.forEach((method) => {
      if (method.dbFieldName !== "zhisobot" && method.isActive === 1) {
        const value = parseFormattedNumber(
          paymentValues[method.dbFieldName] || 0,
        );
        totalPaymentMethods += value;
      }
    });
    const cashAmount =
      (hoseTotal - partnerTotals.totalM3) * gasPrice - totalPaymentMethods;
    return cashAmount > 0 ? cashAmount : 0;
  };

  const arePaymentMethodsValid = useCallback(() => {
    return activePaymentMethods.every((method) => {
      if (method.dbFieldName === "zhisobot") return true;
      const value = paymentValues[method.dbFieldName];
      if (value === "" || value === null || value === undefined) return false;
      const numericValue = parseFormattedNumber(value);
      return !isNaN(numericValue) && numericValue >= 0;
    });
  }, [activePaymentMethods, paymentValues, parseFormattedNumber]);

  const isGeneralReportValid = useCallback(() => {
    const autopilotValid =
      generalData.autopilotReading &&
      generalData.autopilotReading.trim() !== "" &&
      !isNaN(parseFormattedNumber(generalData.autopilotReading));
    if (!autopilotValid) return false;
    const gasPriceValid =
      generalData.gasPrice &&
      generalData.gasPrice.trim() !== "" &&
      !isNaN(parseFormattedNumber(generalData.gasPrice));
    if (!gasPriceValid) return false;
    const paymentMethodsValid = arePaymentMethodsValid();
    if (!paymentMethodsValid) return false;
    return true;
  }, [
    generalData.autopilotReading,
    generalData.gasPrice,
    arePaymentMethodsValid,
    parseFormattedNumber,
  ]);

  const arePartnersValid = useCallback(() => {
    if (partnerData.length === 0) return true;
    return partnerData.every((partner) => {
      if (
        partner.pricePerM3 === 0 ||
        partner.pricePerM3 === null ||
        partner.pricePerM3 === undefined
      )
        return false;
      if (
        partner.soldM3 === "" ||
        partner.soldM3 === null ||
        partner.soldM3 === undefined
      )
        return false;
      const soldM3Value = parseFormattedNumber(partner.soldM3);
      return !isNaN(soldM3Value) && soldM3Value >= 0;
    });
  }, [partnerData, parseFormattedNumber]);

  const isReportValid = useCallback(() => {
    if (!isHoseReportValid()) return false;
    if (!arePartnersValid()) return false;
    if (!isGeneralReportValid()) return false;
    return true;
  }, [isHoseReportValid, arePartnersValid, isGeneralReportValid]);

  const getClientIP = async () => {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return "Номаълум";
    }
  };

  const savePartnerDataToContracts = async (partnerDataToSave) => {
    try {
      const savePromises = partnerDataToSave.map(async (partner) => {
        const contractRef = doc(db, "contracts", partner.partnerId);
        const contractDoc = await getDoc(contractRef);
        const currentContract = contractDoc.data();
        const partnerTransactionData = {
          reportDate: reportDate,
          soldM3: partner.soldM3,
          pricePerM3: partner.pricePerM3,
          totalAmount: partner.totalAmount,
          paymentSum: 0,
          stationId: station.id,
          stationName: station.stationName,
          createdAt: new Date().toISOString(),
          createdBy: auth?.currentUser?.email || "unknown",
        };
        const currentTransactions = currentContract.transactions || [];
        const updatedTransactions = [
          ...currentTransactions,
          partnerTransactionData,
        ];
        await updateDoc(contractRef, {
          transactions: updatedTransactions,
          lastUpdated: serverTimestamp(),
        });
      });
      await Promise.all(savePromises);
    } catch (error) {
      throw error;
    }
  };

  const handleSaveClick = () => {
    if (!isReportValid()) {
      toast.error("Барча мажбурий майдонларни тўлдиринг");
      return;
    }
    setIsConfirmModalOpen(true);
  };

  const saveUnifiedReport = async () => {
    try {
      setLoading(true);
      const hasExistingReport = await checkExistingReport();
      if (hasExistingReport) {
        setIsConfirmModalOpen(false);
        setLoading(false);
        return;
      }
      const [year, month, day] = reportDate.split("-");
      const resetDateFormatted = `${day}-${month}-${year}`;
      const resetQuery = query(
        collection(db, "meterResetEvents"),
        where("stationId", "==", station.id),
        where("resetDate", "==", resetDateFormatted),
      );
      const resetSnapshot = await getDocs(resetQuery);
      const resetEvents = resetSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const ip = await getClientIP();
      const userEmail = auth?.currentUser?.email || "unknown";
      const cashAmount = calculateCashAmount();
      const hoseData = hoseRows.map((row) => {
        let finalDiff = Number(row.diff) || 0;
        let resetCalculation = null;
        const hoseResetEvents = resetEvents.filter(
          (event) => event.hose === row.hose,
        );
        if (hoseResetEvents.length > 0) {
          const latestReset = hoseResetEvents[0];
          const calculatedDiff =
            latestReset.lastReadingBeforeReset -
            latestReset.lastReadingFromReport +
            (parseFormattedNumber(row.current) -
              latestReset.newReadingAfterReset);
          finalDiff = Math.max(0, calculatedDiff);
          resetCalculation = {
            lastReadingBeforeReset: latestReset.lastReadingBeforeReset,
            lastReadingFromReport: latestReset.lastReadingFromReport,
            newReadingAfterReset: latestReset.newReadingAfterReset,
            calculatedDiff: calculatedDiff,
            finalDiff: finalDiff,
          };
        }
        return {
          hose: row.hose,
          prev: Number(row.prev) || 0,
          current: parseFormattedNumber(row.current) || 0,
          price: Number(row.price) || 0,
          diff: finalDiff,
          sum: finalDiff * (Number(row.price) || 0),
          hasResetCorrection: hoseResetEvents.length > 0,
          resetCalculation: resetCalculation,
          resetNote: hoseResetEvents.length > 0 ? "Кўрсаткич нўлланган" : null,
        };
      });
      const partnerDataToSave = partnerData.map((partner) => ({
        ...partner,
        soldM3: parseFormattedNumber(partner.soldM3),
        paymentSum: 0,
        autoId: partner.autoId,
      }));
      if (partnerDataToSave.length > 0)
        await savePartnerDataToContracts(partnerDataToSave);
      const paymentData = {};
      paymentMethods.forEach((method) => {
        let value = 0;
        if (method.isActive === 1)
          value = parseFormattedNumber(paymentValues[method.dbFieldName] || 0);
        paymentData[method.dbFieldName] = value;
      });
      paymentData.zhisobot = cashAmount;
      const collectionName = getCollectionNameByDate(reportDate);
      const quarter = getQuarterFromDate(reportDate);
      const reportYear = new Date(reportDate).getFullYear();
      const reportData = {
        reportDate,
        stationId: station.id,
        stationName: station.stationName || "Неизвестная станция",
        partnerData: partnerDataToSave,
        partnerTotalM3: partnerTotals.totalM3,
        partnerTotalAmount: partnerTotals.totalAmount,
        partnerTotalPaymentSum: 0,
        hasPartnerData: partnerData.length > 0,
        hoseData: hoseData,
        hoseTotalGas: hoseTotal,
        hoseTotalSum: hoseTotalSum,
        generalData: {
          autopilotReading: parseFormattedNumber(generalData.autopilotReading),
          gasPrice: parseFormattedNumber(generalData.gasPrice),
        },
        paymentData: paymentData,
        paymentMethods: paymentMethods.map((method) => ({
          id: method.id,
          name: method.name,
          dbFieldName: method.dbFieldName,
          description: method.description,
          isActive: method.isActive,
        })),
        createdBy: userEmail,
        createdAt: serverTimestamp(),
        createdIp: ip,
        status: "completed",
        hasMeterResets: resetEvents.length > 0,
        meterResetEventsCount: resetEvents.length,
        quarter: quarter,
        year: reportYear,
        collectionName: collectionName,
      };
      const docRef = await saveReportToQuarterCollection(db, reportData);
      setSavedReportId(docRef.id);
      setSavedReportCollection(collectionName);
      setIsConfirmModalOpen(false);
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error("Save report error:", error);
      toast.error("Ҳисоботни сақлашда хатолик");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    setIsSuccessModalOpen(false);
    setPartnerData([]);
    setHoseRows([]);
    setGeneralData({ autopilotReading: "", gasPrice: "" });
    setPaymentValues({});
    setSavedReportId(null);
    setSavedReportCollection("");
    setSelectedPartnerData(null);
    setPreviousReportDateForPartner("");
    if (onSaved) onSaved();
    onClose();
  };

  const handleClose = async () => {
    if (savedReportId && savedReportCollection) {
      try {
        await deleteReportFromQuarterCollection(
          db,
          savedReportCollection,
          savedReportId,
        );
      } catch (error) {
        console.error("Error deleting report:", error);
      }
    }
    setPartnerData([]);
    setHoseRows([]);
    setGeneralData({ autopilotReading: "", gasPrice: "" });
    setPaymentValues({});
    setSavedReportId(null);
    setSavedReportCollection("");
    setIsConfirmModalOpen(false);
    setIsSuccessModalOpen(false);
    setIsPriceModalOpen(false);
    setSelectedPartnerData(null);
    setPreviousReportDateForPartner("");
    onClose();
  };

  const handlePriceSetup = async (partner) => {
    try {
      setLoading(true);
      const latestReportDate = await getLatestPartnerReportDate(
        partner.partnerId,
      );
      setPreviousReportDateForPartner(latestReportDate || "");
      const currentPrice = await getLatestPartnerPrice(partner.partnerId);
      const priceHistory = await getPartnerPriceHistory(partner.partnerId);
      const partnerFullData = { ...partner, currentPrice, priceHistory };
      setSelectedPartnerData(partnerFullData);
      setIsPriceModalOpen(true);
    } catch (error) {
      console.error("Error opening price modal:", error);
      toast.error("Маълумотларни юклашда хатолик");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-semibold">Кунлик ҳисобот</h3>
                    <p className="text-blue-100 mt-1">
                      {station?.stationName} заправкаси
                    </p>
                  </div>
                  <div className="text-sm bg-blue-500 px-3 py-1 rounded-full">
                    {reportDate || "Санани танланг"}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-6">
                <div className="mb-6 bg-blue-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ҳисобот санаси *
                  </label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    disabled={dateDisabled || loading}
                    className="w-full max-w-xs border border-gray-300 rounded-xl p-3 disabled:bg-gray-100"
                    required
                  />
                  {reportDate && (
                    <div className="mt-2 text-sm text-blue-700">
                      <div className="text-xs text-gray-600 mt-1">
                        {new Date(reportDate).getFullYear()} йил{" "}
                        {getQuarterFromDate(reportDate)} квартал
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-xl">
                      <div className="p-4 border-b bg-gray-50">
                        <h4 className="text-lg font-semibold">
                          Шланглар бўйича ҳисобот
                        </h4>
                        <div className="mt-2 text-sm text-gray-600">
                          Барча шланг учун жорий кўрсаткич киритилиши зарур
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="overflow-x-auto">
                          <table className="w-full table-auto md:table-fixed">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider md:px-3 md:w-1/6">
                                  Шланг
                                </th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider md:px-3 md:w-1/6">
                                  Олдинги кўрсаткич
                                </th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider md:px-3 md:w-1/6">
                                  Жорий кўрсаткич *
                                </th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider md:px-3 md:w-1/6">
                                  Фарқи
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {hoseRows.map((row, index) => {
                                const currentNum = parseFormattedNumber(
                                  row.current,
                                );
                                const prevNum = Number(row.prev);
                                const isInvalid =
                                  row.current !== "" &&
                                  currentNum < prevNum &&
                                  !row.hasReset;
                                return (
                                  <tr
                                    key={row.hose}
                                    className={`hover:bg-gray-50 transition-colors ${row.hasReset ? "bg-yellow-50" : ""}`}
                                  >
                                    <td className="px-3 py-2">
                                      <div className="flex items-center">
                                        <span className="font-semibold text-gray-900 text-xs md:text-sm">
                                          {row.hose}
                                        </span>
                                        {row.hasReset && (
                                          <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                                            🔄 Нўлланган
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-2 py-3 md:px-3 md:w-1/6">
                                      <div className="relative">
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={formatNumberInput(row.prev)}
                                          onChange={(e) => {
                                            const newRows = [...hoseRows];
                                            newRows[index].prev =
                                              parseFormattedNumber(
                                                e.target.value,
                                              ) || 0;
                                            setHoseRows(newRows);
                                          }}
                                          disabled={row.prevDisabled || loading}
                                          className={`w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner text-xs md:text-sm ${row.prevDisabled ? "bg-gray-100 text-gray-600" : "bg-white"}`}
                                          placeholder="0"
                                        />
                                        {row.prevDisabled && (
                                          <div className="absolute -top-2 -right-2">
                                            <span className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                                              авто
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-2 py-3 md:px-3 md:w-1/6">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={row.current}
                                        onChange={(e) =>
                                          handleHoseCurrentChange(
                                            index,
                                            e.target.value,
                                          )
                                        }
                                        className={`w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner text-xs md:text-sm ${
                                          row.current === ""
                                            ? "border-red-300 bg-red-50 focus:bg-white"
                                            : isInvalid
                                              ? "border-red-500 ring-2 ring-red-200"
                                              : "border-gray-300"
                                        }`}
                                        disabled={loading}
                                        required
                                        placeholder="0"
                                      />
                                    </td>
                                    <td className="px-2 py-3 md:px-3 md:w-1/6">
                                      <span
                                        className={`font-semibold text-xs md:text-sm ${row.diff > 0 ? "text-green-600" : "text-gray-500"}`}
                                      >
                                        {formatNumberForDisplay(row.diff)}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div className="bg-blue-50 w-full border border-blue-200 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-semibold text-blue-900 text-sm">
                                  Жами кун давомида (м³)
                                </h4>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-blue-900">
                                  {formatNumberForDisplay(hoseTotal)}
                                </div>
                                <div className="text-blue-700 font-medium text-sm">
                                  м³
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-xl">
                      <div className="p-4 border-b bg-gray-50">
                        <h4 className="text-lg font-semibold">
                          Хамкорлар бўйича ҳисобот{" "}
                          {partnerData.length > 0
                            ? "(тўлдирилиши зарур)"
                            : "(хамкорлар мавжуд эмас)"}
                        </h4>
                        <div className="mt-2 text-sm text-gray-600">
                          Нархни ўрнатиш учун "1м³ нарх" устига икки марта
                          босинг
                        </div>
                      </div>
                      <div className="p-4">
                        {partnerData.length === 0 ? (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                            <p className="text-yellow-700">
                              Бу заправкада хамкорлар мавжуд емас
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="p-2 text-left w-10">№</th>
                                  <th className="p-2 text-left">Партнер</th>
                                  <th className="p-2 text-right w-24">
                                    1м³ нарх (сўм) *
                                  </th>
                                  <th className="p-2 text-right w-24">
                                    Сотилди м³ *
                                  </th>
                                  <th className="p-2 text-right w-24">
                                    Суммаси (сўм)
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {partnerData.map((partner, idx) => (
                                  <tr
                                    key={partner.partnerId}
                                    className="border-t hover:bg-gray-50 group"
                                  >
                                    <td className="p-2 text-center text-gray-500 font-medium">
                                      {partner.autoId || idx + 1}
                                    </td>
                                    <td className="p-2">
                                      <div>
                                        <div className="font-medium">
                                          {partner.partnerName}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          Договор: {partner.contractNumber}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-2">
                                      <div
                                        onDoubleClick={() =>
                                          handlePartnerPriceDoubleClick(partner)
                                        }
                                        className={`w-full text-right border rounded p-2 no-spinner text-sm cursor-pointer transition-all duration-200 ${
                                          partner.pricePerM3 === 0
                                            ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400"
                                            : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400"
                                        } group-hover:shadow-sm`}
                                        title="Икки марта босиб нарх ўрнатиш учун"
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="text-xs text-gray-500">
                                            {partner.pricePerM3 === 0
                                              ? "Нарх"
                                              : ""}
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span className="font-semibold">
                                              {partner.pricePerM3 === 0
                                                ? "Ўрнатилмаган"
                                                : formatNumberForDisplay(
                                                    partner.pricePerM3,
                                                  )}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={partner.soldM3}
                                        onChange={(e) =>
                                          handlePartnerSoldM3Change(
                                            partner.partnerId,
                                            e.target.value,
                                          )
                                        }
                                        className={`w-full text-right border rounded p-2 no-spinner text-sm ${
                                          partner.soldM3 === ""
                                            ? "border-red-300 bg-red-50 focus:bg-white"
                                            : "border-gray-300 focus:border-blue-500"
                                        } focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                                        placeholder="0"
                                        disabled={loading}
                                        required
                                      />
                                    </td>
                                    <td className="p-2 text-right font-semibold text-sm">
                                      {formatNumberForDisplay(
                                        partner.totalAmount,
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              {partnerData.length > 0 && (
                                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                  <tr>
                                    <td
                                      className="p-2 font-semibold"
                                      colSpan="3"
                                    >
                                      Жами:
                                    </td>
                                    <td className="p-2 text-right font-semibold text-sm">
                                      {formatNumberForDisplay(
                                        partnerTotals.totalM3,
                                      )}{" "}
                                      м³
                                    </td>
                                    <td className="p-2 text-right font-semibold text-sm">
                                      {formatNumberForDisplay(
                                        partnerTotals.totalAmount,
                                      )}{" "}
                                      сўм
                                    </td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </div>
                        )}
                        <div className="mt-4 text-xs text-gray-500">
                          * Агар хамкор ушбу кун газ олмаган бўлса, "Сотилди м³"
                          майдонига "0" киритинг
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl">
                      <div className="p-4 border-b bg-gray-50">
                        <h4 className="text-lg font-semibold">
                          Умумий ҳисобот
                        </h4>
                        <div className="mt-2 text-sm text-gray-600">
                          Ҳар бир тўлов усули учун сумма киритинг (Z-ҳисобот
                          автоматически ҳисобланади)
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              AutoPilot кўрсаткичи *
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={generalData.autopilotReading}
                              onChange={(e) =>
                                handleGeneralInputChange(
                                  "autopilotReading",
                                  e.target.value,
                                )
                              }
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner ${
                                generalData.autopilotReading === ""
                                  ? "border-red-300 bg-red-50 focus:bg-white"
                                  : "border-gray-300"
                              }`}
                              disabled={loading}
                              placeholder="0"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              1 м³ газ нархи (сўм) *
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={generalData.gasPrice}
                              onChange={(e) =>
                                handleGeneralInputChange(
                                  "gasPrice",
                                  e.target.value,
                                )
                              }
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner ${
                                generalData.gasPrice === ""
                                  ? "border-red-300 bg-red-50 focus:bg-white"
                                  : "border-gray-300"
                              }`}
                              disabled={loading}
                              placeholder="0"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {activePaymentMethods
                            .filter(
                              (method) => method.dbFieldName !== "zhisobot",
                            )
                            .map((method) => (
                              <PaymentInputField
                                key={method.id}
                                method={method}
                                value={paymentValues[method.dbFieldName] || ""}
                                onChange={handlePaymentValueChange}
                                disabled={method.isActive === 0}
                                required={true}
                              />
                            ))}
                        </div>

                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <svg
                                className="w-5 h-5 text-yellow-600 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <div>
                                <div className="font-semibold text-yellow-800">
                                  Z-ҳисобот (накд пул) *
                                </div>
                                <div className="text-xs text-yellow-700 mt-1">
                                  Автоматик тарзда ҳисобланади
                                </div>
                              </div>
                            </div>
                            <div className="text-xl font-bold text-yellow-900">
                              {formatNumberForDisplay(calculateCashAmount())}{" "}
                              сўм
                            </div>
                          </div>
                          <div className="mt-3 text-sm text-yellow-700 bg-yellow-100 p-2 rounded">
                            <div className="font-medium mb-1">
                              Хисоб-китоб формуласи :
                            </div>
                            <div className="text-xs">
                              (Шланглар {formatNumberForDisplay(hoseTotal)} -
                              Хамкорлар{" "}
                              {formatNumberForDisplay(partnerTotals.totalM3)}) ×
                              Газ нархи{" "}
                              {formatNumberForDisplay(generalData.gasPrice)} -
                              Барча тулов тизимлар (Z-хисоботдан ташкари)
                            </div>
                            <div className="mt-2 text-xs font-medium">
                              * Ушбу катор автоматик тарзда тулдирилади.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Йиғма маълумот
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center">
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Шланглар орқали сотилди
                      </label>
                      <div className="text-lg font-semibold text-green-600">
                        {formatNumberForDisplay(hoseTotal)} м³
                      </div>
                    </div>
                    <div className="text-center">
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Хамкорларга сотилди
                      </label>
                      <div className="text-lg font-semibold text-blue-600">
                        {formatNumberForDisplay(partnerTotals.totalM3)} м³
                      </div>
                    </div>
                    <div className="text-center">
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Хамкорларга сотилди
                      </label>
                      <div className="text-lg font-semibold text-purple-600">
                        {formatNumberForDisplay(partnerTotals.totalAmount)} сўм
                      </div>
                    </div>
                    <div className="text-center">
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Z-ҳисобот (наличные)
                      </label>
                      <div className="text-lg font-semibold text-orange-600">
                        {formatNumberForDisplay(calculateCashAmount())} сўм
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Хамкорлар: {partnerData.length} • Шланглар: {hoseRows.length}
                  {hoseRows.some((row) => row.hasReset) && (
                    <span className="ml-2 text-yellow-600">
                      • Нўлланиш:{" "}
                      {hoseRows.filter((row) => row.hasReset).length}
                    </span>
                  )}
                  {partnerData.some((p) => p.pricePerM3 === 0) && (
                    <span className="ml-2 text-red-600 font-medium">
                      • Нарх ўрнатилмаган:{" "}
                      {partnerData.filter((p) => p.pricePerM3 === 0).length} та
                    </span>
                  )}
                  <span className="ml-2 text-blue-600">
                    • Тўлов методлари:{" "}
                    {
                      activePaymentMethods.filter(
                        (m) => m.dbFieldName !== "zhisobot",
                      ).length
                    }{" "}
                    та (Z-отчет не считается)
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Бекор
                  </button>
                  <button
                    onClick={handleSaveClick}
                    disabled={loading || !isReportValid()}
                    className={`px-5 py-2 rounded-xl text-white font-semibold transition-colors ${
                      isReportValid() && !loading
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {loading ? "Сақланмоқда..." : "Ҳисоботни сақлаш"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PriceSetupModal
        isOpen={isPriceModalOpen}
        onClose={() => {
          setIsPriceModalOpen(false);
          setSelectedPartnerData(null);
        }}
        partnerData={selectedPartnerData}
        onSave={savePartnerPrice}
        previousReportDate={previousReportDateForPartner}
        stationId={station?.id}
      />

      {/* ОБНОВЛЕННОЕ модальное окно подтверждения сохранения - показывает только партнеров с soldM3 > 0 */}
      {/* Модальное окно подтверждения сохранения - ГОРИЗОНТАЛЬНОЕ с 2 КОЛОНКАМИ */}
      <AnimatePresence>
        {isConfirmModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              {/* Заголовок */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-5 rounded-t-2xl flex-shrink-0">
                <div className="flex items-center justify-center">
                  <div className="bg-white bg-opacity-20 p-2 rounded-full">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white text-center mt-3">
                  Сақлашни тасдиқлайсизми?
                </h3>
              </div>

              {/* Содержимое с прокруткой */}
              <div className="flex-1 overflow-y-auto p-5">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 flex-shrink-0">
                  <p className="text-sm text-yellow-800 text-center font-medium">
                    ⚠️ Сақланганингизда сўнг ҳисоботни ўзгартириб бўлмайди!
                  </p>
                </div>

                {/* 2 колонки */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Левая колонка */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-800 pb-2 border-b">
                      📋 Асосий маълумотлар
                    </h4>

                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-600">Сана:</span>
                      <span className="font-semibold">{reportDate}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-600">
                        Автопилот:
                      </span>
                      <span className="font-semibold">
                        {formatNumberForDisplay(generalData.autopilotReading)}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-600">
                        1м³ газ нархи:
                      </span>
                      <span className="font-semibold">
                        {formatNumberForDisplay(generalData.gasPrice)} сўм
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-600">
                        Шланглар орқали сотилди:
                      </span>
                      <span className="font-semibold text-green-600">
                        {formatNumberForDisplay(hoseTotal)} м³
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-600">
                        Хамкорларга сотилди (жами):
                      </span>
                      <span className="font-semibold text-blue-600">
                        {formatNumberForDisplay(partnerTotals.totalM3)} м³
                      </span>
                    </div>

                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="font-bold text-gray-800">
                        Z-ҳисобот (наличные):
                      </span>
                      <span className="font-bold text-orange-600 text-lg">
                        {formatNumberForDisplay(calculateCashAmount())} сўм
                      </span>
                    </div>
                  </div>

                  {/* Правая колонка */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-800 pb-2 border-b">
                      💰 Тўлов тизимлари
                    </h4>

                    {activePaymentMethods
                      .filter((method) => method.dbFieldName !== "zhisobot")
                      .map((method) => {
                        const value = parseFormattedNumber(
                          paymentValues[method.dbFieldName] || 0,
                        );
                        return (
                          <div
                            key={method.id}
                            className="flex justify-between text-sm"
                          >
                            <span className="font-medium text-gray-600">
                              {method.name}:
                            </span>
                            <span className="font-semibold">
                              {formatNumberForDisplay(value)} сўм
                            </span>
                          </div>
                        );
                      })}

                    {/* Партнеры с продажами > 0 */}
                    {partnerData.filter(
                      (p) => parseFormattedNumber(p.soldM3) > 0,
                    ).length > 0 && (
                      <div className="pt-3 mt-2 border-t">
                        <h4 className="font-semibold text-gray-800 pb-2 mb-2">
                          🤝 Хамкорлар (газ олган)
                        </h4>
                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                          {partnerData
                            .filter((p) => parseFormattedNumber(p.soldM3) > 0)
                            .map((partner) => (
                              <div
                                key={partner.partnerId}
                                className="flex justify-between text-xs py-1 border-b border-gray-100"
                              >
                                <span
                                  className="text-gray-700 truncate max-w-[150px]"
                                  title={partner.partnerName}
                                >
                                  {partner.partnerName.substring(0, 25)}:
                                </span>
                                <span className="font-medium text-gray-800 whitespace-nowrap">
                                  {formatNumberForDisplay(partner.soldM3)} м³ ×{" "}
                                  {formatNumberForDisplay(partner.pricePerM3)} ={" "}
                                  {formatNumberForDisplay(partner.totalAmount)}{" "}
                                  сўм
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Информация о партнерах с нулевыми продажами */}
                    {partnerData.filter(
                      (p) => parseFormattedNumber(p.soldM3) === 0,
                    ).length > 0 && (
                      <div className="text-xs text-gray-500 pt-2">
                        📌{" "}
                        {
                          partnerData.filter(
                            (p) => parseFormattedNumber(p.soldM3) === 0,
                          ).length
                        }{" "}
                        та хамкор 0 м³ сотилган
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Кнопки */}
              <div className="p-5 border-t bg-gray-50 flex flex-col sm:flex-row gap-3 justify-end flex-shrink-0">
                <button
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                >
                  Бекор
                </button>
                <button
                  onClick={saveUnifiedReport}
                  disabled={loading}
                  className="px-5 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors font-medium flex items-center justify-center gap-2 disabled:bg-orange-300"
                >
                  {loading ? (
                    "Сақланмоқда..."
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5"
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
                      Сақлашни тасдиқлаш
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSuccessModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-md"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <div className="p-6 border-b">
                <h3 className="text-xl font-semibold text-green-600">
                  Ҳисобот мувафақиятли сақланди!
                </h3>
              </div>
              <div className="p-6">
                <p className="text-gray-700 mb-4">
                  {reportDate} кунги ҳисобот тизимда мувафақиятли сақланди.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center text-green-700">
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Барча маълумотлар сақланди</span>
                  </div>
                  <div className="text-sm text-green-600 mt-2">
                    • {hoseRows.length} шланг
                  </div>
                  <div className="text-sm text-green-600">
                    •{" "}
                    {
                      partnerData.filter(
                        (p) => parseFormattedNumber(p.soldM3) > 0,
                      ).length
                    }{" "}
                    хамкор (газ олган)
                  </div>
                  <div className="text-sm text-green-600">
                    •{" "}
                    {
                      activePaymentMethods.filter(
                        (m) => m.dbFieldName !== "zhisobot",
                      ).length
                    }{" "}
                    тўлов усули (Z-отчет алохида)
                  </div>
                </div>
              </div>
              <div className="p-6 border-t bg-gray-50 flex justify-end">
                <button
                  onClick={handleFinish}
                  className="px-5 py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700"
                >
                  Ёпиш
                </button>
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

export default UnifiedReportModal;
