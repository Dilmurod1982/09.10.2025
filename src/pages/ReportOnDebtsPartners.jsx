import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";
import * as XLSX from "xlsx";
import { toast } from "react-hot-toast";

const ReportOnDebtsPartners = () => {
  const userData = useAppStore((state) => state.userData);
  const [stations, setStations] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [selectedStation, setSelectedStation] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Периоды для выбора
  const periodOptions = [
    { value: "month", label: "Месячный" },
    { value: "quarter", label: "Квартальный" },
    { value: "year", label: "Годовой" },
  ];

  // Годы для выбора
  const yearOptions = useMemo(() => {
    const options = [];
    const currentYear = new Date().getFullYear();
    const startYear = 2025; // Начальный год

    for (let year = startYear; year <= currentYear; year++) {
      options.push({ value: year.toString(), label: year.toString() });
    }

    return options.reverse();
  }, []);

  // Месяцы для выбора
  const monthOptions = [
    { value: "01", label: "Январь" },
    { value: "02", label: "Февраль" },
    { value: "03", label: "Март" },
    { value: "04", label: "Апрель" },
    { value: "05", label: "Май" },
    { value: "06", label: "Июнь" },
    { value: "07", label: "Июль" },
    { value: "08", label: "Август" },
    { value: "09", label: "Сентябрь" },
    { value: "10", label: "Октябрь" },
    { value: "11", label: "Ноябрь" },
    { value: "12", label: "Декабрь" },
  ];

  // Кварталы для выбора
  const quarterOptions = [
    { value: "I", label: "I квартал (январь-март)" },
    { value: "II", label: "II квартал (апрель-июнь)" },
    { value: "III", label: "III квартал (июль-сентябрь)" },
    { value: "IV", label: "IV квартал (октябрь-декабрь)" },
  ];

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
        toast.error(error);
      }
    };

    fetchStations();
  }, [userData]);

  // Загрузка контрактов
  useEffect(() => {
    const fetchContracts = async () => {
      if (!userData?.stations?.length) return;

      try {
        const contractsQuery = query(
          collection(db, "contracts"),
          where("stationId", "in", userData.stations)
        );

        const snapshot = await getDocs(contractsQuery);
        const contractsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setContracts(contractsData);
      } catch (error) {
        toast.error(error);
      }
    };

    fetchContracts();
  }, [userData]);

  // Расчет дат периода
  const getPeriodDates = (periodType, year, month = null, quarter = null) => {
    if (!year) return { startDate: "", endDate: "" };

    let startDate, endDate;
    const yearNum = parseInt(year);

    switch (periodType) {
      case "month":
        if (!month) return { startDate: "", endDate: "" };
        const monthNum = parseInt(month);
        startDate = new Date(yearNum, monthNum - 1, 1);
        endDate = new Date(yearNum, monthNum, 0); // Последний день месяца
        break;

      case "quarter":
        if (!quarter) return { startDate: "", endDate: "" };
        let quarterStartMonth, quarterEndMonth;

        switch (quarter) {
          case "I":
            quarterStartMonth = 0; // Январь
            quarterEndMonth = 3; // Апрель
            break;
          case "II":
            quarterStartMonth = 3; // Апрель
            quarterEndMonth = 6; // Июль
            break;
          case "III":
            quarterStartMonth = 6; // Июль
            quarterEndMonth = 9; // Октябрь
            break;
          case "IV":
            quarterStartMonth = 9; // Октябрь
            quarterEndMonth = 12; // Январь следующего года
            break;
          default:
            quarterStartMonth = 0;
            quarterEndMonth = 3;
        }

        startDate = new Date(yearNum, quarterStartMonth, 1);
        endDate = new Date(yearNum, quarterEndMonth, 0);
        break;

      case "year":
        startDate = new Date(yearNum, 0, 1);
        endDate = new Date(yearNum, 11, 31);
        break;

      default:
        return { startDate: "", endDate: "" };
    }

    return {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    };
  };

  // Расчет данных отчета
  useEffect(() => {
    if (!selectedPeriod || !selectedYear) {
      setReportData([]);
      return;
    }

    if (
      (selectedPeriod === "month" && !selectedMonth) ||
      (selectedPeriod === "quarter" && !selectedQuarter)
    ) {
      setReportData([]);
      return;
    }

    const generateReport = async () => {
      setLoading(true);
      try {
        const { startDate, endDate } = getPeriodDates(
          selectedPeriod,
          selectedYear,
          selectedMonth,
          selectedQuarter
        );

        // Определяем ID станций для запроса
        let stationIds = [];
        if (selectedStation) {
          stationIds = [selectedStation];
        } else {
          stationIds = userData?.stations || [];
        }

        if (stationIds.length === 0) {
          setReportData([]);
          return;
        }

        // Фильтруем контракты по выбранным станциям
        const filteredContracts = contracts.filter((contract) =>
          stationIds.includes(contract.stationId)
        );

        // Собираем данные по партнерам
        const partnerReportData = {};

        // Обрабатываем каждый контракт
        filteredContracts.forEach((contract) => {
          const {
            id: contractId,
            partner,
            contractNumber,
            startBalance,
            startBalanceDate,
            transactions = [],
          } = contract;

          // Пропускаем контракты без startBalanceDate
          if (!startBalanceDate) return;

          const startBalanceDateObj = new Date(startBalanceDate);
          const periodStartDateObj = new Date(startDate);
          const periodEndDateObj = new Date(endDate);

          // Если startBalanceDate позже конца периода, пропускаем
          if (startBalanceDateObj > periodEndDateObj) return;

          // Рассчитываем начальное сальдо на начало периода
          let currentBalance = parseFloat(startBalance) || 0;
          let totalSoldAmount = 0;
          let totalPaid = 0;

          // Обрабатываем транзакции до начала периода (для накопления сальдо)
          transactions.forEach((transaction) => {
            const transactionDate = new Date(transaction.reportDate);

            // Если транзакция до начала периода, добавляем к начальному сальдо
            if (transactionDate < periodStartDateObj) {
              const soldAmount = parseFloat(transaction.totalAmount) || 0;
              const payment = parseFloat(transaction.paymentSum) || 0;

              currentBalance += soldAmount - payment;
            }
          });

          // Теперь обрабатываем транзакции в пределах периода
          transactions.forEach((transaction) => {
            const transactionDate = new Date(transaction.reportDate);

            // Если транзакция в пределах периода
            if (
              transactionDate >= periodStartDateObj &&
              transactionDate <= periodEndDateObj
            ) {
              const soldAmount = parseFloat(transaction.totalAmount) || 0;
              const payment = parseFloat(transaction.paymentSum) || 0;

              totalSoldAmount += soldAmount;
              totalPaid += payment;
              currentBalance += soldAmount - payment;
            }
          });

          // Добавляем данные в отчет
          if (!partnerReportData[contractId]) {
            partnerReportData[contractId] = {
              contractId,
              partnerName: partner,
              contractNumber,
              startBalance: currentBalance - totalSoldAmount + totalPaid, // Сальдо на начало периода
              totalSoldAmount,
              totalPaid,
              endBalance: currentBalance,
            };
          }
        });

        // Преобразуем в массив
        const reportArray = Object.values(partnerReportData);

        setReportData(reportArray);
      } catch (error) {
        toast.error("Ошибка при генерации отчета");
        setReportData([]);
      } finally {
        setLoading(false);
      }
    };

    generateReport();
  }, [
    selectedStation,
    selectedPeriod,
    selectedYear,
    selectedMonth,
    selectedQuarter,
    userData,
    contracts,
  ]);

  // Сброс зависимых фильтров при изменении периода
  useEffect(() => {
    setSelectedMonth("");
    setSelectedQuarter("");
  }, [selectedPeriod]);

  // Форматирование чисел
  const formatNumber = (number) => {
    const num = parseFloat(number) || 0;
    return num.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Экспорт в Excel
  const exportToExcel = () => {
    if (!reportData.length) return;

    const { startDate, endDate } = getPeriodDates(
      selectedPeriod,
      selectedYear,
      selectedMonth,
      selectedQuarter
    );

    const periodLabel = periodOptions.find(
      (p) => p.value === selectedPeriod
    )?.label;

    const selectedStationData = stations.find((s) => s.id === selectedStation);

    let periodDetail = "";
    if (selectedPeriod === "month") {
      const monthLabel = monthOptions.find(
        (m) => m.value === selectedMonth
      )?.label;
      periodDetail = `${monthLabel} ${selectedYear}`;
    } else if (selectedPeriod === "quarter") {
      const quarterLabel = quarterOptions.find(
        (q) => q.value === selectedQuarter
      )?.label;
      periodDetail = `${quarterLabel} ${selectedYear}`;
    } else if (selectedPeriod === "year") {
      periodDetail = selectedYear;
    }

    const worksheetData = [
      ["Отчет по задолженностям партнеров"],
      [
        selectedStation
          ? `Станция: ${selectedStationData?.stationName || selectedStation}`
          : `Все станции`,
      ],
      [`Период: ${periodLabel} (${periodDetail})`],
      [`Даты: ${startDate} - ${endDate}`],
      [],
      [
        "Партнер",
        "Договор",
        "Сальдо на начало периода",
        "Продано газа (сумма)",
        "Оплачено",
        "Сальдо на конец периода",
      ],
      ...reportData.map((partner) => [
        partner.partnerName,
        partner.contractNumber,
        partner.startBalance,
        partner.totalSoldAmount,
        partner.totalPaid,
        partner.endBalance,
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Задолженности партнеров");

    const colWidths = [
      { wch: 25 }, // Партнер
      { wch: 15 }, // Договор
      { wch: 20 }, // Сальдо на начало
      { wch: 20 }, // Продано сумма
      { wch: 15 }, // Оплачено
      { wch: 20 }, // Сальдо на конец
    ];

    ws["!cols"] = colWidths;

    // ФИКС: Используем let вместо const для fileName
    let fileName = `Задолженности_партнеров_${selectedPeriod}_${selectedYear}`;

    if (selectedMonth) fileName += `_${selectedMonth}`;
    if (selectedQuarter) fileName += `_${selectedQuarter}`;

    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Отчет по задолженностям партнеров
          </h1>
          <p className="text-gray-600">
            Анализ задолженностей партнеров за поставленный газ
          </p>
        </div>

        {/* Панель управления */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Выбор станции */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Станция
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}>
                <option value="">Все станции</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.stationName}
                  </option>
                ))}
              </select>
            </div>

            {/* Выбор периода */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Период *
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}>
                <option value="">Выберите период...</option>
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Выбор года */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Год *
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}>
                <option value="">Выберите год...</option>
                {yearOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Дополнительные фильтры в зависимости от периода */}
            {selectedPeriod === "month" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Месяц *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}>
                  <option value="">Выберите месяц...</option>
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedPeriod === "quarter" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Квартал *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}>
                  <option value="">Выберите квартал...</option>
                  {quarterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Кнопка экспорта */}
          <div className="flex justify-end">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              onClick={exportToExcel}
              disabled={!reportData.length}>
              Экспорт в Excel
            </button>
          </div>
        </div>

        {/* Индикатор загрузки */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Таблица отчета */}
        {!loading && selectedPeriod && selectedYear && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {reportData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Партнер
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Договор
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Сальдо на начало
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Продано газа (сумма)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Оплачено
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Сальдо на конец
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.map((partner) => (
                      <tr
                        key={partner.contractId}
                        className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {partner.partnerName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {partner.contractNumber}
                        </td>
                        <td
                          className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${
                            partner.startBalance >= 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}>
                          {formatNumber(partner.startBalance)} сўм
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600 font-semibold">
                          {formatNumber(partner.totalSoldAmount)} сўм
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-semibold">
                          {formatNumber(partner.totalPaid)} сўм
                        </td>
                        <td
                          className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${
                            partner.endBalance >= 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}>
                          {formatNumber(partner.endBalance)} сўм
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Данные не найдены
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Для выбранных параметров данные отсутствуют
                </p>
              </div>
            )}
          </div>
        )}

        {/* Сообщение о выборе параметров */}
        {(!selectedPeriod || !selectedYear) && !loading && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Выберите параметры
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Выберите период и год для генерации отчета
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportOnDebtsPartners;
