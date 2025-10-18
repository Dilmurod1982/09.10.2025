import React, { useEffect, useState, useCallback } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "../firebase/config";
import toast from "react-hot-toast";

const AddGeneralReportModal = ({ station, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [lastReport, setLastReport] = useState(null);
  const [formData, setFormData] = useState({
    date: "",
    autopilotReading: "",
    gasPrice: "",
    humoTerminal: "",
    uzcardTerminal: "",
  });
  const [calculatedData, setCalculatedData] = useState({
    hoseTotalGas: 0,
    partnerTotalGas: 0,
    partnerTotalSum: 0,
    cashAmount: 0,
  });
  const [dateDisabled, setDateDisabled] = useState(false);
  const [reportsFound, setReportsFound] = useState({
    hoseReport: false,
    partnerReport: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false); // Новое состояние для модального подтверждения

  // Функция для форматирования числа с разделителями разрядов
  const formatNumber = (value) => {
    if (value === "" || value === null || value === undefined) return "";
    const number = parseFloat(value);
    if (isNaN(number)) return value;
    return number.toLocaleString("ru-RU");
  };

  // Функция для очистки форматирования (удаление пробелов)
  const cleanNumber = (value) => {
    return value.toString().replace(/\s/g, "");
  };

  // Функция для обработки ввода чисел с форматированием
  const handleNumberInput = (field, value) => {
    const cleanedValue = value.replace(/[^\d,.]/g, "");
    setFormData((prev) => ({
      ...prev,
      [field]: cleanedValue,
    }));
  };

  // Функция для получения числового значения из форматированной строки
  const getNumericValue = (value) => {
    if (!value) return 0;
    const cleaned = cleanNumber(value).replace(",", ".");
    return parseFloat(cleaned) || 0;
  };

  // Функция для добавления дней к дате
  const addDays = useCallback((dateString, days) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }, []);

  // Загрузка последнего отчета и установка даты
  useEffect(() => {
    if (!station?.id) return;

    const fetchLastReport = async () => {
      try {
        const generalReportQuery = query(
          collection(db, "generalDailyReports"),
          where("stationId", "==", station.id),
          orderBy("date", "desc"),
          limit(1)
        );

        const generalReportSnapshot = await getDocs(generalReportQuery);

        if (!generalReportSnapshot.empty) {
          const lastGeneralReport = generalReportSnapshot.docs[0].data();
          setLastReport(lastGeneralReport);

          const nextDate = addDays(lastGeneralReport.date, 1);
          setFormData((prev) => ({
            ...prev,
            date: nextDate,
            gasPrice: lastGeneralReport.gasPrice
              ? formatNumber(lastGeneralReport.gasPrice)
              : "",
          }));
          setDateDisabled(true);
        } else {
          setLastReport(null);
          setDateDisabled(false);
          setFormData((prev) => ({
            ...prev,
            date: "",
            gasPrice: "",
          }));
        }
      } catch (error) {
        console.error("Ошибка при загрузке последнего отчета:", error);
        toast.error("Ошибка при загрузке данных");
        setDateDisabled(false);
      }
    };

    fetchLastReport();
  }, [station?.id, addDays]);

  // Загрузка данных по шлангам и партнерам при изменении даты
  useEffect(() => {
    if (!station?.id || !formData.date) {
      setCalculatedData({
        hoseTotalGas: 0,
        partnerTotalGas: 0,
        partnerTotalSum: 0,
        cashAmount: 0,
      });
      setReportsFound({
        hoseReport: false,
        partnerReport: false,
      });
      return;
    }

    const loadReportsData = async () => {
      try {
        // Загружаем отчет по шлангам за выбранную дату
        const hoseReportQuery = query(
          collection(db, "daily_hose_reports"),
          where("stationId", "==", station.id),
          where("date", "==", formData.date)
        );

        const hoseReportSnapshot = await getDocs(hoseReportQuery);
        let hoseTotalGas = 0;
        let hoseReportFound = false;

        if (!hoseReportSnapshot.empty) {
          const hoseReport = hoseReportSnapshot.docs[0].data();
          hoseTotalGas = hoseReport.totalgas || 0;
          hoseReportFound = true;
        }

        // Загружаем отчет по партнерам за выбранную дату
        const partnerReportQuery = query(
          collection(db, "dailyPartnerReports"),
          where("stationId", "==", station.id),
          where("reportDate", "==", formData.date)
        );

        const partnerReportSnapshot = await getDocs(partnerReportQuery);
        let partnerTotalGas = 0;
        let partnerTotalSum = 0;
        let partnerReportFound = false;

        if (!partnerReportSnapshot.empty) {
          const partnerReport = partnerReportSnapshot.docs[0].data();
          partnerTotalGas = partnerReport.totalgaspartner || 0;
          partnerTotalSum = partnerReport.totalsumgaspartner || 0;
          partnerReportFound = true;
        }

        setCalculatedData((prev) => ({
          ...prev,
          hoseTotalGas,
          partnerTotalGas,
          partnerTotalSum,
        }));

        setReportsFound({
          hoseReport: hoseReportFound,
          partnerReport: partnerReportFound,
        });
      } catch (error) {
        console.error("Ошибка при загрузке данных отчетов:", error);
        toast.error("Ошибка при загрузке данных отчетов");
      }
    };

    loadReportsData();
  }, [station?.id, formData.date]);

  // Расчет наличных при изменении данных
  useEffect(() => {
    const autopilotReading = getNumericValue(formData.autopilotReading);
    const gasPrice = getNumericValue(formData.gasPrice);
    const humoTerminal = getNumericValue(formData.humoTerminal);
    const uzcardTerminal = getNumericValue(formData.uzcardTerminal);
    const partnerTotalSum = calculatedData.partnerTotalSum || 0;

    const cashAmount =
      (calculatedData.hoseTotalGas - calculatedData.partnerTotalGas) *
        gasPrice -
      humoTerminal -
      uzcardTerminal;

    setCalculatedData((prev) => ({
      ...prev,
      cashAmount: cashAmount > 0 ? cashAmount : 0,
    }));
  }, [
    formData.autopilotReading,
    formData.gasPrice,
    formData.humoTerminal,
    formData.uzcardTerminal,
    calculatedData.partnerTotalGas,
    calculatedData.partnerTotalSum,
  ]);

  // Обработчик изменения формы
  const handleInputChange = (field, value) => {
    if (field === "date") {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    } else {
      handleNumberInput(field, value);
    }
  };

  // Валидация формы
  const isFormValid = useCallback(() => {
    const basicFieldsValid =
      formData.date &&
      formData.autopilotReading &&
      formData.gasPrice &&
      formData.humoTerminal !== "" &&
      formData.uzcardTerminal !== "";

    const reportsValid = reportsFound.hoseReport && reportsFound.partnerReport;

    return basicFieldsValid && reportsValid;
  }, [formData, reportsFound]);

  // Получение IP клиента
  const getClientIp = async () => {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      return data.ip || "unknown";
    } catch (error) {
      return "unknown";
    }
  };

  // Проверка существующих отчетов ДО сохранения
  const checkExistingReportsBeforeSave = async () => {
    try {
      const generalReportSnapshot = await getDocs(
        query(
          collection(db, "generalDailyReports"),
          where("stationId", "==", station.id),
          where("date", "==", formData.date)
        )
      );

      return !generalReportSnapshot.empty;
    } catch (error) {
      console.error("Ошибка при проверке отчетов:", error);
      return false;
    }
  };

  // Функция для проверки целостности сохраненного отчета
  const verifySavedReport = async (docId) => {
    try {
      const savedDoc = await getDocs(
        query(
          collection(db, "generalDailyReports"),
          where("__name__", "==", docId)
        )
      );

      if (savedDoc.empty) {
        return { success: false, error: "Документ не найден в базе данных" };
      }

      const reportData = savedDoc.docs[0].data();

      const requiredFields = [
        "stationId",
        "stationName",
        "date",
        "autopilotReading",
        "gasPrice",
        "hoseTotalGas",
        "partnerTotalGas",
        "partnerTotalSum",
        "humoTerminal",
        "uzcardTerminal",
        "cashAmount",
        "createdBy",
        "controlsum", // Добавляем controlsum в обязательные поля
      ];

      const missingFields = requiredFields.filter((field) => {
        const value = reportData[field];
        return value === undefined || value === null || value === "";
      });

      if (missingFields.length > 0) {
        return {
          success: false,
          error: `Отсутствуют обязательные поля: ${missingFields.join(", ")}`,
        };
      }

      return { success: true, data: reportData };
    } catch (error) {
      return { success: false, error: `Ошибка проверки: ${error.message}` };
    }
  };

  // Функция для удаления неполного отчета
  const deleteIncompleteReport = async (docId) => {
    try {
      await deleteDoc(doc(db, "generalDailyReports", docId));
      console.log("Неполный отчет удален:", docId);
      return true;
    } catch (error) {
      console.error("Ошибка при удалении неполного отчета:", error);
      return false;
    }
  };

  // Расчет контрольной суммы
  const calculateControlSum = () => {
    const autopilotReading = getNumericValue(formData.autopilotReading);
    const gasPrice = getNumericValue(formData.gasPrice);
    const humoTerminal = getNumericValue(formData.humoTerminal);
    const uzcardTerminal = getNumericValue(formData.uzcardTerminal);

    // Создаем контрольную сумму на основе всех данных отчета
    const controlData = {
      autopilotReading,
      gasPrice,
      hoseTotalGas: calculatedData.hoseTotalGas,
      partnerTotalGas: calculatedData.partnerTotalGas,
      partnerTotalSum: calculatedData.partnerTotalSum,
      humoTerminal,
      uzcardTerminal,
      cashAmount: calculatedData.cashAmount,
      timestamp: Date.now(),
    };

    // Простой хеш для контроля целостности данных
    return (
      JSON.stringify(controlData).length +
      autopilotReading +
      gasPrice +
      calculatedData.cashAmount
    );
  };

  // Подтверждение сохранения
  const confirmSave = async () => {
    if (!isFormValid()) {
      if (!reportsFound.hoseReport || !reportsFound.partnerReport) {
        toast.error("Не найдены необходимые отчеты по шлангам или партнерам");
      } else {
        toast.error("Заполните все обязательные поля");
      }
      return;
    }

    if (isSaving) {
      toast.error("Отчет уже сохраняется, пожалуйста подождите...");
      return;
    }

    // Проверяем ДО сохранения
    const hasExistingReport = await checkExistingReportsBeforeSave();
    if (hasExistingReport) {
      toast.error("Отчет за эту дату уже существует!");
      return;
    }

    // Показываем модальное окно подтверждения вместо стандартного confirm
    setShowConfirmation(true);
  };

  // Сохранение отчета (после подтверждения)
  const handleSave = async () => {
    setShowConfirmation(false); // Закрываем модальное окно подтверждения

    if (!isFormValid()) {
      toast.error(
        "Нельзя сохранить отчет - проверьте все поля и наличие отчетов"
      );
      return;
    }

    if (isSaving) {
      toast.error("Отчет уже сохраняется, пожалуйста подождите...");
      return;
    }

    setIsSaving(true);
    setLoading(true);
    const toastId = toast.loading("Сохранение отчета...");

    try {
      const ip = await getClientIp();
      const userEmail = auth?.currentUser?.email || "unknown";

      // Рассчитываем контрольную сумму
      const controlsum = calculateControlSum();

      const reportData = {
        stationId: station.id,
        stationName: station.stationName,
        date: formData.date,
        autopilotReading: getNumericValue(formData.autopilotReading),
        gasPrice: getNumericValue(formData.gasPrice),
        hoseTotalGas: calculatedData.hoseTotalGas,
        partnerTotalGas: calculatedData.partnerTotalGas,
        partnerTotalSum: calculatedData.partnerTotalSum,
        humoTerminal: getNumericValue(formData.humoTerminal),
        uzcardTerminal: getNumericValue(formData.uzcardTerminal),
        cashAmount: calculatedData.cashAmount,
        createdBy: userEmail,
        createdAt: serverTimestamp(),
        createdIp: ip,
        hoseReportFound: reportsFound.hoseReport,
        partnerReportFound: reportsFound.partnerReport,
        dataHash: Date.now().toString(),
        controlsum: controlsum, // Добавляем контрольную сумму
      };

      // Сохраняем отчет
      const docRef = await addDoc(
        collection(db, "generalDailyReports"),
        reportData
      );

      // Ждем немного чтобы данные точно записались
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Проверяем сохранение и целостность данных
      const verification = await verifySavedReport(docRef.id);

      if (!verification.success) {
        await deleteIncompleteReport(docRef.id);
        toast.error(
          `Не все данные сохранились: ${verification.error}. Пожалуйста, составьте отчет заново.`,
          { duration: 5000 }
        );
        return;
      }

      toast.success("Отчет успешно сохранен и проверен!");
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (error) {
      console.error("Ошибка сохранения:", error);

      // Пытаемся найти и удалить неполностью сохранившийся отчет
      try {
        const incompleteReports = await getDocs(
          query(
            collection(db, "generalDailyReports"),
            where("stationId", "==", station.id),
            where("date", "==", formData.date),
            orderBy("createdAt", "desc"),
            limit(1)
          )
        );

        if (!incompleteReports.empty) {
          const incompleteDoc = incompleteReports.docs[0];
          await deleteIncompleteReport(incompleteDoc.id);
        }
      } catch (deleteError) {
        console.error(
          "Ошибка при попытке удалить неполный отчет:",
          deleteError
        );
      }

      toast.error(
        "Ошибка при сохранении отчета. Проверьте подключение к интернету и попробуйте еще раз."
      );
    } finally {
      setLoading(false);
      setIsSaving(false);
      toast.dismiss(toastId);
    }
  };

  // Модальное окно подтверждения
  const ConfirmationModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[50]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-2">
        {/* Заголовок */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-t-2xl">
          <div className="flex items-center justify-center">
            <div className="bg-white bg-opacity-20 p-3 rounded-full">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
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
            Подтверждение сохранения
          </h3>
        </div>

        {/* Содержимое */}
        <div className="p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800 text-center font-medium">
              ⚠️ После сохранения изменить данные будет невозможно!
            </p>
          </div>

          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex justify-between">
              <span className="font-medium">Дата:</span>
              <span>{formData.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Показание счетчика:</span>
              <span>{formatNumber(formData.autopilotReading)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Цена за м³:</span>
              <span>{formatNumber(formData.gasPrice)} ₽</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Продано через шланги:</span>
              <span>{calculatedData.hoseTotalGas.toLocaleString()} м³</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Продано партнерам:</span>
              <span>{calculatedData.partnerTotalGas.toLocaleString()} м³</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Сумма партнеров:</span>
              <span>
                {calculatedData.partnerTotalSum.toLocaleString("ru-RU", {
                  minimumFractionDigits: 2,
                })}{" "}
                ₽
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Терминал Хумо:</span>
              <span>{formatNumber(formData.humoTerminal)} ₽</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Терминал Узкард:</span>
              <span>{formatNumber(formData.uzcardTerminal)} ₽</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2">
              <span className="font-bold">Наличные:</span>
              <span className="font-bold text-orange-600">
                {calculatedData.cashAmount.toLocaleString("ru-RU", {
                  minimumFractionDigits: 2,
                })}{" "}
                ₽
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={() => setShowConfirmation(false)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex-1">
              Отмена
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex-1 flex items-center justify-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Подтвердить сохранение
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden mx-2 sm:mx-4">
          {/* Заголовок */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 sm:p-6">
            <div className="flex justify-between items-start sm:items-center">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-white truncate">
                  Новый общий отчет
                </h2>
                <p className="text-blue-100 mt-1 text-sm sm:text-base truncate">
                  {station?.stationName} • {formData.date || "Не выбрана дата"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-blue-500 p-1 sm:p-2 rounded-full transition-colors flex-shrink-0 ml-2"
                disabled={loading || isSaving}>
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
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

          <div
            className="p-4 sm:p-6 overflow-auto"
            style={{ maxHeight: "calc(95vh - 80px)" }}>
            {/* Основные поля */}
            <div className="space-y-4 sm:space-y-6 mb-6">
              {/* Дата */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Дата отчета *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange("date", e.target.value)}
                  disabled={dateDisabled || loading || isSaving}
                  className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-sm sm:text-base"
                  required
                />
                {dateDisabled && lastReport && (
                  <p className="text-sm text-green-600 mt-2">
                    Дата установлена автоматически (+1 день к последнему отчету{" "}
                    {lastReport.date})
                  </p>
                )}
                {!dateDisabled && (
                  <p className="text-sm text-gray-500 mt-2">
                    Выберите дату вручную (первый отчет)
                  </p>
                )}
              </div>

              {/* Статус найденных отчетов */}
              <div
                className={`border rounded-lg p-4 ${
                  reportsFound.hoseReport && reportsFound.partnerReport
                    ? "bg-green-50 border-green-200"
                    : "bg-yellow-50 border-yellow-200"
                }`}>
                <h3 className="text-sm font-semibold mb-2">
                  Статус отчетов за {formData.date}:
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <div
                      className={`w-3 h-3 rounded-full mr-2 ${
                        reportsFound.hoseReport
                          ? "bg-green-500"
                          : "bg-yellow-500"
                      }`}></div>
                    <span className="text-sm">
                      Отчет по шлангам:{" "}
                      {reportsFound.hoseReport ? "Найден" : "Не найден"}
                      {reportsFound.hoseReport &&
                        ` (${calculatedData.hoseTotalGas.toLocaleString()} м³)`}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div
                      className={`w-3 h-3 rounded-full mr-2 ${
                        reportsFound.partnerReport
                          ? "bg-green-500"
                          : "bg-yellow-500"
                      }`}></div>
                    <span className="text-sm">
                      Отчет по партнерам:{" "}
                      {reportsFound.partnerReport ? "Найден" : "Не найден"}
                      {reportsFound.partnerReport &&
                        ` (${calculatedData.partnerTotalGas.toLocaleString()} м³)`}
                    </span>
                  </div>
                </div>
                {(!reportsFound.hoseReport || !reportsFound.partnerReport) && (
                  <p className="text-sm text-red-600 mt-2">
                    ❌ Для сохранения отчета должны быть найдены оба отчета!
                  </p>
                )}
              </div>

              {/* Поля ввода */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                {/* Показание счетчика */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Показание счетчика AutoPilotPro *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatNumber(formData.autopilotReading)}
                    onChange={(e) =>
                      handleInputChange("autopilotReading", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-sm sm:text-base"
                    disabled={loading || isSaving}
                    placeholder="0"
                    required
                  />
                </div>

                {/* Цена за м³ */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Цена за 1 м³ газа (₽) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatNumber(formData.gasPrice)}
                    onChange={(e) =>
                      handleInputChange("gasPrice", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-sm sm:text-base"
                    disabled={loading || isSaving}
                    placeholder="0"
                    required
                  />
                </div>

                {/* Терминал Хумо */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Терминал "Хумо" (₽) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatNumber(formData.humoTerminal)}
                    onChange={(e) =>
                      handleInputChange("humoTerminal", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-sm sm:text-base"
                    disabled={loading || isSaving}
                    placeholder="0"
                    required
                  />
                </div>

                {/* Терминал Узкард */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Терминал "Узкард" (₽) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatNumber(formData.uzcardTerminal)}
                    onChange={(e) =>
                      handleInputChange("uzcardTerminal", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-sm sm:text-base"
                    disabled={loading || isSaving}
                    placeholder="0"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Автоматически рассчитанные поля */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center sm:text-left">
                Данные из отчетов за {formData.date || "выбранную дату"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="text-center sm:text-left">
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Продано через шланги
                  </label>
                  <div
                    className={`text-lg font-semibold ${
                      reportsFound.hoseReport
                        ? "text-green-600"
                        : "text-gray-400"
                    }`}>
                    {calculatedData.hoseTotalGas.toLocaleString()} м³
                  </div>
                </div>
                <div className="text-center sm:text-left">
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Продано партнерам
                  </label>
                  <div
                    className={`text-lg font-semibold ${
                      reportsFound.partnerReport
                        ? "text-blue-600"
                        : "text-gray-400"
                    }`}>
                    {calculatedData.partnerTotalGas.toLocaleString()} м³
                  </div>
                </div>
                <div className="text-center sm:text-left">
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Сумма партнеров
                  </label>
                  <div
                    className={`text-lg font-semibold ${
                      reportsFound.partnerReport
                        ? "text-purple-600"
                        : "text-gray-400"
                    }`}>
                    {calculatedData.partnerTotalSum.toLocaleString("ru-RU", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    ₽
                  </div>
                </div>
                <div className="text-center sm:text-left">
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Наличные (расчет)
                  </label>
                  <div className="text-lg font-semibold text-orange-600">
                    {calculatedData.cashAmount.toLocaleString("ru-RU", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    ₽
                  </div>
                  <div className="text-xs text-gray-500">
                    автоматический расчет
                  </div>
                </div>
              </div>
            </div>

            {/* Сообщение о требованиях */}
            {!isFormValid() && formData.date && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold text-red-800 mb-2">
                  Необходимые условия для сохранения:
                </h3>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Все поля должны быть заполнены</li>
                  <li>• Должен быть найден отчет по шлангам</li>
                  <li>• Должен быть найден отчет по партнерам</li>
                </ul>
              </div>
            )}

            {/* Кнопки */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-6 border-t border-gray-200">
              <button
                onClick={onClose}
                disabled={loading || isSaving}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 order-2 sm:order-1">
                Отмена
              </button>
              <button
                onClick={confirmSave}
                disabled={!isFormValid() || loading || isSaving}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center order-1 sm:order-2">
                {loading || isSaving ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isSaving ? "Проверка..." : "Сохранение..."}
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Сохранить отчет
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно подтверждения */}
      {showConfirmation && <ConfirmationModal />}
    </>
  );
};

export default AddGeneralReportModal;
