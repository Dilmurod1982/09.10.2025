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
  const month = date.getMonth() + 1; // Январь = 1

  if (month >= 1 && month <= 3) return "I";
  if (month >= 4 && month <= 6) return "II";
  if (month >= 7 && month <= 9) return "III";
  if (month >= 10 && month <= 12) return "IV";

  return "I"; // fallback
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
  reportDate
) => {
  try {
    const collectionName = getCollectionNameByDate(reportDate);
    const collectionRef = collection(db, collectionName);

    const reportQuery = query(
      collectionRef,
      where("stationId", "==", stationId),
      where("reportDate", "==", reportDate)
    );

    const snapshot = await getDocs(reportQuery);
    return !snapshot.empty;
  } catch (error) {
    // Если коллекция не существует, значит отчета точно нет
    if (error.code === "not-found") {
      return false;
    }
    console.error(
      "Error checking existing report in quarter collection:",
      error
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

    // Определяем текущий квартал
    let currentQuarter;
    if (currentMonth >= 1 && currentMonth <= 3) currentQuarter = "I";
    else if (currentMonth >= 4 && currentMonth <= 6) currentQuarter = "II";
    else if (currentMonth >= 7 && currentMonth <= 9) currentQuarter = "III";
    else currentQuarter = "IV";

    // console.log("🔍 Поиск последнего отчета для станции:", stationId);
    // console.log("📅 Текущий период:", currentQuarter, "квартал", currentYear);

    // Создаем массив всех возможных коллекций для поиска
    const collectionsToSearch = [];

    // Добавляем текущий и предыдущие кварталы (достаточно 8 кварталов назад)
    for (let i = 0; i < 8; i++) {
      let quarter = currentQuarter;
      let year = currentYear;

      // Отматываем на i кварталов назад
      for (let j = 0; j < i; j++) {
        if (quarter === "I") {
          quarter = "IV";
          year--;
        } else if (quarter === "II") {
          quarter = "I";
        } else if (quarter === "III") {
          quarter = "II";
        } else {
          // quarter === 'IV'
          quarter = "III";
        }
      }

      const collectionName = `unifiedDailyReports_${quarter}_${year}`;
      if (!collectionsToSearch.includes(collectionName)) {
        collectionsToSearch.push(collectionName);
      }
    }

    // console.log("📋 Коллекции для поиска:", collectionsToSearch);

    let latestReport = null;
    let latestReportDate = null;

    // Ищем отчеты во всех коллекциях
    for (const collectionName of collectionsToSearch) {
      try {
        // console.log(`🔎 Поиск в коллекции: ${collectionName}`);

        const collectionRef = collection(db, collectionName);

        // Ищем ВСЕ отчеты для этой станции (без orderBy чтобы избежать ошибки индекса)
        const reportQuery = query(
          collectionRef,
          where("stationId", "==", stationId)
        );

        const snapshot = await getDocs(reportQuery);

        if (!snapshot.empty) {
          // console.log(
          //   `✅ Найдено ${snapshot.docs.length} отчетов в ${collectionName}`
          // );

          // Вручную ищем самый последний отчет по дате
          snapshot.docs.forEach((doc) => {
            const reportData = doc.data();
            const reportDate = reportData.reportDate;

            // Если это первый найденный отчет или дата позже чем у current latest
            if (!latestReportDate || reportDate > latestReportDate) {
              latestReportDate = reportDate;
              latestReport = {
                ...reportData,
                id: doc.id,
                collectionName: collectionName,
              };
            }
          });
        } else {
          // console.log(
          //   `📭 В коллекции ${collectionName} нет отчетов для станции ${stationId}`
          // );
        }
      } catch (error) {
        // console.log(
        //   // `⚠️ Ошибка при доступе к ${collectionName}:`,
        //   error.code || error.message
        // );

        // Если коллекция не существует, просто пропускаем
        if (
          error.code === "not-found" ||
          error.code === "failed-precondition"
        ) {
          // console.log(
          //   `📭 Коллекция ${collectionName} не существует или нет индекса`
          // );
        }
      }
    }

    if (latestReport) {
      // console.log("🎯 Найден последний отчет:", {
      //   reportDate: latestReport.reportDate,
      //   collection: latestReport.collectionName,
      //   hoseData: latestReport.hoseData?.length || 0,
      //   stationName: latestReport.stationName,
      // });
    } else {
      // console.log("📭 Отчеты не найдены ни в одной коллекции");
    }

    return latestReport;
  } catch (error) {
    console.error("❌ Критическая ошибка при поиске отчетов:", error);
    return null;
  }
};

// Функция для удаления отчета из квартальной коллекции
const deleteReportFromQuarterCollection = async (
  db,
  collectionName,
  reportId
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

// Новый компонент модального окна для установки цены
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
  const [existingPriceToday, setExistingPriceToday] = useState(false);

  // Инициализация при открытии
  useEffect(() => {
    if (isOpen && partnerData) {
      // Устанавливаем цену из данных партнера
      setPrice(partnerData.currentPrice || "");

      // Устанавливаем сегодняшнюю дату по умолчанию
      const today = new Date().toISOString().split("T")[0];
      setPriceDate(today);
      setError("");
      setExistingPriceToday(false);

      // Проверяем, есть ли уже цена на сегодня
      checkExistingPriceForToday(partnerData.partnerId);
    }
  }, [isOpen, partnerData]);

  // Функция для проверки существующей цены на сегодня
  const checkExistingPriceForToday = async (partnerId) => {
    try {
      const contractRef = doc(db, "contracts", partnerId);
      const contractDoc = await getDoc(contractRef);

      if (contractDoc.exists()) {
        const contractData = contractDoc.data();
        const today = new Date().toISOString().split("T")[0];

        if (contractData.prices && Array.isArray(contractData.prices)) {
          // Проверяем, есть ли цена на сегодня
          const priceToday = contractData.prices.find(
            (price) => price.priceDate === today
          );

          if (priceToday) {
            setExistingPriceToday(true);
            toast.error("Бугун учун нарх аллакачон ўрнатилган");
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

    // Ограничиваем 2 знаками после запятой
    const parts = stringValue.split(".");
    if (parts.length > 1 && parts[1].length > 2) {
      return parts[0] + "." + parts[1].substring(0, 2);
    }

    return stringValue;
  };

  // Валидация даты - цена устанавливается только на сегодня или будущие даты
  const validateDate = (date) => {
    if (!date) return "Санани киритинг";

    const today = new Date().toISOString().split("T")[0];

    // Цена устанавливается только на сегодня или будущие даты
    if (date < today) {
      return "Нарх фақат бугунги ёки келажаги саналар учун ўрнатилиши мумкин";
    }

    // Проверяем, чтобы дата не была раньше предыдущего отчета
    if (previousReportDate && date <= previousReportDate) {
      return `Сана ${previousReportDate} дан кейинги булиши керак`;
    }

    return "";
  };

  const handlePriceChange = (value) => {
    setPrice(formatNumberInput(value));
  };

  const handleDateChange = (date) => {
    setPriceDate(date);
    const errorMsg = validateDate(date);
    setError(errorMsg);
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

    if (
      existingPriceToday &&
      priceDate === new Date().toISOString().split("T")[0]
    ) {
      toast.error("Бугун учун нарх аллакачон ўрнатилган");
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
            {/* Заголовок */}
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

            {/* Содержимое с прокруткой */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Информация о партнере */}
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
                          ? `${parseFloat(
                              partnerData.currentPrice
                            ).toLocaleString("ru-RU")} сўм`
                          : "Ўрнатилмаган"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Поле для цены */}
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
                    disabled={loading || existingPriceToday}
                    autoFocus
                  />
                  {existingPriceToday && (
                    <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                      ⚠️ Бугун учун нарх аллакачон ўрнатилган. Фақат келажаги
                      саналар учун нарх ўрнатиш мумкин.
                    </p>
                  )}
                </div>

                {/* Поле для даты */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Нархни ўрнатиш санаси *
                  </label>
                  <input
                    type="date"
                    value={priceDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    min={new Date().toISOString().split("T")[0]} // Минимум сегодня
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
                  <p className="mt-1 text-sm text-blue-600">
                    Минимал сана: {new Date().toISOString().split("T")[0]}
                  </p>
                </div>

                {/* Подсказки */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="mr-3 text-yellow-600">
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-yellow-800 mb-1">
                        Эслатма:
                      </p>
                      <ul className="text-xs text-yellow-700 space-y-1">
                        <li>• Нарх фақат 1 марта ўрнатилади</li>
                        <li>• Нарх ўрнатилган санадан бошлаб қўлланилади</li>
                        <li>
                          • Бугун учун нарх ўрнатилган бўлса, фақат келажаги
                          саналар учун ўрнатиш мумкин
                        </li>
                        <li>
                          • Нархни ўзгартириш учун аввалги нархни ўчириш керак
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Информация о последних ценах */}
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
                              "ru-RU"
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

            {/* Кнопки */}
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
                disabled={loading || existingPriceToday}
                className={`px-5 py-2 rounded-xl font-semibold ${
                  existingPriceToday
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

// Компонент для полей ввода платежных систем с оптимизацией
const PaymentInputField = React.memo(
  ({ method, value, onChange, disabled, required }) => {
    const inputRef = useRef(null);

    const handleChange = (e) => {
      const newValue = e.target.value;
      onChange(method.dbFieldName, newValue);
    };

    const handleFocus = (e) => {
      // Выделяем весь текст при фокусе для удобства
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
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-2 h-2 bg-gray-800 rotate-45"></div>
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
        {required && (!value || value.trim() === "") && (
          <div className="mt-1 text-xs text-red-600"></div>
        )}
        {disabled && (
          <div className="mt-1 text-xs text-gray-500">
            Автоматически установлено в 0 (неактивный метод)
          </div>
        )}
      </div>
    );
  }
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

  // Состояние для модального окна установки цены
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [selectedPartnerData, setSelectedPartnerData] = useState(null);
  const [previousReportDateForPartner, setPreviousReportDateForPartner] =
    useState("");

  // Данные для всех отчетов
  const [partnerData, setPartnerData] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [hoseRows, setHoseRows] = useState([]);
  const [hoseTotal, setHoseTotal] = useState(0);
  const [hoseTotalSum, setHoseTotalSum] = useState(0);
  const [generalData, setGeneralData] = useState({
    autopilotReading: "",
    gasPrice: "",
  });

  // Новое состояние для платежных систем
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentValues, setPaymentValues] = useState({});

  const userData = useAppStore((state) => state.userData);

  // Получаем количество шлангов
  const hosesCount = React.useMemo(() => {
    const d = Array.isArray(station?.dispensers)
      ? station.dispensers.length
      : 0;
    return d * 2;
  }, [station?.dispensers]);

  // Создаем имена шлангов
  const hoseNames = React.useMemo(() => {
    return Array.from({ length: hosesCount }, (_, i) => `Шланг-${i + 1}`);
  }, [hosesCount]);

  // Оптимизация: только активные методы платежа
  const activePaymentMethods = React.useMemo(() => {
    return paymentMethods.filter((method) => method.isActive === 1);
  }, [paymentMethods]);

  // Функция для добавления дней к дате
  const addDays = useCallback((dateString, days) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }, []);

  // Функция для загрузки платежных систем (упрощенная версия)
  const loadPaymentMethods = useCallback(async () => {
    try {
      // Упрощенный запрос без сложных условий для избежания ошибок индекса
      const paymentMethodsCollection = collection(db, "paymentMethods");
      const snapshot = await getDocs(paymentMethodsCollection);

      let methods = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Фильтруем и сортируем на клиенте
      // Сначала активные, потом неактивные
      methods.sort((a, b) => {
        // Сначала по активности (активные выше)
        if (a.isActive !== b.isActive) {
          return b.isActive - a.isActive;
        }
        // Затем по имени
        return (a.name || "").localeCompare(b.name || "");
      });

      // Создаем начальные значения для каждого метода платежа
      const initialValues = {};
      methods.forEach((method) => {
        // Если метод неактивен, сразу устанавливаем 0
        initialValues[method.dbFieldName] = method.isActive === 1 ? "" : "0";
      });

      setPaymentMethods(methods);
      setPaymentValues(initialValues);

      return methods;
    } catch (error) {
      // Fallback: фиксированный список платежных систем для тестирования
      const fallbackMethods = [
        {
          id: "humo_terminal_fallback",
          dbFieldName: "humo_terminal",
          name: "Хумо терминал",
          description: "Терминал платёжной системы Хумо",
          isActive: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "uzcard_terminal_fallback",
          dbFieldName: "uzcard_terminal",
          name: "Узкард терминал",
          description: "Терминал платёжной системы Узкард",
          isActive: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "electronic_payment_system_fallback",
          dbFieldName: "electronic_payment_system",
          name: "Электрон тўлов тизими",
          description: "Электронные платежи через мобильные приложения",
          isActive: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "zhisobot_fallback",
          dbFieldName: "zhisobot",
          name: "Z-ҳисобот",
          description: "Наличные деньги (Z-отчет)",
          isActive: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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

  // Функция для получения данных об обнулениях счетчиков
  const getMeterResetData = useCallback(async (stationId, reportDate) => {
    if (!stationId || !reportDate) {
      return [];
    }

    try {
      // Конвертируем дату отчета из YYYY-MM-DD в DD-MM-YYYY для поиска
      const [year, month, day] = reportDate.split("-");
      const resetDateFormatted = `${day}-${month}-${year}`;

      // Ищем события обнуления для этой станции на дату отчета
      const resetQuery = query(
        collection(db, "meterResetEvents"),
        where("stationId", "==", stationId),
        where("resetDate", "==", resetDateFormatted)
      );

      const snapshot = await getDocs(resetQuery);
      const resetEvents = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return resetEvents;
    } catch (error) {
      return [];
    }
  }, []);

  // Улучшенная функция для ввода чисел с минусом
  const formatNumberInput = useCallback((value) => {
    if (value === "" || value === null || value === undefined) return "";

    const stringValue = String(value);

    // Разрешаем: цифры, запятая, точка, минус в начале
    const validChars = /^-?[\d,.]*$/;

    if (!validChars.test(stringValue)) {
      return stringValue.slice(0, -1);
    }

    // Убираем лишние минусы
    if (stringValue.includes("-") && stringValue.indexOf("-") > 0) {
      return stringValue.replace(/-/g, "");
    }

    // Ограничиваем 2 знаками после запятой
    const parts = stringValue.split(".");
    if (parts.length > 1 && parts[1].length > 2) {
      return parts[0] + "." + parts[1].substring(0, 2);
    }

    return stringValue;
  }, []);

  // Функция для отображения отформатированного числа
  const formatNumberForDisplay = useCallback((value) => {
    try {
      if (value === "" || value === null || value === undefined) return "";
      if (value === "-") return "-";

      const stringValue = String(value);
      const hasMinus = stringValue.startsWith("-");
      const numberString = hasMinus ? stringValue.substring(1) : stringValue;

      if (numberString === "" || numberString === "0")
        return hasMinus ? "-0" : "0";

      // Заменяем запятую на точку для корректного парсинга
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

  // Улучшенная функция для парсинга форматированного числа
  const parseFormattedNumber = useCallback((value) => {
    if (!value || value === "-" || value.trim() === "") return 0;

    try {
      const stringValue = String(value);
      const hasMinus = stringValue.startsWith("-");

      // Удаляем все пробелы и заменяем запятые на точки
      const cleaned = stringValue.replace(/\s/g, "").replace(/,/g, ".");

      const numberString = hasMinus ? cleaned.substring(1) : cleaned;
      const number = parseFloat(numberString) || 0;

      return hasMinus ? -number : number;
    } catch (error) {
      console.error("Error parsing number:", value, error);
      return 0;
    }
  }, []);

  // Проверка существующего отчета в квартальной коллекции
  const checkExistingReport = useCallback(async () => {
    if (!station?.id || !reportDate) return false;

    try {
      const exists = await checkExistingReportInQuarterCollection(
        db,
        station.id,
        reportDate
      );

      if (exists) {
        toast.error("Бу санага ҳисобот мавжуд");
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking existing report:", error);
      return false;
    }
  }, [station?.id, reportDate]);

  // Функция для получения даты последнего отчета партнера из квартальных коллекций
  const getLatestPartnerReportDate = async (partnerId) => {
    try {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentQuarter = getQuarterFromDate(
        currentDate.toISOString().split("T")[0]
      );

      const quartersToSearch = [];
      const yearsToSearch = [currentYear];

      // Текущий квартал
      quartersToSearch.push(currentQuarter);

      // Предыдущий квартал
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
              limit(1)
            );

            const snapshot = await getDocs(reportQuery);
            if (!snapshot.empty) {
              const report = snapshot.docs[0];
              const reportDate = report.data().reportDate;

              if (!latestReportDate || reportDate > latestReportDate) {
                latestReportDate = reportDate;
              }
            }
          } catch (error) {
            // Если коллекция не существует, продолжаем
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

  // Функция для загрузки и применения данных обнулений
  // Функция для загрузки и применения данных обнулений
  const loadAndApplyResetData = useCallback(
    async (stationId, reportDate, hasPreviousReport, lastReport) => {
      if (!stationId || !reportDate) {
        return [];
      }

      // console.log("🔄 Загрузка данных обнулений для даты:", reportDate);

      const resetEvents = await getMeterResetData(stationId, reportDate);

      if (resetEvents.length > 0) {
        // console.log("🔄 Найдены обнуления:", resetEvents.length);

        // Обновляем данные шлангов с учетом обнулений
        setHoseRows((prevRows) =>
          prevRows.map((row) => {
            // Находим обнуления для этого конкретного шланга
            const hoseResetEvents = resetEvents.filter(
              (event) => event.hose === row.hose
            );

            if (hoseResetEvents.length > 0) {
              const latestReset = hoseResetEvents[0];
              // console.log(`🔄 Обнуление для ${row.hose}:`, latestReset);

              return {
                ...row,
                prev: latestReset.newReadingAfterReset,
                hasReset: true,
                resetInfo: latestReset,
                prevDisabled: true, // При обнулении поле должно быть заблокировано
              };
            } else {
              // Если обнулений нет, проверяем есть ли данные из предыдущего отчета
              if (hasPreviousReport && lastReport && lastReport.hoseData) {
                const lastHose = lastReport.hoseData.find(
                  (h) => h.hose === row.hose
                );
                if (lastHose) {
                  return {
                    ...row,
                    prev: lastHose.current || 0,
                    hasReset: false,
                    resetInfo: null,
                    prevDisabled: true, // Данные из отчета - поле заблокировано
                  };
                }
              }
              // Если нет ни обнулений, ни данных из отчета, поле должно быть доступно
              return {
                ...row,
                hasReset: false,
                resetInfo: null,
                prevDisabled: false, // Нет данных - поле доступно для ручного ввода
              };
            }
          })
        );
      } else {
        // console.log("📭 Обнулений не найдено");

        // Если нет обнулений, но есть предыдущий отчет - используем данные из отчета
        if (hasPreviousReport && lastReport && lastReport.hoseData) {
          // console.log("🔄 Используем данные из предыдущего отчета");
          setHoseRows((prevRows) =>
            prevRows.map((row) => {
              const lastHose = lastReport.hoseData.find(
                (h) => h.hose === row.hose
              );
              if (lastHose) {
                return {
                  ...row,
                  prev: lastHose.current || 0,
                  prevDisabled: true, // Данные из отчета - поле заблокировано
                };
              }
              return row;
            })
          );
        }
      }

      return resetEvents;
    },
    [getMeterResetData]
  );

  // Функция для получения последней цены партнера из массива prices
  const getLatestPartnerPrice = async (partnerId) => {
    try {
      const contractRef = doc(db, "contracts", partnerId);
      const contractDoc = await getDoc(contractRef);

      if (!contractDoc.exists()) {
        return 0;
      }

      const contractData = contractDoc.data();

      // Проверяем наличие массива prices
      if (contractData.prices && Array.isArray(contractData.prices)) {
        // Сортируем по дате (от новых к старым)
        const sortedPrices = [...contractData.prices].sort((a, b) => {
          const dateA = a.priceDate ? new Date(a.priceDate) : new Date(0);
          const dateB = b.priceDate ? new Date(b.priceDate) : new Date(0);
          return dateB - dateA;
        });

        if (sortedPrices.length > 0) {
          // Берем самую последнюю цену
          return sortedPrices[0].pricePerM3 || 0;
        }
      }

      // Если нет массива prices, проверяем transactions как fallback
      if (contractData.transactions && contractData.transactions.length > 0) {
        const sortedTransactions = [...contractData.transactions].sort(
          (a, b) => {
            const dateA = a.reportDate ? new Date(a.reportDate) : new Date(0);
            const dateB = b.reportDate ? new Date(b.reportDate) : new Date(0);
            return dateB - dateA;
          }
        );

        if (sortedTransactions.length > 0) {
          return sortedTransactions[0].pricePerM3 || 0;
        }
      }

      return 0;
    } catch (error) {
      console.error("Error getting partner price:", error);
      return 0;
    }
  };

  // Функция для получения истории цен партнера
  const getPartnerPriceHistory = async (partnerId) => {
    try {
      const contractRef = doc(db, "contracts", partnerId);
      const contractDoc = await getDoc(contractRef);

      if (!contractDoc.exists()) {
        return [];
      }

      const contractData = contractDoc.data();

      // Проверяем наличие массива prices
      if (contractData.prices && Array.isArray(contractData.prices)) {
        // Сортируем по дате (от новых к старым) и берем последние 5
        const sortedPrices = [...contractData.prices]
          .sort((a, b) => {
            const dateA = a.priceDate ? new Date(a.priceDate) : new Date(0);
            const dateB = b.priceDate ? new Date(b.priceDate) : new Date(0);
            return dateB - dateA;
          })
          .slice(0, 5);

        return sortedPrices;
      }

      return [];
    } catch (error) {
      console.error("Error getting price history:", error);
      return [];
    }
  };

  // Функция для сохранения новой цены партнера
  const savePartnerPrice = async (partnerId, price, priceDate) => {
    try {
      const contractRef = doc(db, "contracts", partnerId);
      const contractDoc = await getDoc(contractRef);

      if (!contractDoc.exists()) {
        throw new Error("Contract not found");
      }

      const contractData = contractDoc.data();
      const currentPrices = contractData.prices || [];

      // Проверяем, есть ли уже цена на эту дату
      const existingPriceForDate = currentPrices.find(
        (p) => p.priceDate === priceDate
      );
      if (existingPriceForDate) {
        toast.error("Ушбу сана учун нарх аллакачон мавжуд");
        return;
      }

      // Создаем новую запись о цене
      const newPriceEntry = {
        pricePerM3: price,
        priceDate: priceDate,
        setBy: auth?.currentUser?.email || "unknown",
        setAt: new Date().toISOString(),
        stationId: station.id,
        stationName: station.stationName,
      };

      // Добавляем новую цену в массив
      const updatedPrices = [...currentPrices, newPriceEntry];

      // Сортируем по дате
      updatedPrices.sort(
        (a, b) => new Date(b.priceDate) - new Date(a.priceDate)
      );

      // Обновляем документ
      await updateDoc(contractRef, {
        prices: updatedPrices,
        lastUpdated: serverTimestamp(),
      });

      // Обновляем локальное состояние
      setPartnerData((prev) =>
        prev.map((partner) => {
          if (partner.partnerId === partnerId) {
            return {
              ...partner,
              pricePerM3: price,
            };
          }
          return partner;
        })
      );
    } catch (error) {
      console.error("Error saving price:", error);
      throw error;
    }
  };

  // Оптимизированный обработчик изменения значений платежных систем
  const handlePaymentValueChange = useCallback(
    (dbFieldName, value) => {
      const formattedValue = formatNumberInput(value);

      setPaymentValues((prev) => {
        // Оптимизация: только обновляем если значение изменилось
        if (prev[dbFieldName] === formattedValue) {
          return prev;
        }
        return {
          ...prev,
          [dbFieldName]: formattedValue,
        };
      });
    },
    [formatNumberInput]
  );

  // Обработчик изменения общих данных
  const handleGeneralInputChange = useCallback(
    (field, value) => {
      const formattedValue = formatNumberInput(value);

      setGeneralData((prev) => {
        if (prev[field] === formattedValue) {
          return prev;
        }
        return {
          ...prev,
          [field]: formattedValue,
        };
      });
    },
    [formatNumberInput]
  );

  // Полная функция initializeData
  const initializeData = async () => {
    if (!isOpen || !station?.id) return;

    try {
      setLoading(true);
      // console.log(
      //   "🔄 Начинаем инициализацию данных для станции:",
      //   station.id,
      //   station.stationName
      // );

      // Загружаем платежные системы
      await loadPaymentMethods();
      // console.log("✅ Платежные системы загружены");

      // Загружаем последний объединенный отчет из всех квартальных коллекций
      const lastReport = await getLastReportFromAllQuarterCollections(
        db,
        station.id
      );
      const hasPreviousReport = lastReport !== null;

      // console.log("📊 Результат поиска:", {
      //   found: hasPreviousReport,
      //   reportDate: lastReport?.reportDate,
      //   collection: lastReport?.collectionName,
      //   hoseCount: lastReport?.hoseData?.length || 0,
      // });

      let nextDate = "";
      if (hasPreviousReport) {
        // Используем дату из найденного отчета
        nextDate = addDays(lastReport.reportDate, 1);
        setReportDate(nextDate);
        setDateDisabled(true);

        // console.log("📅 Установлена следующая дата:", nextDate);
        // console.log("📝 Данные из предыдущего отчета:", {
        //   date: lastReport.reportDate,
        //   autopilot: lastReport.generalData?.autopilotReading,
        //   gasPrice: lastReport.generalData?.gasPrice,
        //   hoseData: lastReport.hoseData?.map((h) => ({
        //     hose: h.hose,
        //     current: h.current,
        //   })),
        // });

        // Загружаем значения платежей из последнего отчета
        if (lastReport.paymentData) {
          const newPaymentValues = {};
          paymentMethods.forEach((method) => {
            if (lastReport.paymentData[method.dbFieldName] !== undefined) {
              newPaymentValues[method.dbFieldName] =
                lastReport.paymentData[method.dbFieldName].toString() || "";
            }
          });
          setPaymentValues((prev) => ({ ...prev, ...newPaymentValues }));
          // console.log("✅ Данные платежей загружены");
        }
      } else {
        // Если нет предыдущего отчета, устанавливаем сегодняшнюю дату
        const today = new Date().toISOString().split("T")[0];
        setReportDate(today);
        setDateDisabled(false);
        // console.log(
        //   "📅 Нет предыдущего отчета, установлена сегодняшняя дата:",
        //   today
        // );
      }

      // Загружаем договоры
      // console.log("📄 Загружаем договоры...");
      const contractsQuery = query(
        collection(db, "contracts"),
        where("stationId", "==", station.id)
      );

      const contractsSnapshot = await getDocs(contractsQuery);
      const contractsData = contractsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // СОРТИРОВКА контрактов по autoId
      const sortedContracts = [...contractsData].sort((a, b) => {
        const autoIdA = a.autoId || 0;
        const autoIdB = b.autoId || 0;

        if (autoIdA !== autoIdB) {
          return autoIdA - autoIdB;
        }

        return (a.partner || "").localeCompare(b.partner || "");
      });

      setContracts(sortedContracts);
      // console.log(`✅ Загружено ${sortedContracts.length} договоров`);

      // Инициализируем данные партнеров
      // console.log("👥 Инициализируем данные партнеров...");
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
        })
      );

      setPartnerData(initializedPartnerData);
      // console.log("✅ Данные партнеров инициализированы");

      // Инициализируем базовые данные шлангов
      // console.log("🔧 Инициализируем данные шлангов...");
      const initializedHoseRows = hoseNames.map((name, index) => {
        let prev = 0;
        let price = 0;
        let prevDisabled = false;

        if (hasPreviousReport && lastReport.hoseData) {
          // Ищем данные для этого шланга в предыдущем отчете
          const lastHose = lastReport.hoseData.find((h) => h.hose === name);

          if (lastHose) {
            prev = lastHose.current || 0;
            price = lastHose.price || 0;
            prevDisabled = true;
            // console.log(
            //   `✅ Шланг ${name}: prev=${prev}, price=${price} (автоматически)`
            // );
          } else {
            // console.log(`⚠️ Шланг ${name}: данных нет в отчете (ручной ввод)`);
            prevDisabled = false;
          }
        } else {
          console.log(`📝 Шланг ${name}: нет предыдущего отчета (ручной ввод)`);
          prevDisabled = false;
        }

        return {
          hose: name,
          prev: prev,
          current: "",
          price: price,
          diff: 0,
          sum: 0,
          prevDisabled: prevDisabled,
          hasReset: false,
          resetInfo: null,
        };
      });

      setHoseRows(initializedHoseRows);
      console.log("✅ Данные шлангов инициализированы");

      // Инициализируем общие данные
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
        console.log("✅ Общие данные загружены из отчета");
      } else {
        console.log("📝 Общие данные: устанавливаем пустые значения");
      }

      // Загружаем обнуления если есть дата
      if (nextDate) {
        // console.log("🔄 Загружаем данные об обнулениях для даты:", nextDate);
        await loadAndApplyResetData(
          station.id,
          nextDate,
          hasPreviousReport,
          lastReport
        );
      }

      console.log("✅ Инициализация данных завершена");

      // Показываем пользователю информацию
      if (hasPreviousReport) {
        toast.success(`${lastReport.reportDate} кунги хисобот юкланди`);
      } else {
        toast.info("Базада олдинги хисобот топилмади. Узингиз тулдиринг.");
      }
    } catch (error) {
      // console.error("❌ Ошибка инициализации данных:", error);
      toast.error("Маълумотлар юкланишида хатолик");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      initializeData();
    }
  }, [isOpen, station?.id, hoseNames]);

  // Загружаем платежные системы при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      loadPaymentMethods();
    }
  }, [isOpen]);

  // Перезагрузка данных об обнулениях при изменении даты отчета
  useEffect(() => {
    if (isOpen && station?.id && reportDate) {
      const reloadResetData = async () => {
        try {
          await loadAndApplyResetData(station.id, reportDate, true, null);
        } catch (error) {
          // Ошибка перезагрузки данных обнулений
        }
      };

      reloadResetData();
    }
  }, [reportDate, isOpen, station?.id]);

  // ========== ФУНКЦИИ ДЛЯ ОТЧЕТА ПО ПАРТНЕРАМ ==========

  // Обработчик двойного клика по полю цены партнера
  const handlePartnerPriceDoubleClick = (partner) => {
    handlePriceSetup(partner);
  };

  // Обработчик изменения проданных м³
  const handlePartnerSoldM3Change = (partnerId, soldM3) => {
    if (soldM3 === "") {
      setPartnerData((prev) =>
        prev.map((partner) => {
          if (partner.partnerId === partnerId) {
            const totalAmount = 0;

            return {
              ...partner,
              soldM3: "",
              totalAmount: totalAmount,
            };
          }
          return partner;
        })
      );
      return;
    }

    const formattedValue = formatNumberInput(soldM3);
    const numericValue = parseFormattedNumber(formattedValue);

    setPartnerData((prev) =>
      prev.map((partner) => {
        if (partner.partnerId === partnerId) {
          const totalAmount = numericValue * partner.pricePerM3;

          return {
            ...partner,
            soldM3: formattedValue,
            totalAmount: totalAmount,
          };
        }
        return partner;
      })
    );
  };

  // Подсчет итогов для партнеров
  const partnerTotals = partnerData.reduce(
    (acc, partner) => {
      const soldM3Value =
        partner.soldM3 === "" ? 0 : parseFormattedNumber(partner.soldM3);
      acc.totalM3 += soldM3Value;
      acc.totalAmount += partner.totalAmount;
      return acc;
    },
    { totalM3: 0, totalAmount: 0 }
  );

  // Проверка, есть ли данные для сохранения у партнеров
  const hasPartnerData = () => {
    return partnerData.some((partner) => {
      if (partner.soldM3 === "") return false;
      const numericValue = parseFormattedNumber(partner.soldM3);
      return numericValue > 0;
    });
  };

  // ========== ФУНКЦИИ ДЛЯ ОТЧЕТА ПО ШЛАНГАМ ==========

  // Расчет разницы и суммы для шланга с учетом обнулений
  const calculateHoseRowDiff = useCallback(
    (row) => {
      const prev = Number(row.prev) || 0;
      const current =
        row.current === "" ? 0 : parseFormattedNumber(row.current);
      const price = Number(row.price) || 0;

      let diff = 0;

      if (row.hasReset && row.resetInfo) {
        // Если есть обнуление, используем специальную формулу:
        // diff = (lastReadingBeforeReset - lastReadingFromReport) + (current - newReadingAfterReset)
        const lastReadingBeforeReset = row.resetInfo.lastReadingBeforeReset;
        const lastReadingFromReport = row.resetInfo.lastReadingFromReport;
        const newReadingAfterReset = row.resetInfo.newReadingAfterReset;

        // Расчет по вашей формуле:
        diff =
          lastReadingBeforeReset -
          lastReadingFromReport +
          (current - newReadingAfterReset);
      } else {
        // Базовая разница без обнулений
        if (current >= prev) {
          diff = current - prev;
        } else {
          // Если текущее меньше предыдущего, но нет обнуления - это ошибка
          diff = 0;
        }
      }

      const sum = diff * price;

      return {
        ...row,
        diff: Math.max(0, isNaN(diff) ? 0 : diff), // Не допускаем отрицательные значения
        sum: Math.max(0, isNaN(sum) ? 0 : sum),
      };
    },
    [parseFormattedNumber]
  );

  // Обработчик изменения текущего показания шланга
  const handleHoseCurrentChange = (index, value) => {
    const formattedValue = formatNumberInput(value);

    setHoseRows((prev) => {
      const newRows = [...prev];
      const updatedRow = {
        ...newRows[index],
        current: formattedValue,
      };

      const rowWithDiff = calculateHoseRowDiff(updatedRow);
      newRows[index] = rowWithDiff;

      const totals = newRows.reduce(
        (acc, row) => {
          const diff = Number(row.diff) || 0;
          const sum = Number(row.sum) || 0;
          return {
            totalGas: acc.totalGas + (diff > 0 ? diff : 0),
            totalSum: acc.totalSum + sum,
          };
        },
        { totalGas: 0, totalSum: 0 }
      );

      setHoseTotal(totals.totalGas);
      setHoseTotalSum(totals.totalSum);

      return newRows;
    });
  };

  // Обработчик изменения цены шланга
  const handleHosePriceChange = (index, value) => {
    const formattedValue = formatNumberInput(value);
    const numericValue = parseFormattedNumber(formattedValue);

    setHoseRows((prev) => {
      const newRows = [...prev];
      const updatedRow = {
        ...newRows[index],
        price: numericValue,
      };

      const rowWithDiff = calculateHoseRowDiff(updatedRow);
      newRows[index] = rowWithDiff;

      const totals = newRows.reduce(
        (acc, row) => {
          const diff = Number(row.diff) || 0;
          const sum = Number(row.sum) || 0;
          return {
            totalGas: acc.totalGas + (diff > 0 ? diff : 0),
            totalSum: acc.totalSum + sum,
          };
        },
        { totalGas: 0, totalSum: 0 }
      );

      setHoseTotal(totals.totalGas);
      setHoseTotalSum(totals.totalSum);

      return newRows;
    });
  };

  // Валидация отчета по шлангам (СТРОГАЯ)
  const isHoseReportValid = () => {
    // Проверяем, что все шланги имеют заполненные текущие показания
    const allCurrentFilled = hoseRows.every(
      (row) =>
        row.current !== "" &&
        row.current !== null &&
        row.current !== undefined &&
        !isNaN(parseFormattedNumber(row.current))
    );

    if (!allCurrentFilled) {
      return false;
    }

    // Проверяем, что текущее показание >= предыдущего (если нет обнуления)
    const hasInvalidCurrent = hoseRows.some((row) => {
      const current = parseFormattedNumber(row.current);
      const prev = Number(row.prev);
      return current < prev && !row.hasReset;
    });

    if (hasInvalidCurrent) {
      return false;
    }

    return true;
  };

  // ========== ФУНКЦИИ ДЛЯ ОБЩЕГО ОТЧЕТА ==========

  // Расчет наличных с динамическими платежными системами
  const calculateCashAmount = () => {
    const gasPrice = parseFormattedNumber(generalData.gasPrice);
    let totalPaymentMethods = 0;

    // Суммируем все активные платежные системы кроме "zhisobot"
    paymentMethods.forEach((method) => {
      if (method.dbFieldName !== "zhisobot" && method.isActive === 1) {
        const value = parseFormattedNumber(
          paymentValues[method.dbFieldName] || 0
        );
        totalPaymentMethods += value;
      }
    });

    const cashAmount =
      (hoseTotal - partnerTotals.totalM3) * gasPrice - totalPaymentMethods;

    return cashAmount > 0 ? cashAmount : 0;
  };

  // Валидация платежных систем (СТРОГАЯ, но исключая Z-отчет)
  const arePaymentMethodsValid = useCallback(() => {
    return activePaymentMethods.every((method) => {
      // Z-отчет рассчитывается автоматически, не проверяем его заполнение
      if (method.dbFieldName === "zhisobot") {
        return true;
      }

      const value = paymentValues[method.dbFieldName];

      // Проверяем, что поле заполнено
      if (value === "" || value === null || value === undefined) {
        return false;
      }

      const numericValue = parseFormattedNumber(value);
      const isValid = !isNaN(numericValue) && numericValue >= 0;

      return isValid;
    });
  }, [activePaymentMethods, paymentValues, parseFormattedNumber]);

  // Валидация общего отчета (СТРОГАЯ)
  const isGeneralReportValid = useCallback(() => {
    // Проверяем обязательные поля
    const autopilotValid =
      generalData.autopilotReading &&
      generalData.autopilotReading.trim() !== "" &&
      !isNaN(parseFormattedNumber(generalData.autopilotReading));

    if (!autopilotValid) {
      return false;
    }

    const gasPriceValid =
      generalData.gasPrice &&
      generalData.gasPrice.trim() !== "" &&
      !isNaN(parseFormattedNumber(generalData.gasPrice));

    if (!gasPriceValid) {
      return false;
    }

    const paymentMethodsValid = arePaymentMethodsValid();

    if (!paymentMethodsValid) {
      return false;
    }

    return true;
  }, [
    generalData.autopilotReading,
    generalData.gasPrice,
    arePaymentMethodsValid,
    parseFormattedNumber,
  ]);

  // Валидация партнеров (СТРОГАЯ)
  const arePartnersValid = useCallback(() => {
    // Если нет партнеров, считаем валидным
    if (partnerData.length === 0) {
      return true;
    }

    return partnerData.every((partner) => {
      // Проверяем, что у партнера есть цена (если он указан в списке)
      if (
        partner.pricePerM3 === 0 ||
        partner.pricePerM3 === null ||
        partner.pricePerM3 === undefined
      ) {
        return false;
      }

      // Проверяем, что поле продаж заполнено
      if (
        partner.soldM3 === "" ||
        partner.soldM3 === null ||
        partner.soldM3 === undefined
      ) {
        return false;
      }

      const soldM3Value = parseFormattedNumber(partner.soldM3);
      const isValid = !isNaN(soldM3Value) && soldM3Value >= 0;

      return isValid;
    });
  }, [partnerData, parseFormattedNumber]);

  // Общая валидация всего отчета (СТРОГАЯ ВЕРСИЯ)
  const isReportValid = useCallback(() => {
    // 1. Проверка шлангов
    if (!isHoseReportValid()) {
      return false;
    }

    // 2. Проверка партнеров
    if (!arePartnersValid()) {
      return false;
    }

    // 3. Проверка общего отчета
    if (!isGeneralReportValid()) {
      return false;
    }

    return true;
  }, [isHoseReportValid, arePartnersValid, isGeneralReportValid]);

  // ========== ФУНКЦИИ СОХРАНЕНИЯ ==========

  const getClientIP = async () => {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return "Номаълум";
    }
  };

  // Функция для сохранения данных партнеров в коллекцию contracts
  const savePartnerDataToContracts = async (partnerDataToSave) => {
    try {
      const savePromises = partnerDataToSave.map(async (partner) => {
        const contractRef = doc(db, "contracts", partner.partnerId);

        // Сначала получаем текущий документ контракта
        const contractDoc = await getDoc(contractRef);
        const currentContract = contractDoc.data();

        const partnerTransactionData = {
          reportDate: reportDate,
          soldM3: partner.soldM3,
          pricePerM3: partner.pricePerM3,
          totalAmount: partner.totalAmount,
          paymentSum: 0, // Добавляем поле для оплаты
          stationId: station.id,
          stationName: station.stationName,
          createdAt: new Date().toISOString(),
          createdBy: auth?.currentUser?.email || "unknown",
        };

        // Получаем текущие транзакции или создаем пустой массив
        const currentTransactions = currentContract.transactions || [];

        // Добавляем новую транзакцию
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

  // Функция для отладки валидации
  const checkValidationStatus = () => {
    // console.log("=== ПОДРОБНАЯ ПРОВЕРКА ВАЛИДАЦИИ ===");
    // console.log("1. Отчет по шлангам валиден:", isHoseReportValid());
    // console.log("2. Партнеры валидны:", arePartnersValid());
    // console.log("3. Общий отчет валиден:", isGeneralReportValid());
    // console.log("4. Всего отчет валиден:", isReportValid());

    // console.log("--- ШЛАНГИ ---");
    hoseRows.forEach((row, idx) => {
      // console.log(
      //   `${idx + 1}. ${row.hose}:`,
      //   `Текущий: "${row.current}"`,
      //   `Заполнено: ${row.current !== ""}`,
      //   `Валидно: ${!isNaN(parseFormattedNumber(row.current))}`
      // );
    });

    // console.log("--- ПАРТНЕРЫ ---");
    partnerData.forEach((partner, idx) => {
      // console.log(
      //   `${idx + 1}. ${partner.partnerName}:`,
      //   `Цена: ${partner.pricePerM3}`,
      //   `SoldM3: "${partner.soldM3}"`,
      //   `Цена установлена: ${partner.pricePerM3 !== 0}`,
      //   `Продажи заполнены: ${partner.soldM3 !== ""}`
      // );
    });

    // console.log("--- ОБЩИЕ ДАННЫЕ ---");
    // console.log(
    //   "autopilotReading:",
    //   generalData.autopilotReading,
    //   "- заполнено:",
    //   !!generalData.autopilotReading &&
    //     generalData.autopilotReading.trim() !== ""
    // );
    // console.log(
    //   "gasPrice:",
    //   generalData.gasPrice,
    //   "- заполнено:",
    //   !!generalData.gasPrice && generalData.gasPrice.trim() !== ""
    // );

    // console.log("--- ПЛАТЕЖНЫЕ СИСТЕМЫ ---");
    activePaymentMethods.forEach((method) => {
      const value = paymentValues[method.dbFieldName];
      // Для Z-отчета показываем особую информацию
      if (method.dbFieldName === "zhisobot") {
        const cashAmount = calculateCashAmount();
        // console.log(
        //   `${method.name}:`,
        //   `(автоматически)`,
        //   `Расчетное значение: ${formatNumberForDisplay(cashAmount)} сўм`
        // );
      } else {
        // console.log(
        //   `${method.name}:`,
        //   `Значение: "${value}"`,
        //   `Заполнено: ${value !== "" && value !== null && value !== undefined}`
        // );
      }
    });
  };

  // Функция для открытия модального окна подтверждения
  const handleSaveClick = () => {
    if (!isReportValid()) {
      toast.error("Барча мажбурий майдонларни тўлдиринг");
      return;
    }

    setIsConfirmModalOpen(true);
  };

  // Сохранение объединенного отчета в квартальную коллекцию
  // Сохранение объединенного отчета в квартальную коллекцию
  const saveUnifiedReport = async () => {
    try {
      setLoading(true);

      // Проверяем существующие отчеты перед сохранением
      const hasExistingReport = await checkExistingReport();
      if (hasExistingReport) {
        setIsConfirmModalOpen(false);
        setLoading(false);
        return;
      }

      // Конвертируем дату отчета для поиска обнулений
      const [year, month, day] = reportDate.split("-");
      const resetDateFormatted = `${day}-${month}-${year}`;

      // Загружаем актуальные данные об обнулениях
      const resetQuery = query(
        collection(db, "meterResetEvents"),
        where("stationId", "==", station.id),
        where("resetDate", "==", resetDateFormatted)
      );

      const resetSnapshot = await getDocs(resetQuery);
      const resetEvents = resetSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const ip = await getClientIP();
      const userEmail = auth?.currentUser?.email || "unknown";

      const cashAmount = calculateCashAmount();

      // Подготавливаем данные шлангов с учетом обнулений
      const hoseData = hoseRows.map((row) => {
        let finalDiff = Number(row.diff) || 0;
        let resetCalculation = null;

        // Проверяем, есть ли обнуления для этого шланга на дату отчета
        const hoseResetEvents = resetEvents.filter(
          (event) => event.hose === row.hose
        );

        if (hoseResetEvents.length > 0) {
          const latestReset = hoseResetEvents[0];

          // Применяем формулу коррекции для финального diff
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

      // Подготавливаем данные партнеров (все партнеры должны быть заполнены)
      const partnerDataToSave = partnerData.map((partner) => ({
        ...partner,
        soldM3: parseFormattedNumber(partner.soldM3),
        paymentSum: 0, // Добавляем поле для оплаты
        autoId: partner.autoId, // Сохраняем autoId для сохранения порядка
      }));

      // Сохраняем данные партнеров в коллекцию contracts
      if (partnerDataToSave.length > 0) {
        await savePartnerDataToContracts(partnerDataToSave);
      }

      // Подготавливаем данные платежных систем
      const paymentData = {};
      paymentMethods.forEach((method) => {
        let value = 0;

        if (method.isActive === 1) {
          value = parseFormattedNumber(paymentValues[method.dbFieldName] || 0);
        }

        paymentData[method.dbFieldName] = value;
      });

      // Добавляем Z-отчет в данные платежей (рассчитанное значение)
      paymentData.zhisobot = cashAmount;

      // Определяем имя коллекции для сохранения
      const collectionName = getCollectionNameByDate(reportDate);
      const quarter = getQuarterFromDate(reportDate);
      const reportYear = new Date(reportDate).getFullYear(); // Изменили переменную с year на reportYear

      // Создаем объединенный отчет
      const reportData = {
        reportDate,
        stationId: station.id,
        stationName: station.stationName || "Неизвестная станция",

        // Данные партнеров (уже отсортированы по autoId)
        partnerData: partnerDataToSave,
        partnerTotalM3: partnerTotals.totalM3,
        partnerTotalAmount: partnerTotals.totalAmount,
        partnerTotalPaymentSum: 0,
        hasPartnerData: partnerData.length > 0,

        // Данные шлангов
        hoseData: hoseData,
        hoseTotalGas: hoseTotal,
        hoseTotalSum: hoseTotalSum,

        // Общие данные
        generalData: {
          autopilotReading: parseFormattedNumber(generalData.autopilotReading),
          gasPrice: parseFormattedNumber(generalData.gasPrice),
        },

        // Динамические данные платежей
        paymentData: paymentData,
        paymentMethods: paymentMethods.map((method) => ({
          id: method.id,
          name: method.name,
          dbFieldName: method.dbFieldName,
          description: method.description,
          isActive: method.isActive,
        })),

        // Метаданные
        createdBy: userEmail,
        createdAt: serverTimestamp(),
        createdIp: ip,
        status: "completed",
        hasMeterResets: resetEvents.length > 0,
        meterResetEventsCount: resetEvents.length,

        // Информация о квартале для удобства
        quarter: quarter,
        year: reportYear, // Используем reportYear вместо year
        collectionName: collectionName,
      };

      // Сохраняем отчет в соответствующую квартальную коллекцию
      const docRef = await saveReportToQuarterCollection(db, reportData);

      // Сохраняем информацию о сохраненном отчете (для возможности удаления при отмене)
      setSavedReportId(docRef.id);
      setSavedReportCollection(collectionName);

      // console.log(`✅ Отчет сохранен в коллекцию: ${collectionName}`);
      // console.log(`📅 Квартал: ${quarter} квартал ${reportYear} года`); // Используем reportYear

      // Закрываем модальное окно подтверждения и открываем окно успеха
      setIsConfirmModalOpen(false);
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error("Save report error:", error);
      toast.error("Ҳисоботни сақлашда хатолик");
    } finally {
      setLoading(false);
    }
  };

  // Завершение работы с отчетом
  const handleFinish = () => {
    setIsSuccessModalOpen(false);
    // Сбрасываем состояние и закрываем модальное окно
    setPartnerData([]);
    setHoseRows([]);
    setGeneralData({
      autopilotReading: "",
      gasPrice: "",
    });
    setPaymentValues({});
    setSavedReportId(null);
    setSavedReportCollection("");
    setSelectedPartnerData(null);
    setPreviousReportDateForPartner("");

    // Вызываем callback для обновления списка отчетов
    if (onSaved) {
      onSaved();
    }

    onClose();
  };

  // Сброс формы при отмене
  const handleClose = async () => {
    // Если отчет был сохранен (но пользователь нажал "Бекор" после сохранения), удаляем его
    if (savedReportId && savedReportCollection) {
      try {
        await deleteReportFromQuarterCollection(
          db,
          savedReportCollection,
          savedReportId
        );
        // console.log(`🗑️ Отчет удален из коллекции: ${savedReportCollection}`);
      } catch (error) {
        console.error("Error deleting report:", error);
      }
    }

    setPartnerData([]);
    setHoseRows([]);
    setGeneralData({
      autopilotReading: "",
      gasPrice: "",
    });
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

  // Обработчик открытия модального окна для установки цены
  const handlePriceSetup = async (partner) => {
    try {
      setLoading(true);

      const latestReportDate = await getLatestPartnerReportDate(
        partner.partnerId
      );
      setPreviousReportDateForPartner(latestReportDate || "");

      const currentPrice = await getLatestPartnerPrice(partner.partnerId);
      const priceHistory = await getPartnerPriceHistory(partner.partnerId);

      const partnerFullData = {
        ...partner,
        currentPrice: currentPrice,
        priceHistory: priceHistory,
      };

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
              {/* Заголовок */}
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
                {/* Общее поле даты */}
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
                      {/* Коллекция:{" "} */}
                      {/* <span className="font-semibold">
                        {getCollectionNameByDate(reportDate)}
                      </span> */}
                      <div className="text-xs text-gray-600 mt-1">
                        {new Date(reportDate).getFullYear()} йил{" "}
                        {getQuarterFromDate(reportDate)} квартал{" "}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Правая колонка: Отчет по шлангам */}
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
                                  row.current
                                );
                                const prevNum = Number(row.prev);
                                const isInvalid =
                                  row.current !== "" &&
                                  currentNum < prevNum &&
                                  !row.hasReset;

                                return (
                                  <tr
                                    key={row.hose}
                                    className={`hover:bg-gray-50 transition-colors ${
                                      row.hasReset ? "bg-yellow-50" : ""
                                    }`}
                                  >
                                    <td className="px-3 py-2">
                                      <div className="flex items-center">
                                        <span className="font-semibold text-gray-900 text-xs md:text-sm">
                                          {row.hose}
                                        </span>
                                        {row.hasReset && (
                                          <span
                                            className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full"
                                            title="Кўрсаткич нўлланган"
                                          >
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
                                                e.target.value
                                              ) || 0;
                                            setHoseRows(newRows);
                                          }}
                                          disabled={row.prevDisabled || loading}
                                          className={`w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 no-spinner text-xs md:text-sm ${
                                            row.prevDisabled
                                              ? "bg-gray-100 text-gray-600"
                                              : "bg-white"
                                          }`}
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
                                      <div className="mt-1 text-xs text-gray-500">
                                        {row.prevDisabled
                                          ? ""
                                          : "Биринчи марта курсаткични узингиз киритинг"}
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
                                            e.target.value
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
                                      {row.current === "" && (
                                        <div className="mt-1 text-xs text-red-600"></div>
                                      )}
                                    </td>
                                    <td className="px-2 py-3 md:px-3 md:w-1/6">
                                      <div className="flex flex-col">
                                        <span
                                          className={`font-semibold text-xs md:text-sm ${
                                            row.diff > 0
                                              ? "text-green-600"
                                              : "text-gray-500"
                                          }`}
                                        >
                                          {formatNumberForDisplay(row.diff)}
                                        </span>
                                        {row.hasReset && (
                                          <span className="text-xs text-orange-600 mt-1">
                                            Нўлланиш ҳисоби б-н
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Итоги по шлангам */}
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

                  {/* Левая колонка: Партнеры и Общий отчет */}
                  <div className="space-y-6">
                    {/* Отчет по партнерам с отображением номера */}
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
                              Бу заправкада хамкорлар мавжуд эмас
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
                                      {/* Отображаем autoId или порядковый номер */}
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
                                                    partner.pricePerM3
                                                  )}
                                            </span>
                                            {partner.pricePerM3 === 0 ? (
                                              <svg
                                                className="w-4 h-4 text-red-500"
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
                                            ) : (
                                              <svg
                                                className="w-4 h-4 text-green-500"
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
                                            )}
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
                                            e.target.value
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
                                      {partner.soldM3 === "" && (
                                        <div className="mt-1 text-xs text-red-600"></div>
                                      )}
                                    </td>
                                    <td className="p-2 text-right font-semibold text-sm">
                                      {formatNumberForDisplay(
                                        partner.totalAmount
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
                                        partnerTotals.totalM3
                                      )}{" "}
                                      м³
                                    </td>
                                    <td className="p-2 text-right font-semibold text-sm">
                                      {formatNumberForDisplay(
                                        partnerTotals.totalAmount
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

                    {/* Общий отчет с динамическими платежными системами */}
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
                        {/* Базовые поля */}
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
                                  e.target.value
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
                            {generalData.autopilotReading === "" && (
                              <div className="mt-1 text-xs text-red-600">
                                Мажбурий тўлдириш майдони
                              </div>
                            )}
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
                                  e.target.value
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
                            {generalData.gasPrice === "" && (
                              <div className="mt-1 text-xs text-red-600">
                                Мажбурий тўлдириш майдони
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Динамические платежные системы (только активные, исключая Z-отчет) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {activePaymentMethods
                            .filter(
                              (method) => method.dbFieldName !== "zhisobot"
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

                        {/* Z-отчет (рассчитывается автоматически) */}
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

                {/* Сводная информация */}
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

                {/* Информация о сохранении */}
                {/* {reportDate && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center">
                      <svg
                        className="w-5 h-5 text-blue-600 mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div className="text-sm text-blue-800">
                        <div className="font-semibold">
                          Отчет будет сохранен в коллекцию:
                        </div>
                        <div className="font-mono text-xs mt-1 bg-white p-2 rounded border">
                          {getCollectionNameByDate(reportDate)}
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          {getQuarterFromDate(reportDate)} квартал{" "}
                          {new Date(reportDate).getFullYear()} года
                        </div>
                      </div>
                    </div>
                  </div>
                )} */}

                {/* Отладочная информация */}
                {/* <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                  <button
                    onClick={checkValidationStatus}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Проверить валидацию (отладка)
                  </button>
                  <div className="mt-2 text-sm text-gray-700">
                    Статус:{" "}
                    {isReportValid()
                      ? "✅ Все проверки пройдены"
                      : "❌ Требуются исправления"}
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    • Шланги: {hoseRows.filter((r) => r.current !== "").length}/
                    {hoseRows.length} заполнено
                    <br />• Партнеры:{" "}
                    {
                      partnerData.filter(
                        (p) => p.soldM3 !== "" && p.pricePerM3 !== 0
                      ).length
                    }
                    /{partnerData.length} заполнено
                    <br />• Общие поля:{" "}
                    {(generalData.autopilotReading !== "" ? 1 : 0) +
                      (generalData.gasPrice !== "" ? 1 : 0)}
                    /2 заполнено
                    <br />• Платежные системы (кроме Z-отчета):{" "}
                    {
                      activePaymentMethods
                        .filter((m) => m.dbFieldName !== "zhisobot")
                        .filter((m) => paymentValues[m.dbFieldName] !== "")
                        .length
                    }
                    /
                    {
                      activePaymentMethods.filter(
                        (m) => m.dbFieldName !== "zhisobot"
                      ).length
                    }{" "}
                    заполнено
                    <br />• Коллекция для сохранения:{" "}
                    {reportDate ? getCollectionNameByDate(reportDate) : "—"}
                  </div>
                </div> */}
              </div>

              {/* Кнопки управления */}
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
                        (m) => m.dbFieldName !== "zhisobot"
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

      {/* Модальное окно установки цены */}
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

      {/* Модальное окно подтверждения сохранения */}
      <AnimatePresence>
        {isConfirmModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-2"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-t-2xl">
                <div className="flex items-center justify-center">
                  <div className="bg-white bg-opacity-20 p-3 rounded-full">
                    <svg
                      className="w-8 h-8 text-white"
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
                <h3 className="text-xl font-bold text-white text-center mt-4">
                  Сақлашни тасдиқлайсизми?
                </h3>
              </div>

              <div className="p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800 text-center font-medium">
                    ⚠️ Сақланганингизда сўнг ҳисоботни ўзгартириб бўлмайди!
                  </p>
                  {/* <div className="mt-2 text-xs text-yellow-700 text-center">
                    Отчет будет сохранен в коллекцию:{" "}
                    <span className="font-semibold">
                      {getCollectionNameByDate(reportDate)}
                    </span>
                  </div> */}
                </div>

                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span className="font-medium">Сана:</span>
                    <span>{reportDate}</span>
                  </div>
                  {/* <div className="flex justify-between">
                    <span className="font-medium">Коллекция:</span>
                    <span className="font-mono text-xs">
                      {getCollectionNameByDate(reportDate)}
                    </span>
                  </div> */}
                  {/* <div className="flex justify-between">
                    <span className="font-medium">Квартал:</span>
                    <span>
                      {getQuarterFromDate(reportDate)} квартал{" "}
                      {new Date(reportDate).getFullYear()} года
                    </span>
                  </div> */}
                  <div className="flex justify-between">
                    <span className="font-medium">Автопилот:</span>
                    <span>
                      {formatNumberForDisplay(generalData.autopilotReading)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">1м³ нархи:</span>
                    <span>
                      {formatNumberForDisplay(generalData.gasPrice)} сўм
                    </span>
                  </div>

                  {/* Платежные системы (кроме Z-отчета) */}
                  {activePaymentMethods
                    .filter((method) => method.dbFieldName !== "zhisobot")
                    .map((method) => {
                      const value = parseFormattedNumber(
                        paymentValues[method.dbFieldName] || 0
                      );
                      return (
                        <div key={method.id} className="flex justify-between">
                          <span className="font-medium">{method.name}:</span>
                          <span>{formatNumberForDisplay(value)} сўм</span>
                        </div>
                      );
                    })}

                  <div className="flex justify-between">
                    <span className="font-medium">
                      Шланглар орқали сотилди:
                    </span>
                    <span>{formatNumberForDisplay(hoseTotal)} м³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Хамкорларга сотилди:</span>
                    <span>
                      {formatNumberForDisplay(partnerTotals.totalM3)} м³
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="font-bold">Z-ҳисобот (наличные):</span>
                    <span className="font-bold text-orange-600">
                      {formatNumberForDisplay(calculateCashAmount())} сўм
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button
                    onClick={() => setIsConfirmModalOpen(false)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex-1"
                  >
                    Бекор
                  </button>
                  <button
                    onClick={saveUnifiedReport}
                    disabled={loading}
                    className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex-1 flex items-center justify-center disabled:bg-orange-300"
                  >
                    {loading ? (
                      "Сақланмоқда..."
                    ) : (
                      <>
                        <svg
                          className="w-5 h-5 mr-2"
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
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модальное окно успешного сохранения */}
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
                  {/* <div className="mt-2 text-sm text-green-600">
                    • Коллекция:{" "}
                    <span className="font-semibold">
                      {getCollectionNameByDate(reportDate)}
                    </span>
                  </div> */}
                  {/* <div className="mt-2 text-sm text-green-600">
                    • Квартал:{" "}
                    <span className="font-semibold">
                      {getQuarterFromDate(reportDate)} квартал
                    </span>
                  </div> */}
                  <div className="text-sm text-green-600">
                    • {hoseRows.length} шланг
                  </div>
                  <div className="text-sm text-green-600">
                    • {partnerData.length} хамкор
                  </div>
                  <div className="text-sm text-green-600">
                    •{" "}
                    {
                      activePaymentMethods.filter(
                        (m) => m.dbFieldName !== "zhisobot"
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
