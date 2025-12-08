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
    { value: "month", label: "Ойлик" },
    { value: "quarter", label: "Чорак" },
    { value: "year", label: "Йиллик" },
  ];

  // Годы для выбора
  const yearOptions = useMemo(() => {
    const options = [];
    const currentYear = new Date().getFullYear();
    const startYear = 2025;

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
    { value: "I", label: "I чорак (январь-март)" },
    { value: "II", label: "II чорак (апрель-июнь)" },
    { value: "III", label: "III чорак (июль-сентябрь)" },
    { value: "IV", label: "IV чорак (октябрь-декабрь)" },
  ];

  // Рассчет итоговых значений
  const calculateTotals = useMemo(() => {
    if (!reportData.length) {
      return {
        totalStartBalance: 0,
        totalSoldAmount: 0,
        totalPaid: 0,
        totalEndBalance: 0,
        totalDebtStart: 0,
        totalDebtEnd: 0,
        totalPrepaymentStart: 0,
        totalPrepaymentEnd: 0,
      };
    }

    return reportData.reduce(
      (acc, partner) => {
        const startBalance = parseFloat(partner.startBalance) || 0;
        const soldAmount = parseFloat(partner.totalSoldAmount) || 0;
        const paid = parseFloat(partner.totalPaid) || 0;
        const endBalance = parseFloat(partner.endBalance) || 0;

        acc.totalStartBalance += startBalance;
        acc.totalSoldAmount += soldAmount;
        acc.totalPaid += paid;
        acc.totalEndBalance += endBalance;

        if (startBalance > 0) acc.totalDebtStart += startBalance;
        if (endBalance > 0) acc.totalDebtEnd += endBalance;

        if (startBalance < 0)
          acc.totalPrepaymentStart += Math.abs(startBalance);
        if (endBalance < 0) acc.totalPrepaymentEnd += Math.abs(endBalance);

        return acc;
      },
      {
        totalStartBalance: 0,
        totalSoldAmount: 0,
        totalPaid: 0,
        totalEndBalance: 0,
        totalDebtStart: 0,
        totalDebtEnd: 0,
        totalPrepaymentStart: 0,
        totalPrepaymentEnd: 0,
      }
    );
  }, [reportData]);

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
        toast.error(error.message || "Заправка маълумотини юклашда хатолик");
      }
    };

    fetchStations();
  }, [userData]);

  // Загрузка контрактов с обработкой ошибок индекса
  useEffect(() => {
    const fetchContracts = async () => {
      if (!userData?.stations?.length) return;

      try {
        // Пробуем запрос с where и orderBy
        const contractsQuery = query(
          collection(db, "contracts"),
          where("stationId", "in", userData.stations),
          orderBy("autoId")
        );

        const snapshot = await getDocs(contractsQuery);
        const contractsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setContracts(contractsData);
      } catch (error) {
        if (
          error.code === "failed-precondition" ||
          error.message.includes("index")
        ) {
          // console.log(
          //   "Индекс не найден, загружаем без фильтрации на сервере..."
          // );

          try {
            // Загружаем все контракты без фильтрации
            const contractsQuery = query(collection(db, "contracts"));
            const snapshot = await getDocs(contractsQuery);

            // Фильтруем и сортируем на клиенте
            const contractsData = snapshot.docs
              .map((doc) => ({
                id: doc.id,
                ...doc.data(),
              }))
              .filter((contract) =>
                userData.stations.includes(contract.stationId)
              )
              .sort((a, b) => {
                const autoIdA = a.autoId || 0;
                const autoIdB = b.autoId || 0;
                return autoIdA - autoIdB;
              });

            setContracts(contractsData);

            // Показываем информационное сообщение
            // toast.success("Данные загружены (фильтрация на клиенте)");
          } catch (clientError) {
            toast.error("Шартномалар юклашда хатолик: " + clientError.message);
          }
        } else {
          toast.error("Шартномалар юклашда хатолик: " + error.message);
        }
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
        endDate = new Date(yearNum, monthNum, 0);
        break;

      case "quarter":
        if (!quarter) return { startDate: "", endDate: "" };
        let quarterStartMonth, quarterEndMonth;

        switch (quarter) {
          case "I":
            quarterStartMonth = 0;
            quarterEndMonth = 3;
            break;
          case "II":
            quarterStartMonth = 3;
            quarterEndMonth = 6;
            break;
          case "III":
            quarterStartMonth = 6;
            quarterEndMonth = 9;
            break;
          case "IV":
            quarterStartMonth = 9;
            quarterEndMonth = 12;
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

  // Расчет данных отчета с сортировкой по autoId
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

        const filteredContracts = contracts.filter((contract) =>
          stationIds.includes(contract.stationId)
        );

        const partnerReportData = {};

        filteredContracts.forEach((contract) => {
          const {
            id: contractId,
            partner,
            contractNumber,
            startBalance,
            startBalanceDate,
            transactions = [],
            autoId = 0,
          } = contract;

          if (!startBalanceDate) return;

          const startBalanceDateObj = new Date(startBalanceDate);
          const periodStartDateObj = new Date(startDate);
          const periodEndDateObj = new Date(endDate);

          if (startBalanceDateObj > periodEndDateObj) return;

          let currentBalance = parseFloat(startBalance) || 0;
          let totalSoldAmount = 0;
          let totalPaid = 0;

          transactions.forEach((transaction) => {
            const transactionDate = new Date(transaction.reportDate);

            if (transactionDate < periodStartDateObj) {
              const soldAmount = parseFloat(transaction.totalAmount) || 0;
              const payment = parseFloat(transaction.paymentSum) || 0;

              currentBalance += soldAmount - payment;
            }
          });

          transactions.forEach((transaction) => {
            const transactionDate = new Date(transaction.reportDate);

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

          if (!partnerReportData[contractId]) {
            partnerReportData[contractId] = {
              contractId,
              partnerName: partner,
              contractNumber,
              startBalance: currentBalance - totalSoldAmount + totalPaid,
              totalSoldAmount,
              totalPaid,
              endBalance: currentBalance,
              autoId: autoId || 0,
            };
          }
        });

        // Преобразуем в массив и сортируем по autoId
        const reportArray = Object.values(partnerReportData).sort((a, b) => {
          const autoIdComparison = (a.autoId || 0) - (b.autoId || 0);
          if (autoIdComparison !== 0) return autoIdComparison;

          return (a.partnerName || "").localeCompare(b.partnerName || "");
        });

        setReportData(reportArray);
      } catch (error) {
        toast.error(error.message || "Ҳисобот яратишда хатолик");
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

  useEffect(() => {
    setSelectedMonth("");
    setSelectedQuarter("");
  }, [selectedPeriod]);

  const formatNumber = (number) => {
    const num = parseFloat(number) || 0;
    return num.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

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
      ["Хамкорларни қарздорлиги бўйича ҳисобот"],
      [
        selectedStation
          ? `Заправка: ${selectedStationData?.stationName || selectedStation}`
          : `Барча заправкалар`,
      ],
      [`Давр: ${periodLabel} (${periodDetail})`],
      [`Саналар: ${startDate} - ${endDate}`],
      [],
      [
        "№",
        "Хамкор",
        "Шартнома",
        "Давр бошига сальдо",
        "Сотилган газ (сум)",
        "Тўланди",
        "Давр охирига сальдо",
      ],
      ...reportData.map((partner, index) => [
        index + 1,
        partner.partnerName,
        partner.contractNumber,
        partner.startBalance,
        partner.totalSoldAmount,
        partner.totalPaid,
        partner.endBalance,
      ]),
      [],
      [
        "",
        "Жами",
        "",
        calculateTotals.totalStartBalance,
        calculateTotals.totalSoldAmount,
        calculateTotals.totalPaid,
        calculateTotals.totalEndBalance,
      ],
      [
        "",
        "Жами қарздорлик",
        "",
        calculateTotals.totalDebtStart,
        "",
        "",
        calculateTotals.totalDebtEnd,
      ],
      [
        "",
        "Жами олдидан тўлов",
        "",
        calculateTotals.totalPrepaymentStart,
        "",
        "",
        calculateTotals.totalPrepaymentEnd,
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Хамкорлар карздорлиги");

    const colWidths = [
      { wch: 5 },
      { wch: 40 },
      { wch: 15 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 20 },
    ];

    ws["!cols"] = colWidths;

    const fileName = `Задолженности_партнеров_${selectedPeriod}_${selectedYear}${
      selectedMonth ? `_${selectedMonth}` : ""
    }${selectedQuarter ? `_${selectedQuarter}` : ""}`;

    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-[100vw] mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Хамкорларни қарздорлиги/ҳақдорлиги ҳисоботи
          </h1>
          <p className="text-gray-600 text-sm md:text-base">
            Етказиб берилган сиқилган газ учун қарздорликни тахлили
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 md:mb-2">
                Заправка
              </label>
              <select
                className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}>
                <option value="">Барчаси заправка</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.stationName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 md:mb-2">
                Давр *
              </label>
              <select
                className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}>
                <option value="">Даврни танланг...</option>
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 md:mb-2">
                Йил *
              </label>
              <select
                className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}>
                <option value="">Йилни танланг...</option>
                {yearOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedPeriod === "month" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 md:mb-2">
                  Ой *
                </label>
                <select
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}>
                  <option value="">Ойни танланг...</option>
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
                <label className="block text-sm font-medium text-gray-700 mb-1 md:mb-2">
                  Чорак *
                </label>
                <select
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}>
                  <option value="">Чоракни танланг...</option>
                  {quarterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm md:text-base"
              onClick={exportToExcel}
              disabled={!reportData.length}>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
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

        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && selectedPeriod && selectedYear && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {reportData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        №
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[200px] max-w-[300px]">
                        Хамкор
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Шартнома
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Давр бошига сальдо
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Сотилган газ (сум)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Тўланди
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Давр охирига сальдо
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.map((partner, index) => (
                      <tr
                        key={partner.contractId}
                        className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-[300px] break-words">
                          <div className="truncate" title={partner.partnerName}>
                            {partner.partnerName}
                          </div>
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

                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-3 text-sm text-gray-900"></td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        УМУМИЙСИ
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500"></td>
                      <td
                        className={`px-4 py-3 whitespace-nowrap text-sm ${
                          calculateTotals.totalStartBalance >= 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}>
                        {formatNumber(calculateTotals.totalStartBalance)} сўм
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600">
                        {formatNumber(calculateTotals.totalSoldAmount)} сўм
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600">
                        {formatNumber(calculateTotals.totalPaid)} сўм
                      </td>
                      <td
                        className={`px-4 py-3 whitespace-nowrap text-sm ${
                          calculateTotals.totalEndBalance >= 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}>
                        {formatNumber(calculateTotals.totalEndBalance)} сўм
                      </td>
                    </tr>

                    <tr className="bg-red-50 font-semibold">
                      <td className="px-4 py-3 text-sm text-gray-900"></td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {" "}
                        Жами қарздорлик
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500"></td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600">
                        {formatNumber(calculateTotals.totalDebtStart)} сўм
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm"></td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm"></td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600">
                        {formatNumber(calculateTotals.totalDebtEnd)} сўм
                      </td>
                    </tr>

                    <tr className="bg-green-50 font-semibold">
                      <td className="px-4 py-3 text-sm text-gray-900"></td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        Жами хақдорлик
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500"></td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600">
                        {formatNumber(calculateTotals.totalPrepaymentStart)} сўм
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm"></td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm"></td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600">
                        {formatNumber(calculateTotals.totalPrepaymentEnd)} сўм
                      </td>
                    </tr>
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
                  Маълумотлар топилмади
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Танланган фильтрлар бўйича маълумот топилмади.
                </p>
              </div>
            )}
          </div>
        )}

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
                Филтрларни танланг
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Ҳисобот яратиш учун давр ва йилни танланг
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportOnDebtsPartners;
