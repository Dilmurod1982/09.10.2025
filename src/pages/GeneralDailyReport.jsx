import React, { useEffect, useState, useMemo } from "react";
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
import AddGeneralReportModal from "../components/AddGeneralReportModal";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import UnifiedReportModal from "../components/UnifiedReportModal";
import DetailedReportModal from "../components/DetailedReportModal";

const GeneralDailyReport = () => {
  const userData = useAppStore((state) => state.userData);
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [showDetailedModal, setShowDetailedModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Проверка роли пользователя
  const isOperator = useMemo(() => {
    return userData?.role === "operator";
  }, [userData?.role]);

  // Функция для определения квартала по месяцу и году
  const getQuarterForMonth = (year, month) => {
    const monthNum = parseInt(month);
    if (monthNum >= 1 && monthNum <= 3) return "I";
    if (monthNum >= 4 && monthNum <= 6) return "II";
    if (monthNum >= 7 && monthNum <= 9) return "III";
    return "IV";
  };

  // Функция для получения названия коллекции
  const getCollectionName = (year, month) => {
    const quarter = getQuarterForMonth(year, month);
    return `unifiedDailyReports_${quarter}_${year}`;
  };

  // Генерация месяцев с 2025 года
  const monthOptions = useMemo(() => {
    const options = [];
    const currentDate = new Date();
    const startDate = new Date(2025, 0, 1); // Январь 2025

    for (
      let date = new Date(startDate);
      date <= currentDate;
      date.setMonth(date.getMonth() + 1)
    ) {
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // 1-12
      const value = `${year}-${String(month).padStart(2, "0")}`;
      const label = date.toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "long",
      });
      const quarter = getQuarterForMonth(year, month);
      options.push({ value, label, year, month, quarter });
    }

    return options.reverse(); // Новые месяцы первыми
  }, []);

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

  // Функция для загрузки отчетов из квартальных коллекций (без сложных индексов)
  const fetchReportsData = async () => {
    if (!selectedStation || !selectedMonth) {
      setReports([]);
      return;
    }

    setLoading(true);
    try {
      const [year, month] = selectedMonth.split("-");
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-31`;

      // Получаем название коллекции для выбранного месяца
      const collectionName = getCollectionName(year, month);

      // Пробуем загрузить все документы из коллекции и фильтруем локально
      try {
        // Загружаем все документы из коллекции (без where для stationId)
        const reportsRef = collection(db, collectionName);
        const snapshot = await getDocs(reportsRef);

        // Фильтруем локально по stationId и дате
        const reportsData = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Проверяем, что отчет принадлежит выбранной станции
          if (data.stationId === selectedStation.id) {
            // Проверяем, что отчет входит в выбранный месяц
            const reportDate = data.reportDate;
            if (reportDate >= startDate && reportDate <= endDate) {
              reportsData.push({
                id: doc.id,
                collection: collectionName,
                ...data,
              });
            }
          }
        });

        // Сортируем по дате
        reportsData.sort((a, b) => {
          if (a.reportDate < b.reportDate) return -1;
          if (a.reportDate > b.reportDate) return 1;
          return 0;
        });

        setReports(reportsData);

        // Если в квартальной коллекции не нашли, пробуем старую коллекцию
        if (reportsData.length === 0) {
          await tryOldCollection(startDate, endDate);
        }
      } catch (firestoreError) {
        console.error(
          `Ошибка при загрузке из коллекции ${collectionName}:`,
          firestoreError
        );
        // Пробуем загрузить из старой коллекции
        await tryOldCollection(startDate, endDate);
      }
    } catch (error) {
      console.error("Общая ошибка при загрузке отчетов:", error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  // Функция для попытки загрузки из старой коллекции
  const tryOldCollection = async (startDate, endDate) => {
    try {
      const reportsRef = collection(db, "unifiedDailyReports");
      const snapshot = await getDocs(reportsRef);

      const reportsData = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.stationId === selectedStation.id) {
          const reportDate = data.reportDate;
          if (reportDate >= startDate && reportDate <= endDate) {
            reportsData.push({
              id: doc.id,
              collection: "unifiedDailyReports",
              ...data,
            });
          }
        }
      });

      // Сортируем по дате
      reportsData.sort((a, b) => {
        if (a.reportDate < b.reportDate) return -1;
        if (a.reportDate > b.reportDate) return 1;
        return 0;
      });

      setReports(reportsData);
    } catch (error) {
      console.error("Ошибка при загрузке из старой коллекции:", error);
      setReports([]);
    }
  };

  // Загрузка отчетов при изменении станции, месяца или триггера обновления
  useEffect(() => {
    fetchReportsData();
  }, [selectedStation, selectedMonth, refreshTrigger]);

  // Функция для принудительного обновления списка отчетов
  const refreshReports = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Расчет разницы между показаниями шлангов и счетчика
  const calculateCounterDiff = (report) => {
    const hoseTotal = report.hoseTotalGas || 0;
    const autopilotReading = report.generalData?.autopilotReading || 0;
    return hoseTotal - autopilotReading;
  };

  // Форматирование даты в ДД-ММ-ГГГГ
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Функция для получения суммы наличных из новой структуры
  const getCashAmount = (report) => {
    // Проверяем новую структуру (paymentData.zhisobot)
    if (report.paymentData && report.paymentData.zhisobot !== undefined) {
      return report.paymentData.zhisobot;
    }
    // Старая структура (generalData.cashAmount)
    return report.generalData?.cashAmount || 0;
  };

  // Функция для получения суммы электронных платежей (исключая uzcard и humo которые показываются отдельно)
  const getElectronicPayments = (report) => {
    let total = 0;

    // Новая структура
    if (report.paymentData) {
      const { zhisobot, uzcard, humo, ...otherElectronicPayments } =
        report.paymentData;
      total = Object.values(otherElectronicPayments).reduce(
        (sum, amount) => sum + (amount || 0),
        0
      );
    }

    // Старая структура для обратной совместимости (только electronicPaymentSystem)
    if (total === 0 && report.generalData) {
      total = report.generalData.electronicPaymentSystem || 0;
    }

    return total;
  };

  // Функция для получения суммы всех электронных платежей (включая uzcard и humo)
  const getAllElectronicPayments = (report) => {
    let total = 0;

    // Новая структура
    if (report.paymentData) {
      const { zhisobot, ...allElectronicPayments } = report.paymentData;
      total = Object.values(allElectronicPayments).reduce(
        (sum, amount) => sum + (amount || 0),
        0
      );
    }

    // Старая структура для обратной совместимости
    if (total === 0 && report.generalData) {
      total =
        (report.generalData.uzcardTerminal || 0) +
        (report.generalData.humoTerminal || 0) +
        (report.generalData.electronicPaymentSystem || 0);
    }

    return total;
  };

  // Функция для получения суммы конкретного электронного платежа
  const getPaymentAmount = (report, paymentType) => {
    // Новая структура
    if (report.paymentData && report.paymentData[paymentType] !== undefined) {
      return report.paymentData[paymentType];
    }

    // Старая структура для обратной совместимости
    switch (paymentType) {
      case "uzcard":
        return report.generalData?.uzcardTerminal || 0;
      case "humo":
        return report.generalData?.humoTerminal || 0;
      case "click":
        return report.generalData?.click || 0;
      case "payme":
        return report.generalData?.payme || 0;
      case "paynet":
        return report.generalData?.paynet || 0;
      case "electronicPaymentSystem":
        return report.generalData?.electronicPaymentSystem || 0;
      default:
        return 0;
    }
  };

  // Функция для получения списка всех электронных платежей с названиями (исключая uzcard и humo)
  const getPaymentMethodsList = (report) => {
    const methods = [];

    // Добавляем основные методы из новой структуры
    if (report.paymentData) {
      const { zhisobot, uzcard, humo, ...otherElectronicPayments } =
        report.paymentData;
      Object.entries(otherElectronicPayments).forEach(([key, amount]) => {
        if (amount && amount > 0) {
          let name = key;
          // Преобразуем ключи в читаемые названия
          switch (key) {
            case "click":
              name = "Click";
              break;
            case "payme":
              name = "PayMe";
              break;
            case "paynet":
              name = "PayNet";
              break;
            case "electronicPaymentSystem":
              name = "ЭТТ";
              break;
            default:
              name = key;
          }
          methods.push({ name, amount });
        }
      });
    }

    // Добавляем методы из старой структуры (для обратной совместимости)
    if (methods.length === 0 && report.generalData) {
      if (report.generalData.electronicPaymentSystem > 0) {
        methods.push({
          name: "ЭТТ",
          amount: report.generalData.electronicPaymentSystem,
        });
      }
    }

    return methods;
  };

  // Обработчик клика по строке отчета
  const handleReportClick = (report) => {
    setSelectedReport(report);
    setShowDetailedModal(true);
  };

  // Экспорт в Excel
  const exportToExcel = () => {
    if (!reports.length) return;

    // Получаем список всех типов других электронных платежей (исключая uzcard и humo)
    const allPaymentTypes = new Set();
    reports.forEach((report) => {
      const methods = getPaymentMethodsList(report);
      methods.forEach((method) => allPaymentTypes.add(method.name));
    });

    const paymentTypesArray = Array.from(allPaymentTypes);
    const hasOtherElectronicPayments = paymentTypesArray.length > 0;

    const worksheetData = [
      // Заголовок
      ["Кунлик ҳисобот", "", "", "", "", "", "", "", "", "", "", ""],
      [
        `Станция: ${selectedStation?.stationName || "Ноъмалум заправка"}`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      [
        `Давр: ${new Date(selectedMonth + "-01").toLocaleDateString("ru-RU", {
          month: "long",
          year: "numeric",
        })}`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      [], // Пустая строка

      // Заголовки таблицы
      [
        "№",
        "Сана",
        "Ҳисоблагич кўрсаткичи",
        "Фарқи",
        "Жами шланглар (м³)",
        "Жами хамкорлар (м³)",
        "1м³ нархи",
        "Нақд пул (Z-ҳисобот)",
        "Узкард",
        "Хумо",
        ...(hasOtherElectronicPayments
          ? paymentTypesArray
          : ["Бошқа электрон"]),
        ...(isOperator ? [] : ["Назорат суммаси"]),
        "Яратилди",
      ],

      // Данные
      ...reports.map((report, index) => {
        const counterDiff = calculateCounterDiff(report);
        const cashAmount = getCashAmount(report);
        const uzcardAmount = getPaymentAmount(report, "uzcard");
        const humoAmount = getPaymentAmount(report, "humo");
        const paymentMethods = getPaymentMethodsList(report);

        const row = [
          index + 1,
          formatDate(report.reportDate),
          report.generalData?.autopilotReading || 0,
          counterDiff,
          report.hoseTotalGas || 0,
          report.partnerTotalM3 || 0,
          report.generalData?.gasPrice || 0,
          cashAmount,
          uzcardAmount,
          humoAmount,
        ];

        // Добавляем другие электронные платежи
        if (hasOtherElectronicPayments) {
          paymentTypesArray.forEach((type) => {
            const method = paymentMethods.find((m) => m.name === type);
            row.push(method ? method.amount : 0);
          });
        } else {
          // Если нет других типов, добавляем общую сумму
          row.push(getElectronicPayments(report));
        }

        // Добавляем контрольную сумму только если пользователь не оператор
        if (!isOperator) {
          row.push(report.controlSum || 0);
        }

        row.push(report.createdBy || "Номаълум");

        return row;
      }),

      // Итоги
      [
        "ЖАМИ:",
        "",
        "",
        reports.reduce((sum, report) => sum + calculateCounterDiff(report), 0),
        reports.reduce((sum, report) => sum + (report.hoseTotalGas || 0), 0),
        reports.reduce((sum, report) => sum + (report.partnerTotalM3 || 0), 0),
        "",
        reports.reduce((sum, report) => sum + getCashAmount(report), 0),
        reports.reduce(
          (sum, report) => sum + getPaymentAmount(report, "uzcard"),
          0
        ),
        reports.reduce(
          (sum, report) => sum + getPaymentAmount(report, "humo"),
          0
        ),
        // Итоги по другим электронным платежам
        ...(hasOtherElectronicPayments
          ? paymentTypesArray.map((type) =>
              reports.reduce((sum, report) => {
                const methods = getPaymentMethodsList(report);
                const method = methods.find((m) => m.name === type);
                return sum + (method ? method.amount : 0);
              }, 0)
            )
          : [
              reports.reduce(
                (sum, report) => sum + getElectronicPayments(report),
                0
              ),
            ]),
        ...(isOperator ? [] : [""]),
        "",
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Умумий ҳисобот");

    // Авто-ширина колонок
    const colWidths = [
      { wch: 5 }, // №
      { wch: 12 }, // Дата
      { wch: 18 }, // Показание счетчика
      { wch: 15 }, // Разница счетчика
      { wch: 15 }, // Свод шланги
      { wch: 15 }, // Свод партнеры
      { wch: 12 }, // Цена за м³
      { wch: 18 }, // Наличные (Z)
      { wch: 15 }, // Узкард
      { wch: 15 }, // Хумо
    ];

    // Добавляем ширину для других электронных платежей
    if (hasOtherElectronicPayments) {
      paymentTypesArray.forEach(() => colWidths.push({ wch: 15 }));
    } else {
      colWidths.push({ wch: 15 }); // Общая колонка для других электронных платежей
    }

    // Добавляем ширину для контрольной суммы если нужно
    if (!isOperator) {
      colWidths.push({ wch: 15 }); // Контрольная сумма
    }

    colWidths.push({ wch: 20 }); // Создан

    ws["!cols"] = colWidths;

    XLSX.writeFile(
      wb,
      `Умумий_хисобот_${selectedStation?.stationName}_${selectedMonth}.xlsx`
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Кунлик ҳисобот
          </h1>
          <p className="text-gray-600">
            Кўрсаткичлар ва сотувлар бўйича йиғма ҳисобот
          </p>
        </div>

        {/* Панель управления */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Выбор станции */}
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Заправкани танланг
              </label>
              <select
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
                value={selectedStation?.id || ""}
                onChange={(e) => {
                  const station = stations.find((s) => s.id === e.target.value);
                  setSelectedStation(station || null);
                  setSelectedMonth("");
                }}
              >
                <option value="">танланг...</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.stationName}
                  </option>
                ))}
              </select>
            </div>

            {/* Выбор месяца */}
            {selectedStation && (
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ойни танланг
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  <option value="">танланг...</option>
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.quarter}-чорак)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Кнопки действий */}
            <div className="flex gap-3 lg:ml-auto">
              {/* Показываем кнопку "Ягона ҳисобот" только для операторов */}
              {isOperator && (
                <button
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  onClick={() => setShowUnifiedModal(true)}
                  disabled={!selectedStation}
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
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Ягона ҳисобот
                </button>
              )}

              <button
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={exportToExcel}
                disabled={!reports.length}
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

        {/* Статус загрузки */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Таблица отчетов */}
        {!loading && selectedStation && selectedMonth && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {reports.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        №
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Сана
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Автопилот кўрсаткичи
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Фарқи
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Шланглар (м³)
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Хамкорлар (м³)
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        1м³ нархи
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Нақд пул (Z)
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Узкард
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Хумо
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Бошқа электрон
                      </th>
                      {!isOperator && (
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Назорат суммаси
                        </th>
                      )}
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Яратилди
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reports.map((report, index) => {
                      const counterDiff = calculateCounterDiff(report);
                      const cashAmount = getCashAmount(report);
                      const uzcardAmount = getPaymentAmount(report, "uzcard");
                      const humoAmount = getPaymentAmount(report, "humo");
                      const electronicTotal = getElectronicPayments(report); // Без uzcard и humo
                      const paymentMethods = getPaymentMethodsList(report); // Только другие электронные платежи

                      return (
                        <tr
                          key={report.id}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => handleReportClick(report)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(report.reportDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {report.generalData?.autopilotReading?.toLocaleString() ||
                              "0"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold">
                            {counterDiff.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            {report.hoseTotalGas?.toLocaleString() || "0"} м³
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            {report.partnerTotalM3?.toLocaleString() || "0"} м³
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {report.generalData?.gasPrice?.toLocaleString(
                              "ru-RU",
                              {
                                minimumFractionDigits: 2,
                              }
                            ) || "0.00"}{" "}
                            сўм
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-semibold">
                            {cashAmount?.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                            }) || "0.00"}{" "}
                            сўм
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                            {uzcardAmount?.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                            }) || "0.00"}{" "}
                            сўм
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                            {humoAmount?.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                            }) || "0.00"}{" "}
                            сўм
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                            <div className="flex flex-col">
                              <span className="font-semibold">
                                {electronicTotal?.toLocaleString("ru-RU", {
                                  minimumFractionDigits: 2,
                                }) || "0.00"}{" "}
                                сўм
                              </span>
                              {paymentMethods.length > 0 && (
                                <div className="text-xs text-gray-600 mt-1">
                                  {paymentMethods.map((method, idx) => (
                                    <span key={idx} className="block">
                                      {method.name}:{" "}
                                      {method.amount.toLocaleString("ru-RU")}{" "}
                                      сўм
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          {!isOperator && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">
                              {report.controlSum?.toLocaleString("ru-RU", {
                                minimumFractionDigits: 2,
                              }) || "0.00"}{" "}
                              сўм
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {report.createdBy || "Ноъмалум"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
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
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Ҳисоботлар топилмади
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedStation.stationName} заправка бўйича танланган даврга
                  ҳисобот мавжуд эмас
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Коллекция:{" "}
                  {getCollectionName(
                    selectedMonth.split("-")[0],
                    selectedMonth.split("-")[1]
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Сообщение о выборе параметров */}
        {!selectedStation && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Заправкани танланг
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Ҳисоботни кўриш учун юқорида заправкани танланг.
              </p>
            </div>
          </div>
        )}

        {selectedStation && !selectedMonth && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
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
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Ойни танланг
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {selectedStation.stationName} заправка ҳисоботини кўриш учун
                ойни танланг
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно добавления отчета */}
      {showAddModal && selectedStation && (
        <AddGeneralReportModal
          station={selectedStation}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            refreshReports();
            setShowAddModal(false);
          }}
        />
      )}

      {/* Модальное окно единого отчета */}
      {showUnifiedModal && selectedStation && (
        <UnifiedReportModal
          isOpen={showUnifiedModal}
          onClose={() => setShowUnifiedModal(false)}
          station={selectedStation}
          onSaved={refreshReports}
        />
      )}

      {/* Модальное окно подробного отчета */}
      {showDetailedModal && selectedReport && (
        <DetailedReportModal
          isOpen={showDetailedModal}
          onClose={() => {
            setShowDetailedModal(false);
            setSelectedReport(null);
          }}
          report={selectedReport}
        />
      )}
    </div>
  );
};

export default GeneralDailyReport;
