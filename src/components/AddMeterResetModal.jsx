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
    lastReadingFromReport: "",
    lastReadingBeforeReset: "",
    newReadingAfterReset: "",
  });
  const [availableHoses, setAvailableHoses] = useState([]);
  const [lastReportData, setLastReportData] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSearching, setIsSearching] = useState(false);

  // Функция для определения квартала по дате
  const getQuarterFromDate = (dateString) => {
    if (!dateString) return null;

    try {
      const parts = dateString.split("-");
      if (parts.length !== 3) return null;

      const [day, month, year] = parts;
      const date = new Date(`${year}-${month}-${day}`);

      if (isNaN(date.getTime())) return null;

      const monthNum = date.getMonth() + 1;

      if (monthNum >= 1 && monthNum <= 3) return "I";
      if (monthNum >= 4 && monthNum <= 6) return "II";
      if (monthNum >= 7 && monthNum <= 9) return "III";
      return "IV";
    } catch (error) {
      console.error("Ошибка определения квартала:", error);
      return null;
    }
  };

  // Получение всех возможных вариантов названий коллекций
  const getPossibleCollectionNames = (dateString) => {
    if (!dateString) return [];

    const parts = dateString.split("-");
    if (parts.length !== 3) return [];

    const [day, month, year] = parts;
    const quarterRoman = getQuarterFromDate(dateString);
    if (!quarterRoman) return [];

    const quarterVariants = [];

    quarterVariants.push(quarterRoman);

    const romanToArabic = {
      I: "1",
      II: "2",
      III: "3",
      IV: "4",
    };
    if (romanToArabic[quarterRoman]) {
      quarterVariants.push(romanToArabic[quarterRoman]);
    }

    const collections = [];
    quarterVariants.forEach((q) => {
      collections.push(`unifiedDailyReports_${q}_${year}`);
      collections.push(`unifiedDailyReports${q}${year}`);
      collections.push(`unifiedDailyReports-${q}-${year}`);
    });

    return [...new Set(collections)];
  };

  // Проверка валидности даты
  const isValidDate = (dateString) => {
    if (!dateString) return false;

    const parts = dateString.split("-");
    if (parts.length !== 3) return false;

    const [day, month, year] = parts;

    if (!/^\d+$/.test(day) || !/^\d+$/.test(month) || !/^\d+$/.test(year)) {
      return false;
    }

    const dayNum = parseInt(day);
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (yearNum < 2000 || yearNum > 2100) return false;
    if (monthNum < 1 || monthNum > 12) return false;

    const daysInMonth = new Date(yearNum, monthNum - 1, 0).getDate();
    if (dayNum < 1 || dayNum > daysInMonth) return false;

    return true;
  };

  // Улучшенная функция поиска отчетов - БЕЗ ИНДЕКСА
  const loadLastReportData = async () => {
    if (
      !formData.stationId ||
      !formData.resetDate ||
      !isValidDate(formData.resetDate)
    ) {
      return;
    }

    setIsSearching(true);

    try {
      const possibleCollections = getPossibleCollectionNames(
        formData.resetDate,
      );

      console.log("Поиск в коллекциях:", possibleCollections);

      let foundReport = null;
      let foundCollection = null;

      // Пробуем найти отчет в каждой коллекции
      for (const collectionName of possibleCollections) {
        try {
          // Сначала проверяем, существует ли коллекция - БЕЗ orderBy
          const testQuery = query(
            collection(db, collectionName),
            where("stationId", "==", formData.stationId),
            limit(10), // Загружаем несколько документов
          );

          const testSnapshot = await getDocs(testQuery);

          if (!testSnapshot.empty) {
            // Находим самый свежий отчет вручную
            let latestReport = null;
            let latestDate = null;

            testSnapshot.forEach((doc) => {
              const data = doc.data();
              const reportDate = data.reportDate;
              if (reportDate) {
                if (!latestDate || reportDate > latestDate) {
                  latestDate = reportDate;
                  latestReport = data;
                }
              } else if (!latestReport) {
                // Если нет reportDate, берем первый попавшийся
                latestReport = data;
              }
            });

            if (latestReport) {
              foundReport = latestReport;
              foundCollection = collectionName;
              console.log("Найден отчет в коллекции:", collectionName);
              break;
            }
          }
        } catch (error) {
          console.log("Коллекция не доступна:", collectionName, error.message);
          continue;
        }
      }

      if (foundReport) {
        setLastReportData(foundReport);
        const hoses = foundReport.hoseData?.map((hose) => hose.hose) || [];
        setAvailableHoses(hoses);

        toast.success(`Хисобот маълумотлари юкланди (${foundCollection})`);
      } else {
        // Если не нашли в основных коллекциях, пробуем поискать во всех коллекциях
        await searchAllCollections();
      }
    } catch (error) {
      console.error("Ошибка загрузки отчетов:", error);
      setLastReportData(null);
      setAvailableHoses([]);
      toast.error("Хисоботларни юклашда хатолик");
    } finally {
      setIsSearching(false);
    }
  };

  // Поиск во всех коллекциях - БЕЗ ИНДЕКСА
  const searchAllCollections = async () => {
    try {
      // Получаем все коллекции
      const collections = await getDocs(collection(db, "unifiedDailyReports"));

      const reportCollections = collections.docs
        .map((doc) => doc.id)
        .filter((name) => name.startsWith("unifiedDailyReports"));

      console.log("Все коллекции отчетов:", reportCollections);

      let foundReport = null;

      for (const collectionName of reportCollections) {
        try {
          // Без orderBy, чтобы не требовать индекс
          const reportQuery = query(
            collection(db, collectionName),
            where("stationId", "==", formData.stationId),
            limit(10),
          );

          const snapshot = await getDocs(reportQuery);

          if (!snapshot.empty) {
            // Находим самый свежий отчет вручную
            let latestReport = null;
            let latestDate = null;

            snapshot.forEach((doc) => {
              const data = doc.data();
              const reportDate = data.reportDate;
              if (reportDate) {
                if (!latestDate || reportDate > latestDate) {
                  latestDate = reportDate;
                  latestReport = data;
                }
              } else if (!latestReport) {
                latestReport = data;
              }
            });

            if (latestReport) {
              foundReport = latestReport;
              console.log("Найден отчет в коллекции:", collectionName);
              break;
            }
          }
        } catch (error) {
          console.log("Ошибка в коллекции:", collectionName, error.message);
          continue;
        }
      }

      if (foundReport) {
        setLastReportData(foundReport);
        const hoses = foundReport.hoseData?.map((hose) => hose.hose) || [];
        setAvailableHoses(hoses);
        toast.success("Хисобот маълумотлари топилди");
      } else {
        setLastReportData(null);
        setAvailableHoses([]);
        toast.info("Станция учун хеч қандай хисобот топилмади");
      }
    } catch (error) {
      console.error("Ошибка поиска во всех коллекциях:", error);
      setLastReportData(null);
      setAvailableHoses([]);
    }
  };

  // Загрузка данных при изменении станции или даты
  useEffect(() => {
    if (
      formData.stationId &&
      formData.resetDate &&
      isValidDate(formData.resetDate)
    ) {
      loadLastReportData();
    } else {
      if (formData.hose) {
        setFormData((prev) => ({
          ...prev,
          hose: "",
          lastReadingFromReport: "",
          lastReadingBeforeReset: "",
        }));
      }
      setLastReportData(null);
      setAvailableHoses([]);
    }
  }, [formData.stationId, formData.resetDate]);

  // Автозаполнение последнего показания из отчета при выборе шланга
  useEffect(() => {
    if (formData.hose && lastReportData) {
      const hoseData = lastReportData.hoseData?.find(
        (h) => h.hose === formData.hose,
      );
      if (hoseData) {
        setFormData((prevData) => ({
          ...prevData,
          lastReadingFromReport: hoseData.current.toString(),
          lastReadingBeforeReset: hoseData.current.toString(),
        }));
      } else {
        setFormData((prevData) => ({
          ...prevData,
          lastReadingFromReport: "",
          lastReadingBeforeReset: "",
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
        where("resetDate", "==", resetDate),
        limit(20),
      );

      const snapshot = await getDocs(resetQuery);

      let existing = false;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.hose === hose) {
          existing = true;
        }
      });

      return existing;
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

    if (field === "resetDate" || field === "stationId") {
      setLastReportData(null);
      setAvailableHoses([]);
      if (formData.hose) {
        setFormData((prev) => ({
          ...prev,
          hose: "",
          lastReadingFromReport: "",
          lastReadingBeforeReset: "",
        }));
      }
    }

    setValidationErrors((prev) => ({
      ...prev,
      [field]: "",
    }));
  };

  // Обработка ввода даты
  const handleDateInput = (e) => {
    let value = e.target.value;

    value = value.replace(/\D/g, "");

    if (value.length > 8) value = value.substring(0, 8);

    if (value.length >= 2) {
      value = value.substring(0, 2) + "-" + value.substring(2);
    }
    if (value.length >= 5) {
      value = value.substring(0, 5) + "-" + value.substring(5);
    }

    handleInputChange("resetDate", value);
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.resetDate) errors.resetDate = "Мажбурий майдон";
    if (!isValidDate(formData.resetDate))
      errors.resetDate = "Сана нотўғри форматда";
    if (!formData.stationId) errors.stationId = "Мажбурий майдон";
    if (!formData.hose) errors.hose = "Мажбурий майдон";
    if (!formData.lastReadingBeforeReset)
      errors.lastReadingBeforeReset = "Мажбурий майдон";
    if (!formData.newReadingAfterReset)
      errors.newReadingAfterReset = "Мажбурий майдон";

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
        "Хисоботдаги курсаткичдан кам бўлмаслиги керак";
    }

    if (
      formData.newReadingAfterReset &&
      newReadingAfterReset >= lastReadingBeforeReset
    ) {
      errors.newReadingAfterReset =
        "Ноллашдан олдинги курсаткичдан кам бўлиши керак";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isSaveButtonDisabled = () => {
    if (
      !formData.resetDate ||
      !formData.stationId ||
      !formData.hose ||
      !formData.lastReadingBeforeReset ||
      !formData.newReadingAfterReset ||
      !isValidDate(formData.resetDate)
    ) {
      return true;
    }

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
      toast.error("Шаклдаги хатоларни тузатинг");
      return;
    }

    let hasExistingReset = false;
    try {
      hasExistingReset = await checkExistingReset(
        formData.stationId,
        formData.hose,
        formData.resetDate,
      );
    } catch (error) {
      console.warn("Проверка дубликатов не удалась, продолжаем:", error);
    }

    if (hasExistingReset) {
      toast.error("Танланган сана ва шланг учун ноллаш аллақачон мавжуд");
      return;
    }

    try {
      setLoading(true);

      const selectedStation = stations.find((s) => s.id === formData.stationId);

      const resetEventData = {
        resetDate: formData.resetDate,
        stationId: formData.stationId,
        stationName: selectedStation?.stationName || "Номаълум заправка",
        hose: formData.hose,
        lastReadingFromReport: parseFloat(formData.lastReadingFromReport) || 0,
        lastReadingBeforeReset:
          parseFloat(formData.lastReadingBeforeReset) || 0,
        newReadingAfterReset: parseFloat(formData.newReadingAfterReset) || 0,
        createdAt: new Date(),
        createdBy: auth?.currentUser?.email || "Номаълум",
        quarter: getQuarterFromDate(formData.resetDate) || "Unknown",
        year: formData.resetDate ? formData.resetDate.split("-")[2] : "Unknown",
      };

      await addDoc(collection(db, "meterResetEvents"), resetEventData);

      toast.success("Ноллаш муваффақиятли қўшилди");
      onSaved();
      handleClose();
    } catch (error) {
      console.error("Сохранение ошибка:", error);
      toast.error("Сақлашда хатолик: " + error.message);
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

  const getQuarterDisplayInfo = () => {
    if (!formData.resetDate || !isValidDate(formData.resetDate)) return null;

    const quarter = getQuarterFromDate(formData.resetDate);
    const possibleCollections = getPossibleCollectionNames(formData.resetDate);

    return {
      quarter,
      possibleCollections,
      displayText: quarter
        ? `${quarter}-чорак, ${formData.resetDate.split("-")[2]}`
        : "Номаълум",
    };
  };

  const quarterInfo = getQuarterDisplayInfo();

  if (!isOpen) return null;

  return (
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
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[95vh] overflow-hidden flex flex-col"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Заголовок */}
            <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <h3 className="text-xl font-semibold">Янги ноллашни қўшиш</h3>
              <p className="text-sm opacity-90 mt-1">
                Шланг курсаткичларини ноллаш
              </p>
            </div>

            {/* Форма */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-6">
              <div className="space-y-4">
                {/* Информация о квартале */}
                {quarterInfo && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-800">
                          Қуйидаги чоракда хисоботлар қидирилмоқда:
                        </p>
                        <p className="text-lg font-bold text-blue-900 mt-1">
                          {quarterInfo.displayText}
                        </p>
                      </div>
                      <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                        {quarterInfo.quarter}-чорак
                      </div>
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      Қидирилаётган коллекциялар:{" "}
                      {quarterInfo.possibleCollections.join(", ")}
                    </p>
                    {isSearching && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-xs text-blue-600">
                          Қидирилмоқда...
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Дата */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Нолланадиган сана *
                  </label>
                  <input
                    type="text"
                    value={formData.resetDate}
                    onChange={handleDateInput}
                    placeholder="ДД-ММ-ГГГГ"
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      validationErrors.resetDate
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    } ${
                      !isValidDate(formData.resetDate) && formData.resetDate
                        ? "border-yellow-500 bg-yellow-50"
                        : ""
                    }`}
                    required
                  />
                  {validationErrors.resetDate && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.resetDate}
                    </p>
                  )}
                  {!isValidDate(formData.resetDate) && formData.resetDate && (
                    <p className="text-yellow-500 text-xs mt-1">
                      Сана нотўғри форматда. Мисол: 31-12-2024
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Формат: ДД-ММ-ГГГГ (масалан: 13-07-2026)
                  </p>
                </div>

                {/* Станция */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Заправка *
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
                    required
                  >
                    <option value="">Заправкани танланг</option>
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
                    Шланг раками *
                  </label>
                  <select
                    value={formData.hose}
                    onChange={(e) => handleInputChange("hose", e.target.value)}
                    disabled={
                      !formData.stationId || !formData.resetDate || isSearching
                    }
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 ${
                      validationErrors.hose
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                    required
                  >
                    <option value="">Шлангни танланг</option>
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
                  {formData.stationId &&
                    formData.resetDate &&
                    availableHoses.length === 0 &&
                    !isSearching && (
                      <div className="mt-2">
                        <p className="text-amber-600 text-xs">
                          Хисобот топилмади. Маълумотларни қўлда киритинг.
                        </p>
                        <div className="mt-1">
                          <input
                            type="text"
                            value={formData.hose || ""}
                            onChange={(e) =>
                              handleInputChange("hose", e.target.value)
                            }
                            placeholder="Шланг номини киритинг (намуна: Шланг-1)"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  {isSearching && (
                    <p className="text-blue-600 text-xs mt-1">
                      Шланглар қидирилмоқда...
                    </p>
                  )}
                </div>

                {/* Последнее показание счетчика с отчета */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Охирги хисоботдаги курсаткич
                    {lastReportData && (
                      <span className="ml-2 text-xs text-green-600">
                        ✓ Топилди
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={formData.lastReadingFromReport}
                    readOnly
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-600"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {lastReportData
                      ? `Хисобот санаси: ${
                          lastReportData.reportDate || "Номаълум"
                        }`
                      : "Хисобот топилмаганда қўлда киритинг"}
                  </p>
                </div>

                {/* Последнее показание перед обнулением */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ноллашдан олдинги курсаткич *
                  </label>
                  <input
                    type="number"
                    value={formData.lastReadingBeforeReset}
                    onChange={(e) =>
                      handleInputChange(
                        "lastReadingBeforeReset",
                        e.target.value,
                      )
                    }
                    step="0.01"
                    min={formData.lastReadingFromReport || 0}
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      validationErrors.lastReadingBeforeReset
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Ноллашдан олдинги курсаткични киритинг"
                    required
                  />
                  {validationErrors.lastReadingBeforeReset && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.lastReadingBeforeReset}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.lastReadingFromReport
                      ? `Хисоботдаги курсаткичдан кам бўлмаслиги керак (${formData.lastReadingFromReport})`
                      : "Фақат сон киритинг"}
                  </p>
                </div>

                {/* Новое показание после обнуления */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ноллангандан кейинги курсаткич *
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
                    placeholder="Ноллангандан кейинги курсаткични киритинг"
                    required
                  />
                  {validationErrors.newReadingAfterReset && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.newReadingAfterReset}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.lastReadingBeforeReset
                      ? `Ноллашдан олдинги курсаткичдан кам бўлиши керак (${formData.lastReadingBeforeReset})`
                      : "Фақат сон киритинг"}
                  </p>
                </div>
              </div>
            </form>

            {/* Кнопки */}
            <div className="p-6 border-t bg-gray-50 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleClose}
                className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 flex-1"
              >
                Бекор қилиш
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || isSaveButtonDisabled() || isSearching}
                className={`px-5 py-2 rounded-xl font-semibold flex-1 ${
                  loading || isSaveButtonDisabled() || isSearching
                    ? "bg-gray-400 cursor-not-allowed text-gray-600"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {loading ? "Сақланишда..." : "Сақлаш"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddMeterResetModal;
