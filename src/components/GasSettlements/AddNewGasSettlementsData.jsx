import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGasSettlements } from "../../hooks/useGasSettlements";

const AddNewGasSettlementsData = ({ open, onClose }) => {
  const {
    stations,
    settlementsData,
    priceOfGas,
    addMultipleSettlementData,
    reloadData,
  } = useGasSettlements();
  const [formData, setFormData] = useState([]);
  const [period, setPeriod] = useState("");
  const [suggestedPeriod, setSuggestedPeriod] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState({});

  // Новые состояния для дней
  const [useCalculatedConsumption, setUseCalculatedConsumption] =
    useState(false);
  const [actualConsumptionDays, setActualConsumptionDays] = useState("");
  const [remainingDays, setRemainingDays] = useState("");

  // Функция для получения количества дней в месяце
  const getDaysInMonth = (yearMonth) => {
    if (!yearMonth) return 30; // По умолчанию 30 дней

    const [year, month] = yearMonth.split("-").map(Number);
    return new Date(year, month, 0).getDate();
  };

  // Функция для поиска цены по дате
  const findPriceForDate = (priceArray, targetDate) => {
    if (!priceArray || !Array.isArray(priceArray) || priceArray.length === 0) {
      console.log("Нет данных о ценах");
      return null;
    }

    const target = new Date(targetDate + "-01");
    console.log("Ищем цену для даты:", targetDate, "target:", target);

    const sortedPrices = [...priceArray].sort((a, b) => {
      return new Date(b.startDate + "-01") - new Date(a.startDate + "-01");
    });

    console.log("Отсортированные цены:", sortedPrices);

    for (const priceData of sortedPrices) {
      const startDate = new Date(priceData.startDate + "-01");

      if (target >= startDate) {
        if (priceData.endDate) {
          const endDate = new Date(priceData.endDate + "-01");
          if (target <= endDate) {
            console.log(
              "Найдена цена:",
              priceData.price,
              "с",
              priceData.startDate,
              "по",
              priceData.endDate,
            );
            return priceData.price;
          }
        } else {
          console.log(
            "Найдена бессрочная цена:",
            priceData.price,
            "с",
            priceData.startDate,
          );
          return priceData.price;
        }
      }
    }

    console.log("Цена не найдена для даты:", targetDate);
    return null;
  };

  // Получаем цену газа для выбранного периода
  const getCurrentPrice = () => {
    console.log("priceOfGas:", priceOfGas);
    console.log("period для поиска:", period);

    const price = findPriceForDate(priceOfGas, period);
    console.log("Найдена цена:", price);

    return price || 0;
  };

  // Расчет производных полей с учетом новых полей
  const calculateDerivedFields = (data) => {
    // Убираем пробелы и конвертируем в числа
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

    const price = getCurrentPrice();

    // Расчет суммы лимита
    const amountOfLimit = limit !== null ? limit * price : null;

    // Расчет общего газа в зависимости от режима
    let totalGas = null;
    let calculatedMonthlyConsumption = null;

    if (useCalculatedConsumption) {
      // Режим расчетного потребления
      if (
        actualConsumption !== null &&
        actualConsumptionDays &&
        remainingDays
      ) {
        const daysInMonth = getDaysInMonth(period);
        calculatedMonthlyConsumption =
          (actualConsumption / actualConsumptionDays) * daysInMonth;
        totalGas = calculatedMonthlyConsumption;
      }
    } else {
      // Обычный режим
      const gasSum = [gasByMeter, confError, lowPress, gasAct]
        .filter((val) => val !== null)
        .reduce((sum, val) => sum + val, 0);

      totalGas = gasSum || null;
    }

    // Расчет суммы газа
    const amountOfGas = totalGas !== null ? totalGas * price : null;

    console.log("calculateDerivedFields - Расчет:", {
      limit,
      price,
      amountOfLimit,
      totalGas,
      amountOfGas,
      calculatedMonthlyConsumption,
      actualConsumption,
    });

    return {
      totalGas,
      amountOfLimit,
      amountOfGas,
      price,
      calculatedMonthlyConsumption,
    };
  };

  useEffect(() => {
    if (stations.length > 0 && open) {
      // Определяем следующий период после последней записи
      let lastPeriod = null;
      if (settlementsData.length > 0) {
        const sortedData = [...settlementsData].sort(
          (a, b) => new Date(b.period) - new Date(a.period),
        );
        lastPeriod = new Date(sortedData[0].period);
        lastPeriod.setMonth(lastPeriod.getMonth() + 1);
      } else {
        lastPeriod = new Date();
      }

      const year = lastPeriod.getFullYear();
      const month = lastPeriod.getMonth() + 1;
      const suggested = `${year}-${month.toString().padStart(2, "0")}`;

      setSuggestedPeriod(suggested);
      setPeriod(suggested);

      // Сбросить состояние дней при открытии
      setUseCalculatedConsumption(false);
      setActualConsumptionDays("");
      setRemainingDays("");

      // Получаем цену для начального периода
      const initialPrice = getCurrentPrice();
      console.log("Начальная цена для периода", suggested, ":", initialPrice);

      // Инициализируем форму данными станций
      const initialData = stations.map((station, index) => ({
        stationId: station.id,
        stationName: station.name,
        landmark: station.landmark,
        index: index + 1,
        limit: "",
        amountOfLimit: null,
        gasByMeter: "",
        confError: "",
        lowPress: "",
        gasAct: "",
        totalGas: null,
        amountOfGas: null,
        payment: "",
        actualConsumption: "",
        calculatedMonthlyConsumption: null,
      }));

      setFormData(initialData);
      setErrors({});
      setSaveSuccess(false);
    }
  }, [stations, settlementsData, open, priceOfGas]);

  // Эффект для расчета оставшихся дней
  useEffect(() => {
    if (period && actualConsumptionDays !== "") {
      const daysInMonth = getDaysInMonth(period);
      const days = parseInt(actualConsumptionDays) || 0;
      const remaining = daysInMonth - days;
      setRemainingDays(remaining >= 0 ? remaining.toString() : "0");
    } else {
      setRemainingDays("");
    }
  }, [period, actualConsumptionDays]);

  const handleFieldChange = (index, field, value) => {
    const newFormData = [...formData];

    // Обновляем значение поля
    newFormData[index] = {
      ...newFormData[index],
      [field]: value,
    };

    // Пересчитываем производные поля
    const derivedFields = [
      "gasByMeter",
      "confError",
      "lowPress",
      "gasAct",
      "limit",
      "actualConsumption",
    ];

    if (derivedFields.includes(field)) {
      const derived = calculateDerivedFields(newFormData[index]);
      newFormData[index] = {
        ...newFormData[index],
        totalGas: derived.totalGas,
        amountOfLimit: derived.amountOfLimit,
        amountOfGas: derived.amountOfGas,
        calculatedMonthlyConsumption: derived.calculatedMonthlyConsumption,
      };
    }

    setFormData(newFormData);

    // Очищаем ошибки для этого поля
    if (errors[`${index}_${field}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`${index}_${field}`];
        return newErrors;
      });
    }
  };

  // Добавляем эффект для пересчета при изменении периода
  useEffect(() => {
    if (period && formData.length > 0) {
      const price = getCurrentPrice();
      console.log("Период изменился на:", period, "цена:", price);

      const newFormData = formData.map((data) => {
        const derived = calculateDerivedFields(data);
        return {
          ...data,
          amountOfLimit: derived.amountOfLimit,
          amountOfGas: derived.amountOfGas,
          calculatedMonthlyConsumption: derived.calculatedMonthlyConsumption,
        };
      });

      setFormData(newFormData);
    }
  }, [period, useCalculatedConsumption, actualConsumptionDays]);

  // Эффект для пересчета при изменении режима расчета
  useEffect(() => {
    if (formData.length > 0) {
      const newFormData = formData.map((data) => {
        const derived = calculateDerivedFields(data);
        return {
          ...data,
          totalGas: derived.totalGas,
          amountOfGas: derived.amountOfGas,
          calculatedMonthlyConsumption: derived.calculatedMonthlyConsumption,
        };
      });

      setFormData(newFormData);
    }
  }, [useCalculatedConsumption]);

  const validateForm = () => {
    const newErrors = {};

    if (!period) {
      newErrors.period = "Выберите период";
    }

    // Проверка дней потребления, если включен режим расчета
    if (useCalculatedConsumption) {
      if (!actualConsumptionDays || actualConsumptionDays === "") {
        newErrors.actualConsumptionDays = "Введите количество дней";
      } else {
        const days = parseInt(actualConsumptionDays);
        const daysInMonth = getDaysInMonth(period);
        if (days < 1 || days > daysInMonth) {
          newErrors.actualConsumptionDays = `Количество дней должно быть от 1 до ${daysInMonth}`;
        }
      }
    }

    formData.forEach((row, index) => {
      // Проверяем, что все поля являются числами (если не пустые)
      const fieldsToCheck = [
        "limit",
        "gasByMeter",
        "confError",
        "lowPress",
        "gasAct",
        "payment",
        "actualConsumption",
      ];

      fieldsToCheck.forEach((field) => {
        const value = row[field];
        if (value !== "") {
          const cleanedValue = value.replace(/[\s,]/g, "");
          if (cleanedValue !== "" && isNaN(parseFloat(cleanedValue))) {
            newErrors[`${index}_${field}`] = "Введите число";
          }
        }
      });
    });

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!period) {
      setErrors({ period: "Выберите период" });
      return;
    }

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);

    try {
      // Подготавливаем все данные для сохранения
      const dataToSave = formData.map((data) => {
        // Функция для очистки и преобразования значения
        const cleanValue = (val) => {
          if (val === "" || val === null || val === undefined) return null;
          const cleaned = String(val).replace(/[\s,]/g, "");
          const num = parseFloat(cleaned);
          return isNaN(num) ? null : num;
        };

        const derived = calculateDerivedFields(data);

        return {
          period,
          stationId: data.stationId,
          limit: cleanValue(data.limit),
          amountOfLimit: derived.amountOfLimit,
          totalGas: derived.totalGas,
          gasByMeter: useCalculatedConsumption
            ? null
            : cleanValue(data.gasByMeter),
          confError: useCalculatedConsumption
            ? null
            : cleanValue(data.confError),
          lowPress: useCalculatedConsumption ? null : cleanValue(data.lowPress),
          gasAct: useCalculatedConsumption ? null : cleanValue(data.gasAct),
          amountOfGas: derived.amountOfGas,
          payment: cleanValue(data.payment),
          actualConsumption: useCalculatedConsumption
            ? cleanValue(data.actualConsumption)
            : null,
          calculatedMonthlyConsumption: derived.calculatedMonthlyConsumption,
          useCalculatedConsumption: useCalculatedConsumption,
          actualConsumptionDays: useCalculatedConsumption
            ? parseInt(actualConsumptionDays)
            : null,
          createdAt: new Date().toISOString(),
        };
      });

      console.log("Данные для сохранения:", dataToSave);

      // Сохраняем все данные одним запросом
      const success = await addMultipleSettlementData(dataToSave);

      if (success) {
        setSaveSuccess(true);

        // Обновляем данные
        await reloadData();

        // Закрываем модальное окно через 2 секунды
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setErrors({ submit: "Ошибка при сохранении данных" });
      }
    } catch (error) {
      console.error("Ошибка сохранения:", error);
      setErrors({ submit: "Произошла ошибка при сохранении данных" });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "";
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "UZS",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return "";
    return new Intl.NumberFormat("ru-RU").format(num);
  };

  // Функция для форматирования ввода чисел с группировкой
  const formatInputNumber = (value, addGrouping = false) => {
    if (value === "" || value === null || value === undefined) return "";

    // Убираем все нецифровые символы, кроме точки и запятых
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(/,/g, ".");

    // Если это пустая строка после очистки, возвращаем пустую строку
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return cleaned;

    const num = parseFloat(cleaned);
    if (isNaN(num)) return value;

    if (addGrouping) {
      return new Intl.NumberFormat("ru-RU").format(num);
    }

    return num.toString();
  };

  // Функция для обработки ввода с группировкой
  const handleNumberInput = (index, field, value, addGrouping = false) => {
    const formattedValue = formatInputNumber(value, addGrouping);
    handleFieldChange(index, field, formattedValue);
  };

  if (!open) return null;

  const currentPrice = getCurrentPrice();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-8xl max-h-[90vh] overflow-hidden"
        >
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-white">
                Добавление новых данных
              </h3>
              <button
                onClick={onClose}
                className="text-white hover:bg-blue-800 p-2 rounded-full transition-colors"
                disabled={loading}
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

          <form
            onSubmit={handleSubmit}
            className="p-4 overflow-y-auto max-h-[70vh]"
          >
            {saveSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-green-500"
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
                  <p className="text-green-600 text-sm font-medium">
                    Данные успешно сохранены! Модальное окно закроется через 2
                    секунды...
                  </p>
                </div>
              </motion.div>
            )}

            {errors.submit && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-red-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-red-600 text-sm">{errors.submit}</p>
                </div>
              </motion.div>
            )}

            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Левая колонка - Период */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Период (год-месяц) *
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="month"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className={`p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.period ? "border-red-500" : "border-gray-300"
                      }`}
                      disabled={loading}
                    />
                    <div className="text-sm text-gray-600">
                      <div className="font-medium">Следующий период:</div>
                      <div className="text-blue-600">{suggestedPeriod}</div>
                      <div className="text-green-600 font-medium mt-1">
                        Цена газа: {currentPrice} сум/м³
                      </div>
                      {currentPrice === 0 && (
                        <div className="text-red-600 text-xs mt-1">
                          Внимание: цена для выбранного периода не найдена!
                        </div>
                      )}
                    </div>
                  </div>
                  {errors.period && (
                    <p className="mt-1 text-sm text-red-600">{errors.period}</p>
                  )}
                </div>

                {/* Правая колонка - Настройки дней */}
                <div>
                  <div className="mb-4">
                    <div className="grid grid-cols-3 gap-4">
                      <label className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          checked={useCalculatedConsumption}
                          onChange={(e) =>
                            setUseCalculatedConsumption(e.target.checked)
                          }
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          disabled={loading}
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Использовать расчетное потребление
                        </span>
                      </label>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Кол-во дней потр-ния газа
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={period ? getDaysInMonth(period) : 31}
                          value={actualConsumptionDays}
                          onChange={(e) =>
                            setActualConsumptionDays(e.target.value)
                          }
                          className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            errors.actualConsumptionDays
                              ? "border-red-500"
                              : "border-gray-300"
                          } ${!useCalculatedConsumption ? "bg-gray-100 cursor-not-allowed" : ""}`}
                          disabled={loading || !useCalculatedConsumption}
                        />
                        {errors.actualConsumptionDays && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.actualConsumptionDays}
                          </p>
                        )}
                      </div>

                      <div>
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
            </div>

            <div className="overflow-x-auto bg-white rounded-xl shadow-inner border text-xs mb-4">
              <table className="w-full border-collapse">
                <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <tr className="text-xs">
                    <th className="p-2 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                      №
                    </th>
                    <th className="p-2 text-left font-semibold text-gray-700 border-b whitespace-nowrap min-w-[120px]">
                      Наименование заправки
                    </th>
                    <th className="p-2 text-left font-semibold text-gray-700 border-b whitespace-nowrap min-w-[80px]">
                      Ориентир
                    </th>
                    <th className="p-2 text-left font-semibold text-gray-700 border-b whitespace-nowrap min-w-[80px]">
                      Лимит
                    </th>
                    <th className="p-2 text-left font-semibold text-gray-700 border-b whitespace-nowrap min-w-[90px]">
                      Сумма <br />
                      лимита <br />
                      газа
                    </th>

                    {/* Новые столбцы */}
                    <th className="p-2 text-left font-semibold text-gray-700 border-b whitespace-nowrap min-w-[100px]">
                      Факт <br />
                      пот-ние <br />
                      газа
                    </th>
                    <th className="p-2 text-left font-semibold text-gray-700 border-b whitespace-nowrap min-w-[110px]">
                      Ожидаемый
                    </th>

                    <th className="p-2 text-left font-semibold text-gray-700 border-b whitespace-nowrap min-w-[70px]">
                      Всего газ
                    </th>
                    <th className="p-2 text-left font-semibold text-gray-700 border-b whitespace-nowrap min-w-[80px]">
                      Газ по <br />
                      счетчику
                    </th>
                    <th className="p-2 text-left font-semibold text-gray-700 border-b whitespace-nowrap min-w-[80px]">
                      Ошибка <br /> конфигу-
                      <br />
                      рации
                    </th>
                    <th className="p-2 text-left font-semibold text-gray-700 border-b whitespace-nowrap min-w-[90px]">
                      Низкий <br /> перепад
                      <br /> давления
                    </th>
                    <th className="p-2 text-left font-semibold text-gray-700 border-b whitespace-nowrap min-w-[60px]">
                      По акту
                    </th>
                    <th className="p-2 text-left font-semibold text-gray-700 border-b whitespace-nowrap min-w-[90px]">
                      Сумма
                    </th>
                    <th className="p-2 text-left font-semibold text-gray-700 border-b whitespace-nowrap min-w-[100px]">
                      Оплата
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {formData.map((row, index) => {
                    const derived = calculateDerivedFields(row);

                    return (
                      <motion.tr
                        key={row.stationId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className={`border-t hover:bg-blue-50 transition-colors ${
                          index % 2 === 0 ? "bg-gray-50" : "bg-white"
                        }`}
                      >
                        <td className="p-2 font-medium text-center">
                          {row.index}
                        </td>
                        <td className="p-2 font-medium text-blue-600 text-xs whitespace-nowrap">
                          {row.stationName}
                        </td>
                        <td className="p-2 text-gray-600 text-xs whitespace-nowrap">
                          {row.landmark}
                        </td>

                        {/* Лимит */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.limit}
                            onChange={(e) =>
                              handleNumberInput(
                                index,
                                "limit",
                                e.target.value,
                                true,
                              )
                            }
                            className={`w-full p-1 border rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                              errors[`${index}_limit`]
                                ? "border-red-500"
                                : "border-gray-300"
                            }`}
                            placeholder=""
                            disabled={loading}
                          />
                          {errors[`${index}_limit`] && (
                            <p className="mt-1 text-xs text-red-600">
                              {errors[`${index}_limit`]}
                            </p>
                          )}
                        </td>

                        {/* Сумма лимита газа */}
                        <td className="p-1">
                          <div className="font-mono text-green-600 font-medium text-xs">
                            {formatCurrency(derived.amountOfLimit)}
                          </div>
                          {row.limit && row.limit !== "" && (
                            <div className="text-[10px] text-gray-500 leading-tight">
                              {parseFloat(row.limit.replace(/[\s,]/g, "") || 0)}{" "}
                              × {derived.price} сум/м³
                            </div>
                          )}
                        </td>

                        {/* Фактическое потребление газа */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.actualConsumption}
                            onChange={(e) =>
                              handleNumberInput(
                                index,
                                "actualConsumption",
                                e.target.value,
                                true,
                              )
                            }
                            className={`w-full p-1 border rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                              errors[`${index}_actualConsumption`]
                                ? "border-red-500"
                                : "border-gray-300"
                            } ${!useCalculatedConsumption ? "bg-gray-100 cursor-not-allowed" : ""}`}
                            placeholder=""
                            disabled={loading || !useCalculatedConsumption}
                          />
                          {errors[`${index}_actualConsumption`] && (
                            <p className="mt-1 text-xs text-red-600">
                              {errors[`${index}_actualConsumption`]}
                            </p>
                          )}
                        </td>

                        {/* Расчетное потребление газа в месяц */}
                        <td className="p-1">
                          <div className="font-mono font-medium text-xs text-purple-600">
                            {formatNumber(derived.calculatedMonthlyConsumption)}
                          </div>
                          {row.actualConsumption &&
                            row.actualConsumption !== "" &&
                            actualConsumptionDays &&
                            period && (
                              <div className="text-[10px] text-gray-500 leading-tight">
                                {parseFloat(
                                  row.actualConsumption.replace(/[\s,]/g, "") ||
                                    0,
                                )}{" "}
                                ÷ {actualConsumptionDays} ×{" "}
                                {getDaysInMonth(period)}
                              </div>
                            )}
                        </td>

                        {/* Всего газ */}
                        <td className="p-1">
                          <div className="font-mono font-medium text-xs">
                            {formatNumber(derived.totalGas)}
                          </div>
                          {!useCalculatedConsumption && (
                            <div className="text-[10px] text-gray-500 leading-tight">
                              ={" "}
                              {row.gasByMeter && row.gasByMeter !== ""
                                ? parseFloat(
                                    row.gasByMeter.replace(/[\s,]/g, "") || 0,
                                  )
                                : 0}{" "}
                              +
                              {row.confError && row.confError !== ""
                                ? parseFloat(
                                    row.confError.replace(/[\s,]/g, "") || 0,
                                  )
                                : 0}{" "}
                              +
                              {row.lowPress && row.lowPress !== ""
                                ? parseFloat(
                                    row.lowPress.replace(/[\s,]/g, "") || 0,
                                  )
                                : 0}{" "}
                              +
                              {row.gasAct && row.gasAct !== ""
                                ? parseFloat(
                                    row.gasAct.replace(/[\s,]/g, "") || 0,
                                  )
                                : 0}
                            </div>
                          )}
                        </td>

                        {/* Газ по счетчику */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.gasByMeter}
                            onChange={(e) =>
                              handleNumberInput(
                                index,
                                "gasByMeter",
                                e.target.value,
                                true,
                              )
                            }
                            className={`w-full p-1 border rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                              errors[`${index}_gasByMeter`]
                                ? "border-red-500"
                                : "border-gray-300"
                            } ${useCalculatedConsumption ? "bg-gray-100 cursor-not-allowed" : ""}`}
                            placeholder=""
                            disabled={loading || useCalculatedConsumption}
                          />
                          {errors[`${index}_gasByMeter`] && (
                            <p className="mt-1 text-xs text-red-600">
                              {errors[`${index}_gasByMeter`]}
                            </p>
                          )}
                        </td>

                        {/* Ошибка конфигурации */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.confError}
                            onChange={(e) =>
                              handleNumberInput(
                                index,
                                "confError",
                                e.target.value,
                                true,
                              )
                            }
                            className={`w-full p-1 border rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                              errors[`${index}_confError`]
                                ? "border-red-500"
                                : "border-gray-300"
                            } ${useCalculatedConsumption ? "bg-gray-100 cursor-not-allowed" : ""}`}
                            placeholder=""
                            disabled={loading || useCalculatedConsumption}
                          />
                          {errors[`${index}_confError`] && (
                            <p className="mt-1 text-xs text-red-600">
                              {errors[`${index}_confError`]}
                            </p>
                          )}
                        </td>

                        {/* Низкий перепад давления */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.lowPress}
                            onChange={(e) =>
                              handleNumberInput(
                                index,
                                "lowPress",
                                e.target.value,
                                true,
                              )
                            }
                            className={`w-full p-1 border rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                              errors[`${index}_lowPress`]
                                ? "border-red-500"
                                : "border-gray-300"
                            } ${useCalculatedConsumption ? "bg-gray-100 cursor-not-allowed" : ""}`}
                            placeholder=""
                            disabled={loading || useCalculatedConsumption}
                          />
                          {errors[`${index}_lowPress`] && (
                            <p className="mt-1 text-xs text-red-600">
                              {errors[`${index}_lowPress`]}
                            </p>
                          )}
                        </td>

                        {/* По акту */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.gasAct}
                            onChange={(e) =>
                              handleNumberInput(
                                index,
                                "gasAct",
                                e.target.value,
                                true,
                              )
                            }
                            className={`w-full p-1 border rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                              errors[`${index}_gasAct`]
                                ? "border-red-500"
                                : "border-gray-300"
                            } ${useCalculatedConsumption ? "bg-gray-100 cursor-not-allowed" : ""}`}
                            placeholder=""
                            disabled={loading || useCalculatedConsumption}
                          />
                          {errors[`${index}_gasAct`] && (
                            <p className="mt-1 text-xs text-red-600">
                              {errors[`${index}_gasAct`]}
                            </p>
                          )}
                        </td>

                        {/* Сумма */}
                        <td className="p-1">
                          <div className="font-mono text-blue-600 font-semibold text-xs">
                            {formatCurrency(derived.amountOfGas)}
                          </div>
                          {derived.totalGas !== null && (
                            <div className="text-[10px] text-gray-500 leading-tight">
                              {formatNumber(derived.totalGas)} × {derived.price}{" "}
                              сум/м³
                            </div>
                          )}
                        </td>

                        {/* Оплата */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.payment}
                            onChange={(e) =>
                              handleNumberInput(
                                index,
                                "payment",
                                e.target.value,
                                true,
                              )
                            }
                            className={`w-full p-1 border rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-w-[90px] ${
                              errors[`${index}_payment`]
                                ? "border-red-500"
                                : "border-gray-300"
                            }`}
                            placeholder=""
                            disabled={loading}
                          />
                          {errors[`${index}_payment`] && (
                            <p className="mt-1 text-xs text-red-600">
                              {errors[`${index}_payment`]}
                            </p>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-4 pt-6 mt-6 border-t">
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm"
                disabled={loading}
              >
                Отмена
              </motion.button>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                disabled={loading || saveSuccess}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white"></div>
                    Сохранение...
                  </div>
                ) : saveSuccess ? (
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-3 h-3 text-white"
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
                    Сохранено
                  </div>
                ) : (
                  "Сохранить данные"
                )}
              </motion.button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AddNewGasSettlementsData;
