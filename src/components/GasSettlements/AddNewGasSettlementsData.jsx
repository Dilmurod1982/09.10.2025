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

  const [useCalculatedConsumption, setUseCalculatedConsumption] =
    useState(false);
  const [actualConsumptionDays, setActualConsumptionDays] = useState("");
  const [remainingDays, setRemainingDays] = useState("");

  const getDaysInMonth = (yearMonth) => {
    if (!yearMonth) return 30;
    const [year, month] = yearMonth.split("-").map(Number);
    return new Date(year, month, 0).getDate();
  };

  const findPriceForDate = (priceArray, targetDate) => {
    if (!priceArray || !Array.isArray(priceArray) || priceArray.length === 0) {
      return null;
    }
    const target = new Date(targetDate + "-01");
    const sortedPrices = [...priceArray].sort(
      (a, b) => new Date(b.startDate + "-01") - new Date(a.startDate + "-01")
    );
    for (const priceData of sortedPrices) {
      const startDate = new Date(priceData.startDate + "-01");
      if (target >= startDate) {
        if (priceData.endDate) {
          const endDate = new Date(priceData.endDate + "-01");
          if (target <= endDate) return priceData.price;
        } else {
          return priceData.price;
        }
      }
    }
    return null;
  };

  const getCurrentPrice = () => {
    const price = findPriceForDate(priceOfGas, period);
    return price || 0;
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

  // 🔥 Округление по правилам: 38.48659 → 38, 38.5948 → 39
  const roundHalfUp = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 0;
    return Math.round(value);
  };

  const calculateDerivedFields = (data) => {
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

    const price = getCurrentPrice();

    const amountOfLimit = limit !== null ? limit * price : null;

    // 🔥 Сумма трёх полей и округление
    const confLowHighSum =
      (confError !== null ? confError : 0) +
      (lowPress !== null ? lowPress : 0) +
      (highLimit !== null ? highLimit : 0);
    const roundedConfLowHigh = roundHalfUp(confLowHighSum);

    let totalGas = null;
    let calculatedMonthlyConsumption = null;

    if (useCalculatedConsumption) {
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
      // Всего газа = по счётчику + (округлённая сумма ошибка+низкий+верхний) + акт
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
    if (useCalculatedConsumption) {
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

  useEffect(() => {
    if (stations.length > 0 && open) {
      let lastPeriod = null;
      if (settlementsData.length > 0) {
        const sortedData = [...settlementsData].sort(
          (a, b) => new Date(b.period) - new Date(a.period)
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

      setUseCalculatedConsumption(false);
      setActualConsumptionDays("");
      setRemainingDays("");

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
        highLimit: "",
        gasAct: "",
        gasActAmount: "",
        actNote: "",
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

    newFormData[index] = {
      ...newFormData[index],
      [field]: value,
    };

    const derivedFields = [
      "gasByMeter",
      "confError",
      "lowPress",
      "highLimit",
      "gasAct",
      "gasActAmount",
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

    if (errors[`${index}_${field}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`${index}_${field}`];
        return newErrors;
      });
    }
  };

  useEffect(() => {
    if (period && formData.length > 0) {
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
      const fieldsToCheck = [
        "limit",
        "gasByMeter",
        "confError",
        "lowPress",
        "highLimit",
        "gasAct",
        "gasActAmount",
        "payment",
        "actualConsumption",
      ];

      fieldsToCheck.forEach((field) => {
        const value = row[field];
        if (value !== "" && value !== null && value !== undefined) {
          const cleanedValue = String(value).replace(/[\s,]/g, "");
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
      const dataToSave = formData.map((data) => {
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
          highLimit: useCalculatedConsumption
            ? null
            : cleanValue(data.highLimit),
          gasAct: useCalculatedConsumption ? null : cleanValue(data.gasAct),
          gasActAmount: useCalculatedConsumption
            ? null
            : cleanValue(data.gasActAmount),
          actNote:
            !useCalculatedConsumption &&
            (data.gasAct || data.gasActAmount) &&
            data.actNote
              ? data.actNote
              : null,
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

      const success = await addMultipleSettlementData(dataToSave);

      if (success) {
        setSaveSuccess(true);
        await reloadData();
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return "";
    return new Intl.NumberFormat("ru-RU").format(num);
  };

  const formatInputNumber = (
    value,
    addGrouping = false,
    allowNegative = false,
    maxDecimals = 5
  ) => {
    if (value === "" || value === null || value === undefined) return "";

    let cleaned = String(value)
      .replace(/[^\d.,-]/g, "")
      .replace(/,/g, ".");

    if (allowNegative) {
      const hasMinus = cleaned.startsWith("-");
      cleaned = cleaned.replace(/-/g, "");
      cleaned = (hasMinus ? "-" : "") + cleaned;
    } else {
      cleaned = cleaned.replace(/-/g, "");
    }

    const firstDot = cleaned.indexOf(".");
    if (firstDot !== -1) {
      cleaned =
        cleaned.substring(0, firstDot + 1) +
        cleaned.substring(firstDot + 1).replace(/\./g, "");
    }

    if (
      cleaned === "" ||
      cleaned === "-" ||
      cleaned === "." ||
      cleaned === "-."
    )
      return cleaned;

    const dotIdx = cleaned.indexOf(".");
    if (dotIdx !== -1) {
      const intPart = cleaned.substring(0, dotIdx);
      const fracPart = cleaned.substring(dotIdx + 1).substring(0, maxDecimals);
      cleaned = `${intPart}.${fracPart}`;
    }

    const num = parseFloat(cleaned);
    if (isNaN(num)) return value;

    if (addGrouping) {
      const isNeg = cleaned.startsWith("-");
      const sign = isNeg ? "-" : "";
      const absCleaned = isNeg ? cleaned.substring(1) : cleaned;
      const parts = absCleaned.split(".");
      const intFormatted = new Intl.NumberFormat("ru-RU").format(
        parseInt(parts[0] || "0", 10)
      );
      return parts.length > 1
        ? `${sign}${intFormatted}.${parts[1].substring(0, maxDecimals)}`
        : `${sign}${intFormatted}`;
    }

    return cleaned;
  };

  const handleNumberInput = (index, field, value, addGrouping = false) => {
    const formattedValue = formatInputNumber(value, addGrouping, false, 5);
    handleFieldChange(index, field, formattedValue);
  };

  const handleSignedNumberInput = (
    index,
    field,
    value,
    addGrouping = false
  ) => {
    const formattedValue = formatInputNumber(value, addGrouping, true, 5);
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
                className="text-white hover:bg-blue-800 p-2 rounded-full"
                disabled={loading}
              >
                ✕
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-4 overflow-y-auto max-h-[70vh]"
          >
            {saveSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-green-600 text-sm font-medium">
                  ✓ Данные успешно сохранены! Окно закроется через 2 секунды...
                </p>
              </div>
            )}

            {errors.submit && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm">{errors.submit}</p>
              </div>
            )}

            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Период (год-месяц) *
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="month"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className={`p-3 border rounded-xl ${
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
                    </div>
                  </div>
                </div>

                <div>
                  <div className="grid grid-cols-3 gap-4">
                    <label className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        checked={useCalculatedConsumption}
                        onChange={(e) =>
                          setUseCalculatedConsumption(e.target.checked)
                        }
                        className="w-4 h-4"
                        disabled={loading}
                      />
                      <span className="text-sm font-medium">
                        Расчетное потребление
                      </span>
                    </label>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Кол-во дней
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={period ? getDaysInMonth(period) : 31}
                        value={actualConsumptionDays}
                        onChange={(e) =>
                          setActualConsumptionDays(e.target.value)
                        }
                        className="w-full p-2 border rounded-lg"
                        disabled={loading || !useCalculatedConsumption}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Оставшиеся дни
                      </label>
                      <input
                        type="text"
                        value={remainingDays}
                        className="w-full p-2 border rounded-lg bg-gray-50"
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-xl shadow-inner border text-xs mb-4">
              <table className="w-full border-collapse">
                <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <tr className="text-xs">
                    <th className="p-2 text-left font-semibold">№</th>
                    <th className="p-2 text-left font-semibold min-w-[120px]">
                      Наименование
                    </th>
                    <th className="p-2 text-left font-semibold min-w-[80px]">
                      Ориентир
                    </th>
                    <th className="p-2 text-left font-semibold min-w-[80px]">
                      Лимит
                    </th>
                    <th className="p-2 text-left font-semibold min-w-[90px]">
                      Сумма лимита
                    </th>
                    <th className="p-2 text-left font-semibold min-w-[100px]">
                      Факт. потр.
                    </th>
                    <th className="p-2 text-left font-semibold min-w-[110px]">
                      Ожидаемый
                    </th>
                    <th className="p-2 text-left font-semibold min-w-[80px]">
                      Всего газ
                    </th>
                    <th className="p-2 text-left font-semibold min-w-[80px]">
                      По счётчику
                    </th>
                    <th className="p-2 text-left font-semibold min-w-[80px]">
                      Ошибка конф.
                    </th>
                    <th className="p-2 text-left font-semibold min-w-[90px]">
                      Низкий предел
                    </th>
                    <th className="p-2 text-left font-semibold min-w-[90px]">
                      Верхний предел
                    </th>
                    <th className="p-2 text-left font-semibold min-w-[70px]">
                      По акту (м³)
                    </th>
                    <th className="p-2 text-left font-semibold min-w-[100px]">
                      Сумма акта
                    </th>
                    <th className="p-2 text-left font-semibold min-w-[80px]">
                      Цена акта
                    </th>
                    <th className="p-2 text-left font-semibold min-w-[90px]">
                      Сумма газа
                    </th>
                    <th className="p-2 text-left font-semibold min-w-[100px]">
                      Оплата
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {formData.map((row, index) => {
                    const derived = calculateDerivedFields(row);
                    const actPrice = getActPrice(row);
                    const showActNote = !useCalculatedConsumption;

                    return (
                      <React.Fragment key={row.stationId}>
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className={`border-t hover:bg-blue-50 ${
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

                          <td className="p-1">
                            <input
                              type="text"
                              value={row.limit}
                              onChange={(e) =>
                                handleNumberInput(
                                  index,
                                  "limit",
                                  e.target.value,
                                  true
                                )
                              }
                              className={`w-full p-1 border rounded text-xs ${
                                errors[`${index}_limit`]
                                  ? "border-red-500"
                                  : "border-gray-300"
                              }`}
                              disabled={loading}
                            />
                          </td>

                          <td className="p-1">
                            <div className="font-mono text-green-600 text-xs">
                              {formatCurrency(derived.amountOfLimit)}
                            </div>
                          </td>

                          <td className="p-1">
                            <input
                              type="text"
                              value={row.actualConsumption}
                              onChange={(e) =>
                                handleNumberInput(
                                  index,
                                  "actualConsumption",
                                  e.target.value,
                                  true
                                )
                              }
                              className={`w-full p-1 border rounded text-xs ${
                                !useCalculatedConsumption
                                  ? "bg-gray-100 cursor-not-allowed"
                                  : ""
                              }`}
                              disabled={loading || !useCalculatedConsumption}
                            />
                          </td>

                          <td className="p-1">
                            <div className="font-mono text-xs text-purple-600">
                              {formatNumber(
                                derived.calculatedMonthlyConsumption
                              )}
                            </div>
                          </td>

                          <td className="p-1">
                            <div className="font-mono text-xs">
                              {formatNumber(derived.totalGas)}
                            </div>
                            {!useCalculatedConsumption && (
                              <div className="text-[10px] text-gray-500">
                                = счётч. + округл(ошиб+низ+верх) + акт
                              </div>
                            )}
                          </td>

                          <td className="p-1">
                            <input
                              type="text"
                              value={row.gasByMeter}
                              onChange={(e) =>
                                handleNumberInput(
                                  index,
                                  "gasByMeter",
                                  e.target.value,
                                  true
                                )
                              }
                              className={`w-full p-1 border rounded text-xs ${
                                useCalculatedConsumption
                                  ? "bg-gray-100 cursor-not-allowed"
                                  : ""
                              }`}
                              disabled={loading || useCalculatedConsumption}
                            />
                          </td>

                          <td className="p-1">
                            <input
                              type="text"
                              value={row.confError}
                              onChange={(e) =>
                                handleSignedNumberInput(
                                  index,
                                  "confError",
                                  e.target.value,
                                  true
                                )
                              }
                              className={`w-full p-1 border rounded text-xs ${
                                useCalculatedConsumption
                                  ? "bg-gray-100 cursor-not-allowed"
                                  : ""
                              }`}
                              placeholder="0.00000"
                              disabled={loading || useCalculatedConsumption}
                            />
                          </td>

                          <td className="p-1">
                            <input
                              type="text"
                              value={row.lowPress}
                              onChange={(e) =>
                                handleNumberInput(
                                  index,
                                  "lowPress",
                                  e.target.value,
                                  true
                                )
                              }
                              className={`w-full p-1 border rounded text-xs ${
                                useCalculatedConsumption
                                  ? "bg-gray-100 cursor-not-allowed"
                                  : ""
                              }`}
                              disabled={loading || useCalculatedConsumption}
                            />
                          </td>

                          <td className="p-1">
                            <input
                              type="text"
                              value={row.highLimit}
                              onChange={(e) =>
                                handleNumberInput(
                                  index,
                                  "highLimit",
                                  e.target.value,
                                  true
                                )
                              }
                              className={`w-full p-1 border rounded text-xs ${
                                useCalculatedConsumption
                                  ? "bg-gray-100 cursor-not-allowed"
                                  : ""
                              }`}
                              disabled={loading || useCalculatedConsumption}
                            />
                          </td>

                          <td className="p-1">
                            <input
                              type="text"
                              value={row.gasAct}
                              onChange={(e) =>
                                handleSignedNumberInput(
                                  index,
                                  "gasAct",
                                  e.target.value,
                                  true
                                )
                              }
                              className={`w-full p-1 border rounded text-xs ${
                                useCalculatedConsumption
                                  ? "bg-gray-100 cursor-not-allowed"
                                  : ""
                              }`}
                              placeholder="0.00000"
                              disabled={loading || useCalculatedConsumption}
                            />
                          </td>

                          <td className="p-1">
                            <input
                              type="text"
                              value={row.gasActAmount}
                              onChange={(e) =>
                                handleSignedNumberInput(
                                  index,
                                  "gasActAmount",
                                  e.target.value,
                                  true
                                )
                              }
                              className={`w-full p-1 border rounded text-xs bg-orange-50 ${
                                useCalculatedConsumption
                                  ? "bg-gray-100 cursor-not-allowed"
                                  : ""
                              }`}
                              placeholder="0.00000"
                              disabled={loading || useCalculatedConsumption}
                            />
                          </td>

                          <td className="p-1">
                            <div className="font-mono text-orange-600 text-xs">
                              {actPrice !== 0
                                ? formatNumber(Math.round(actPrice))
                                : "-"}
                            </div>
                          </td>

                          <td className="p-1">
                            <div className="font-mono text-blue-600 font-semibold text-xs">
                              {formatCurrency(derived.amountOfGas)}
                            </div>
                          </td>

                          <td className="p-1">
                            <input
                              type="text"
                              value={row.payment}
                              onChange={(e) =>
                                handleNumberInput(
                                  index,
                                  "payment",
                                  e.target.value,
                                  true
                                )
                              }
                              className="w-full p-1 border rounded text-xs"
                              disabled={loading}
                            />
                          </td>
                        </motion.tr>

                        {showActNote &&
                          (row.gasAct || row.gasActAmount) &&
                          (parseFloat(
                            String(row.gasAct || "").replace(/[\s,]/g, "")
                          ) !== 0 ||
                            parseFloat(
                              String(row.gasActAmount || "").replace(
                                /[\s,]/g,
                                ""
                              )
                            ) !== 0) && (
                            <tr
                              className={
                                index % 2 === 0 ? "bg-gray-50" : "bg-white"
                              }
                            >
                              <td
                                colSpan={17}
                                className="px-4 py-2 border-t border-orange-200"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-orange-700">
                                    📝 Примечание к акту для «{row.stationName}
                                    »:
                                  </span>
                                  <input
                                    type="text"
                                    value={row.actNote || ""}
                                    onChange={(e) =>
                                      handleFieldChange(
                                        index,
                                        "actNote",
                                        e.target.value
                                      )
                                    }
                                    className="flex-1 px-3 py-1.5 border border-orange-300 rounded-lg text-xs bg-orange-50"
                                    placeholder="Причина, номер акта, описание..."
                                    disabled={loading}
                                  />
                                </div>
                              </td>
                            </tr>
                          )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-4 pt-6 mt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border rounded-xl text-sm"
                disabled={loading}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm disabled:opacity-50"
                disabled={loading || saveSuccess}
              >
                {loading ? "Сохранение..." : "Сохранить данные"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AddNewGasSettlementsData;
