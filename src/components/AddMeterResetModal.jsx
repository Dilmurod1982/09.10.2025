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

  // Функция для определения квартала по дате
  const getQuarterFromDate = (dateString) => {
    if (!dateString) return null;

    try {
      // Преобразуем DD-MM-YYYY в Date
      const parts = dateString.split("-");
      if (parts.length !== 3) return null;

      const [day, month, year] = parts;
      const date = new Date(`${year}-${month}-${day}`);

      if (isNaN(date.getTime())) return null;

      const monthNum = date.getMonth() + 1; // 1-12
      const yearNum = date.getFullYear();

      if (monthNum >= 1 && monthNum <= 3) return `I`;
      if (monthNum >= 4 && monthNum <= 6) return `II`;
      if (monthNum >= 7 && monthNum <= 9) return `III`;
      return `IV`;
    } catch (error) {
      console.error("Ошибка определения квартала:", error);
      return null;
    }
  };

  // Функция для получения имени коллекции по дате
  const getCollectionName = (dateString) => {
    if (!dateString) return null;

    const quarter = getQuarterFromDate(dateString);
    if (!quarter) return null;

    const parts = dateString.split("-");
    if (parts.length !== 3) return null;

    const [day, month, year] = parts;
    return `unifiedDailyReports_${quarter}_${year}`;
  };

  // Упрощенная загрузка данных
  const loadLastReportData = async () => {
    if (!formData.stationId || !formData.resetDate) return;

    try {
      const collectionName = getCollectionName(formData.resetDate);

      if (!collectionName) {
        // console.log(
        //   "Не удалось определить коллекцию для даты:",
        //   formData.resetDate
        // );
        return;
      }

      // console.log("Ищем отчеты в коллекции:", collectionName);

      // Проверяем существование коллекции
      try {
        const allReportsQuery = query(
          collection(db, collectionName),
          where("stationId", "==", formData.stationId),
          orderBy("reportDate", "desc"),
          limit(10)
        );

        const snapshot = await getDocs(allReportsQuery);

        if (!snapshot.empty) {
          // Берем самый свежий отчет
          const latestReport = snapshot.docs[0].data();
          setLastReportData(latestReport);

          // Создаем список доступных шлангов
          const hoses = latestReport.hoseData?.map((hose) => hose.hose) || [];
          setAvailableHoses(hoses);

          // console.log(
          //   "Найден отчет в коллекции:",
          //   collectionName,
          //   "шланги:",
          //   hoses
          // );
          toast.success("Хисобот маълумотлари юкланди");
        } else {
          // Если нет отчетов в текущем квартале, ищем в предыдущих
          await searchInOtherQuarters(formData.stationId, formData.resetDate);
        }
      } catch (error) {
        // Если коллекция не существует или другая ошибка
        console.log("Коллекция не найдена или ошибка:", error.message);
        await searchInOtherQuarters(formData.stationId, formData.resetDate);
      }
    } catch (error) {
      console.error("Ошибка загрузки отчетов:", error);
      setLastReportData(null);
      setAvailableHoses([]);

      if (error.code === "failed-precondition") {
        console.warn("Индекс еще создается. Пробуем альтернативный подход...");
        toast.warning("Индекслар ҳали яратилмоқда. Кутинг...");
      }
    }
  };

  // Поиск отчетов в других кварталах
  const searchInOtherQuarters = async (stationId, resetDate) => {
    try {
      const parts = resetDate.split("-");
      if (parts.length !== 3) return;

      const [day, month, yearStr] = parts;
      const year = parseInt(yearStr);

      // Список кварталов для поиска (от текущего к предыдущим)
      const quartersToSearch = [
        { quarter: getQuarterFromDate(resetDate), year: year },
        { quarter: "IV", year: year - 1 },
        { quarter: "III", year: year - 1 },
        { quarter: "II", year: year - 1 },
        { quarter: "I", year: year - 1 },
      ];

      let foundReport = null;

      for (const { quarter, year: searchYear } of quartersToSearch) {
        if (!quarter) continue;

        const collectionName = `unifiedDailyReports_${quarter}_${searchYear}`;
        // console.log("Проверяем коллекцию:", collectionName);

        try {
          const reportQuery = query(
            collection(db, collectionName),
            where("stationId", "==", stationId),
            orderBy("reportDate", "desc"),
            limit(1)
          );

          const snapshot = await getDocs(reportQuery);

          if (!snapshot.empty) {
            foundReport = snapshot.docs[0].data();
            // console.log("Найден отчет в коллекции:", collectionName);
            break;
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

        toast(
          `Маълумотлар аввалги даврдан олинди (${foundReport.quarter || "?"}_${
            foundReport.year || "?"
          })`,
          {
            icon: "⚠️",
            duration: 3000,
          }
        );
      } else {
        setLastReportData(null);
        setAvailableHoses([]);
        toast("Станция учун хеч қандай хисобот топилмади", {
          icon: "ℹ️",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Ошибка поиска в других кварталах:", error);
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
      // Если нет станции или даты, очищаем данные
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
        (h) => h.hose === formData.hose
      );
      if (hoseData) {
        setFormData((prevData) => ({
          ...prevData,
          lastReadingFromReport: hoseData.current.toString(),
          lastReadingBeforeReset: hoseData.current.toString(),
        }));
      } else {
        // Если шланг не найден в отчете
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
      // Используем упрощенный запрос
      const resetQuery = query(
        collection(db, "meterResetEvents"),
        where("stationId", "==", stationId),
        where("resetDate", "==", resetDate),
        limit(20)
      );

      const snapshot = await getDocs(resetQuery);

      // Фильтруем на стороне клиента по шлангу
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

    // При изменении даты или станции, очищаем данные отчета
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

  const validateForm = () => {
    const errors = {};

    if (!formData.resetDate) errors.resetDate = "Мажбурий майдон";
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
      !formData.newReadingAfterReset
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

    // Проверяем существующее обнуление
    let hasExistingReset = false;
    try {
      hasExistingReset = await checkExistingReset(
        formData.stationId,
        formData.hose,
        formData.resetDate
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

  const handleDateInput = (e) => {
    let value = e.target.value;

    // Удаляем все нецифровые символы, кроме дефиса
    value = value.replace(/[^\d-]/g, "");

    // Ограничиваем длину
    if (value.length > 10) value = value.substring(0, 10);

    // Автоматически добавляем дефисы
    if (value.length === 2 && !value.includes("-")) {
      value = value + "-";
    } else if (value.length === 5 && value[4] !== "-") {
      value = value.substring(0, 4) + "-" + value[4];
    }

    handleInputChange("resetDate", value);
  };

  // Проверка валидности даты
  const isValidDate = (dateString) => {
    try {
      const parts = dateString.split("-");
      if (parts.length !== 3) return false;

      const [day, month, year] = parts;

      // Проверяем, что все части - числа
      if (
        isNaN(parseInt(day)) ||
        isNaN(parseInt(month)) ||
        isNaN(parseInt(year))
      ) {
        return false;
      }

      // Проверяем разумные значения
      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);

      if (yearNum < 2000 || yearNum > 2100) return false;
      if (monthNum < 1 || monthNum > 12) return false;
      if (dayNum < 1 || dayNum > 31) return false;

      return true;
    } catch (error) {
      return false;
    }
  };

  // Получение отображаемой информации о квартале
  const getQuarterDisplayInfo = () => {
    if (!formData.resetDate || !isValidDate(formData.resetDate)) return null;

    const quarter = getQuarterFromDate(formData.resetDate);
    const collectionName = getCollectionName(formData.resetDate);

    return {
      quarter,
      collectionName,
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
                {/* {quarterInfo && (
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
                      Коллекция: {quarterInfo.collectionName}
                    </p>
                  </div>
                )} */}

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
                    Формат: ДД-ММ-ГГГГ
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
                    disabled={!formData.stationId || !formData.resetDate}
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
                    availableHoses.length === 0 && (
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
                        e.target.value
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
                disabled={loading || isSaveButtonDisabled()}
                className={`px-5 py-2 rounded-xl font-semibold flex-1 ${
                  loading || isSaveButtonDisabled()
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
