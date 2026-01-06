import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import ControlSumModal from "../components/ControlSumModal";

const ControlPayments = () => {
  const userData = useAppStore((state) => state.userData);
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [reports, setReports] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Проверка роли пользователя
  const isBuxgalter = userData?.role === "buxgalter";

  // Генерация месяцев
  const monthOptions = useMemo(() => {
    const options = [];
    const currentDate = new Date();
    const startDate = new Date(2025, 0, 1);

    for (
      let date = new Date(startDate);
      date <= currentDate;
      date.setMonth(date.getMonth() + 1)
    ) {
      const year = date.getFullYear();
      const month = date.getMonth();
      const value = `${year}-${String(month + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "long",
      });
      options.push({ value, label });
    }

    return options.reverse();
  }, []);

  // Определение квартала по месяцу
  const getQuarterFromMonth = (year, month) => {
    const monthNum = parseInt(month);
    if (monthNum >= 1 && monthNum <= 3) return "I";
    if (monthNum >= 4 && monthNum <= 6) return "II";
    if (monthNum >= 7 && monthNum <= 9) return "III";
    if (monthNum >= 10 && monthNum <= 12) return "IV";
    return "I";
  };

  // Формирование названия коллекции
  const getCollectionName = (year, month) => {
    const quarter = getQuarterFromMonth(year, month);
    return `unifiedDailyReports_${quarter}_${year}`;
  };

  // Загрузка станций
  useEffect(() => {
    const fetchStations = async () => {
      if (!userData?.stations?.length) return;

      try {
        const snapshot = await getDocs(collection(db, "stations"));
        const matched = snapshot.docs
          .filter((doc) => userData.stations.includes(doc.id))
          .map((doc) => ({ id: doc.id, ...doc.data() }));

        setStations(matched);
      } catch (error) {
        console.error("Ошибка при загрузке станций:", error);
      }
    };

    fetchStations();
  }, [userData]);

  // Загрузка методов платежей
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const snapshot = await getDocs(collection(db, "paymentMethods"));
        const methods = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log("Загруженные методы платежей:", methods);
        setPaymentMethods(methods);
      } catch (error) {
        console.error("Ошибка при загрузке методов платежей:", error);
      }
    };

    fetchPaymentMethods();
  }, []);

  // Загрузка отчетов
  useEffect(() => {
    if (!selectedMonth) {
      setReports([]);
      return;
    }

    const fetchReports = async () => {
      setLoading(true);
      try {
        const [year, month] = selectedMonth.split("-");
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-31`;

        // Определяем коллекцию на основе месяца
        const collectionName = getCollectionName(year, month);

        let q;

        if (selectedStation) {
          // Загрузка для конкретной станции
          q = query(
            collection(db, collectionName),
            where("stationId", "==", selectedStation.id),
            where("reportDate", ">=", startDate),
            where("reportDate", "<=", endDate),
            orderBy("reportDate", "asc")
          );
        } else {
          // Загрузка для всех станций пользователя
          const stationIds = userData?.stations || [];
          if (stationIds.length === 0) {
            setReports([]);
            return;
          }

          q = query(
            collection(db, collectionName),
            where("stationId", "in", stationIds),
            where("reportDate", ">=", startDate),
            where("reportDate", "<=", endDate),
            orderBy("reportDate", "asc")
          );
        }

        const snapshot = await getDocs(q);
        const reportsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Добавляем информацию о станции к каждому отчету
        const reportsWithStationInfo = await Promise.all(
          reportsData.map(async (report) => {
            const stationInfo =
              stations.find((s) => s.id === report.stationId) ||
              (await getStationInfo(report.stationId));
            return {
              ...report,
              stationName: stationInfo?.stationName || "Номаълум заправка",
            };
          })
        );

        setReports(reportsWithStationInfo);
      } catch (error) {
        console.error("Ошибка при загрузке отчетов:", error);
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [selectedStation, selectedMonth, refreshTrigger, userData, stations]);

  // Функция для получения информации о станции
  const getStationInfo = async (stationId) => {
    try {
      const stationDoc = await getDoc(doc(db, "stations", stationId));
      return stationDoc.exists()
        ? { id: stationId, ...stationDoc.data() }
        : null;
    } catch (error) {
      console.error("Ошибка получения информации о станции:", error);
      return null;
    }
  };

  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Расчет процента по новым формулам
  const calculatePercentage = (controlSum, actualSum) => {
    if (!actualSum || actualSum === 0) return 0;
    const percentage = (controlSum / actualSum) * 100;
    return Math.round(percentage * 100) / 100;
  };

  // Получение названия платежной системы по dbFieldName
  const getPaymentMethodName = (dbFieldName) => {
    const method = paymentMethods.find(
      (method) => method.dbFieldName === dbFieldName
    );
    return method ? method.name : dbFieldName;
  };

  // Получение данных о платеже из paymentData
  const getPaymentData = (report, paymentMethod) => {
    const paymentData = report.paymentData || {};
    return paymentData[paymentMethod.dbFieldName] || 0;
  };

  // Получение контрольной суммы для платежного метода
  const getControlSumForPayment = (generalData, paymentMethod) => {
    const dbFieldName = paymentMethod.dbFieldName;

    // Специальные поля для наличных, Humo и Uzcard
    if (dbFieldName === "zhisobot" && generalData.controlTotalSum) {
      return generalData.controlTotalSum;
    }
    if (dbFieldName === "humo" && generalData.controlHumoSum) {
      return generalData.controlHumoSum;
    }
    if (dbFieldName === "uzcard" && generalData.controlUzcardSum) {
      return generalData.controlUzcardSum;
    }

    // Для электронных платежей используем префикс controlElectronic или индивидуальные поля
    if (dbFieldName === "click" && generalData.controlClickSum) {
      return generalData.controlClickSum;
    }
    if (dbFieldName === "payme" && generalData.controlPaymeSum) {
      return generalData.controlPaymeSum;
    }
    if (dbFieldName === "paynet" && generalData.controlPaynetSum) {
      return generalData.controlPaynetSum;
    }

    // Для других электронных платежей
    const controlField = `control${
      dbFieldName.charAt(0).toUpperCase() + dbFieldName.slice(1)
    }Sum`;
    return generalData[controlField] || 0;
  };

  // Открытие модального окна
  const handleOpenModal = (type) => {
    console.log("Открытие модального окна с типом:", type);
    setModalType(type);
    setShowModal(true);
  };

  // Обновление данных после сохранения
  const handleSaveSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Получение электронных платежей (исключая наличные, Humo, Uzcard)
  const getElectronicPaymentMethods = () => {
    return paymentMethods.filter(
      (method) =>
        method.isActive === 1 &&
        method.dbFieldName !== "zhisobot" &&
        method.dbFieldName !== "humo" &&
        method.dbFieldName !== "uzcard"
    );
  };

  // Подготовка данных для экспорта
  const prepareExportData = () => {
    if (!reports.length || !paymentMethods.length) return [];

    // Активные методы платежей
    const activePaymentMethods = paymentMethods.filter(
      (method) => method.isActive === 1
    );

    const worksheetData = [
      ["Тўловлар назорати"],
      [
        selectedStation
          ? `${selectedStation.stationName} заправкаси`
          : `Фойдаланувчининг барча заправкалари`,
      ],
      [
        `Давр: ${new Date(selectedMonth + "-01").toLocaleDateString("ru-RU", {
          month: "long",
          year: "numeric",
        })}`,
      ],
      [],
    ];

    // Заголовки таблицы
    const headers = [
      "Заправка",
      "Сана",
      ...activePaymentMethods
        .map((method) => [
          getPaymentMethodName(method.dbFieldName),
          `${getPaymentMethodName(method.dbFieldName)} назорат суммаси`,
          `${getPaymentMethodName(method.dbFieldName)} фоизи`,
        ])
        .flat(),
    ];

    worksheetData.push(headers);

    // Данные по каждому отчету
    reports.forEach((report) => {
      const generalData = report.generalData || {};
      const paymentData = report.paymentData || {};

      const rowData = [report.stationName, formatDate(report.reportDate)];

      // Данные по каждому методу платежа
      activePaymentMethods.forEach((method) => {
        const actualAmount = getPaymentData(report, method);
        const controlAmount = getControlSumForPayment(generalData, method);
        const percentage = calculatePercentage(controlAmount, actualAmount);

        rowData.push(actualAmount, controlAmount, percentage.toFixed(2) + "%");
      });

      worksheetData.push(rowData);
    });

    return worksheetData;
  };

  // Экспорт в Excel
  const exportToExcel = () => {
    const worksheetData = prepareExportData();
    if (!worksheetData.length) return;

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Назорат суммалар");

    // Расчет ширины колонок
    const colWidths = [
      { wch: 20 }, // Заправка
      { wch: 12 }, // Сана
    ];

    // Добавляем ширину для каждой платежной системы (3 колонки на каждую)
    paymentMethods.forEach(() => {
      colWidths.push({ wch: 15 }); // Сумма
      colWidths.push({ wch: 20 }); // Назорат суммаси
      colWidths.push({ wch: 12 }); // Фоизи
    });

    ws["!cols"] = colWidths;

    const fileName = selectedStation
      ? `Назорат_суммалар_${selectedStation.stationName}_${selectedMonth}`
      : `Барча_заправкалар_назорат_суммалар_${selectedMonth}`;

    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  // Функция для получения цвета кнопки на основе типа
  const getButtonColor = (dbFieldName = "") => {
    if (dbFieldName === "zhisobot" || dbFieldName === "total")
      return "from-green-500 to-green-600 hover:from-green-600 hover:to-green-700";
    if (dbFieldName === "humo")
      return "from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700";
    if (dbFieldName === "uzcard")
      return "from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700";

    // Цвета для электронных платежей
    if (dbFieldName === "click")
      return "from-red-500 to-red-600 hover:from-red-600 hover:to-red-700";
    if (dbFieldName === "payme")
      return "from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700";
    if (dbFieldName === "paynet")
      return "from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700";

    // По умолчанию для других электронных платежей
    return "from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-6 sm:mb-8 text-center sm:text-left">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/20">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Назорат суммалар
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Назорат ва нақд ҳамда пул ўтказиш суммаларини солиштириш
            </p>
            {/* {isBuxgalter && (
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 mt-2">
                👑 Бухгалтер режими
              </div>
            )} */}
          </div>
        </div>

        {/* Панель управления */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/20 p-4 sm:p-6 mb-6">
          <div className="space-y-4">
            {/* Первая строка - выбор станции и месяца */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Выбор станции */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  🏪 Заправка
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-200 hover:border-gray-300"
                  value={selectedStation?.id || ""}
                  onChange={(e) => {
                    const station = stations.find(
                      (s) => s.id === e.target.value
                    );
                    setSelectedStation(station || null);
                  }}
                >
                  <option value="">Барча заправка</option>
                  {stations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.stationName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Выбор месяца */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  📅 Ой *
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-200 hover:border-gray-300"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  <option value="">Ойни танланг...</option>
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Вторая строка - кнопки действий */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                🛠️ Харакат
              </label>

              {/* Кнопки добавления контрольных сумм - только для бухгалтера */}
              {isBuxgalter && (
                <>
                  {/* Базовые кнопки */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Кнопка Жами сумма (наличные) */}
                    <button
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
                      onClick={() => handleOpenModal("total")}
                      disabled={!selectedStation}
                    >
                      <span className="text-lg">💰</span>
                      <span className="text-sm font-medium">Жами сумма</span>
                    </button>

                    {/* Кнопка Humo */}
                    <button
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
                      onClick={() => handleOpenModal("humo")}
                      disabled={!selectedStation}
                    >
                      <span className="text-lg">💳</span>
                      <span className="text-sm font-medium">Humo</span>
                    </button>

                    {/* Кнопка Uzcard */}
                    <button
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
                      onClick={() => handleOpenModal("uzcard")}
                      disabled={!selectedStation}
                    >
                      <span className="text-lg">💳</span>
                      <span className="text-sm font-medium">Uzcard</span>
                    </button>

                    {/* Динамические кнопки для электронных платежей */}
                    {getElectronicPaymentMethods().map((method) => (
                      <button
                        key={method.id}
                        className={`flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r ${getButtonColor(
                          method.dbFieldName
                        )} text-white rounded-xl transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale`}
                        onClick={() => handleOpenModal(method.dbFieldName)}
                        disabled={!selectedStation}
                      >
                        <span className="text-lg">⚡</span>
                        <span className="text-sm font-medium">
                          {method.name}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Отладочная информация (можно удалить после тестирования) */}
                  {/* <div className="mt-2 text-xs text-gray-500">
                    <p>Всего методов: {paymentMethods.length}</p>
                    <p>
                      Электронных платежей:{" "}
                      {getElectronicPaymentMethods().length}
                    </p>
                    {getElectronicPaymentMethods().map((method) => (
                      <span key={method.id} className="mr-2">
                        {method.name} ({method.dbFieldName})
                      </span>
                    ))}
                  </div> */}
                </>
              )}

              {/* Кнопка экспорта - для всех пользователей */}
              <div
                className={`${
                  isBuxgalter ? "pt-3 border-t border-gray-200" : ""
                }`}
              >
                <button
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale font-medium"
                  onClick={exportToExcel}
                  disabled={!reports.length || !selectedMonth}
                >
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
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Excel га экспорт
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Статус загрузки */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-gray-600">Ҳисоботларни юклаш...</p>
            </div>
          </div>
        )}

        {/* Таблица */}
        {!loading && selectedMonth && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/20 overflow-hidden">
            {reports.length > 0 && paymentMethods.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-gray-50 to-blue-50">
                      <tr>
                        <th
                          className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200"
                          rowSpan="2"
                        >
                          Заправка
                        </th>
                        <th
                          className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200"
                          rowSpan="2"
                        >
                          Сана
                        </th>
                        {paymentMethods
                          .filter((method) => method.isActive === 1)
                          .map((method) => (
                            <th
                              key={method.id}
                              colSpan="3"
                              className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 text-center"
                            >
                              {getPaymentMethodName(method.dbFieldName)}
                            </th>
                          ))}
                      </tr>
                      <tr>
                        {paymentMethods
                          .filter((method) => method.isActive === 1)
                          .map((method) => (
                            <React.Fragment key={method.id}>
                              <th className="px-2 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                                Сумма
                              </th>
                              <th className="px-2 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                                Назорат
                              </th>
                              <th className="px-2 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                                %
                              </th>
                            </React.Fragment>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {reports.map((report) => {
                        const generalData = report.generalData || {};
                        const paymentData = report.paymentData || {};

                        return (
                          <tr
                            key={report.id}
                            className="hover:bg-blue-50/50 transition-colors duration-150"
                          >
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {report.stationName}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(report.reportDate)}
                            </td>

                            {paymentMethods
                              .filter((method) => method.isActive === 1)
                              .map((method) => {
                                const actualAmount = getPaymentData(
                                  report,
                                  method
                                );
                                const controlAmount = getControlSumForPayment(
                                  generalData,
                                  method
                                );
                                const percentage = calculatePercentage(
                                  controlAmount,
                                  actualAmount
                                );

                                return (
                                  <React.Fragment key={method.id}>
                                    <td className="px-2 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                                      {actualAmount.toLocaleString("ru-RU", {
                                        minimumFractionDigits: 2,
                                      })}
                                    </td>
                                    <td className="px-2 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold">
                                      {controlAmount.toLocaleString("ru-RU", {
                                        minimumFractionDigits: 2,
                                      })}
                                    </td>
                                    <td
                                      className={`px-2 py-4 whitespace-nowrap text-sm font-bold ${
                                        percentage >= 100
                                          ? "text-green-600"
                                          : "text-orange-600"
                                      }`}
                                    >
                                      {percentage.toFixed(2)}%
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-8 max-w-md mx-auto border border-white/20">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {paymentMethods.length === 0
                      ? "Тўлов методлари юкланмокда..."
                      : "Ҳисоботлар топилмади"}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {paymentMethods.length === 0
                      ? "Илтимос кутганг..."
                      : "Танланган параметлар бўйича ҳисобот мавжуд эмас"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Сообщение о выборе месяца */}
        {!selectedMonth && (
          <div className="text-center py-12">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 max-w-md mx-auto border border-white/20">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Ойни танланг
              </h3>
              <p className="text-gray-600 text-sm">
                Ҳисоботни кўриш учун ойни танланг
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно для добавления контрольных сумм - только для бухгалтера */}
      <AnimatePresence>
        {showModal && modalType && isBuxgalter && (
          <ControlSumModal
            isOpen={showModal}
            onClose={() => {
              setShowModal(false);
              setModalType(null);
            }}
            modalType={modalType}
            stations={stations}
            selectedStation={selectedStation}
            onSaved={handleSaveSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ControlPayments;
