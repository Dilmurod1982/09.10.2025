import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";
import * as XLSX from "xlsx";
import { toast } from "react-hot-toast";
import PartnerDetailsModal from "../components/PartnerDetailsModal";

const ReportOnDebtsPartners = () => {
  const userData = useAppStore((state) => state.userData);

  const [stations, setStations] = useState([]);
  const [contracts, setContracts] = useState([]);
  console.log(contracts);
  const [partnersData, setPartnersData] = useState({}); // Хранилище данных партнеров

  const [selectedStation, setSelectedStation] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  const [reportData, setReportData] = useState([]);

  const [loading, setLoading] = useState(false);

  // Состояния для модального окна партнера
  const [selectedPartnerDetails, setSelectedPartnerDetails] = useState(null);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);

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

  // ---------- helpers: даты строками, без timezone ----------
  const pad2 = (n) => String(n).padStart(2, "0");

  const getLastDayOfMonth = (yearNum, monthNum1to12) => {
    return new Date(yearNum, monthNum1to12, 0).getDate();
  };

  const getPeriodDates = (periodType, year, month = null, quarter = null) => {
    if (!year) return { startDate: "", endDate: "" };

    const y = Number(year);

    if (periodType === "month") {
      if (!month) return { startDate: "", endDate: "" };
      const m = Number(month);
      const lastDay = getLastDayOfMonth(y, m);

      return {
        startDate: `${y}-${pad2(m)}-01`,
        endDate: `${y}-${pad2(m)}-${pad2(lastDay)}`,
      };
    }

    if (periodType === "quarter") {
      if (!quarter) return { startDate: "", endDate: "" };

      const map = {
        I: [1, 3],
        II: [4, 6],
        III: [7, 9],
        IV: [10, 12],
      };

      const [mStart, mEnd] = map[quarter] || map.I;
      const lastDay = getLastDayOfMonth(y, mEnd);

      return {
        startDate: `${y}-${pad2(mStart)}-01`,
        endDate: `${y}-${pad2(mEnd)}-${pad2(lastDay)}`,
      };
    }

    if (periodType === "year") {
      return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
    }

    return { startDate: "", endDate: "" };
  };

  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const formatNumber = (number) => {
    const num = toNumber(number);
    return num.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatNumberM3 = (number) => {
    const num = toNumber(number);
    return num.toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Рассчет итоговых значений
  const calculateTotals = useMemo(() => {
    if (!reportData.length) {
      return {
        totalStartBalance: 0,
        totalSoldAmount: 0,
        totalSoldVolume: 0,
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
        const startBalance = toNumber(partner.startBalance);
        const soldAmount = toNumber(partner.totalSoldAmount);
        const soldVolume = toNumber(partner.totalSoldVolume);
        const paid = toNumber(partner.totalPaid);
        const endBalance = toNumber(partner.endBalance);

        acc.totalStartBalance += startBalance;
        acc.totalSoldAmount += soldAmount;
        acc.totalSoldVolume += soldVolume;
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
        totalSoldVolume: 0,
        totalPaid: 0,
        totalEndBalance: 0,
        totalDebtStart: 0,
        totalDebtEnd: 0,
        totalPrepaymentStart: 0,
        totalPrepaymentEnd: 0,
      },
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
        toast.error(error?.message || "Заправка маълумотини юклашда хатолик");
      }
    };

    fetchStations();
  }, [userData]);

  // Загрузка контрактов с обработкой ошибок индекса
  useEffect(() => {
    const fetchContracts = async () => {
      if (!userData?.stations?.length) return;

      try {
        const contractsQuery = query(
          collection(db, "contracts"),
          where("stationId", "in", userData.stations),
          orderBy("autoId"),
        );

        const snapshot = await getDocs(contractsQuery);
        const contractsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setContracts(contractsData);
      } catch (error) {
        const msg = String(error?.message || "");
        if (
          error?.code === "failed-precondition" ||
          msg.toLowerCase().includes("index")
        ) {
          try {
            const snapshot = await getDocs(query(collection(db, "contracts")));

            const contractsData = snapshot.docs
              .map((doc) => ({ id: doc.id, ...doc.data() }))
              .filter((c) => userData.stations.includes(c.stationId))
              .sort((a, b) => toNumber(a.autoId) - toNumber(b.autoId));

            setContracts(contractsData);
          } catch (clientError) {
            toast.error(
              "Шартномалар юклашда хатолик: " + (clientError?.message || ""),
            );
          }
        } else {
          toast.error("Шартномалар юклашда хатолик: " + (error?.message || ""));
        }
      }
    };

    fetchContracts();
  }, [userData]);

  // Загрузка данных партнеров из коллекции partners
  useEffect(() => {
    const fetchPartnersData = async () => {
      if (!contracts.length) return;

      try {
        // Собираем уникальные имена/ID партнеров из контрактов
        const uniquePartners = [...new Set(contracts.map((c) => c.partner))];

        if (uniquePartners.length === 0) return;

        // Загружаем всех партнеров из коллекции partners
        const partnersSnapshot = await getDocs(collection(db, "partners"));
        const partnersMap = {};

        partnersSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          // Используем название партнера как ключ
          if (data.name) {
            partnersMap[data.name] = {
              id: doc.id,
              ...data,
            };
          }
          // Также сохраняем по ID на всякий случай
          partnersMap[doc.id] = {
            id: doc.id,
            ...data,
          };
        });

        setPartnersData(partnersMap);
      } catch (error) {
        console.error("Error fetching partners:", error);
        toast.error("Хамкорлар маълумотини юклашда хатолик");
      }
    };

    fetchPartnersData();
  }, [contracts]);

  // Сброс выбранных значений при смене периода
  useEffect(() => {
    setSelectedMonth("");
    setSelectedQuarter("");
  }, [selectedPeriod]);

  // ---------- Генерация отчёта ----------
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
          selectedQuarter,
        );

        if (!startDate || !endDate) {
          setReportData([]);
          return;
        }

        const stationIds = selectedStation
          ? [selectedStation]
          : userData?.stations || [];

        if (!stationIds.length) {
          setReportData([]);
          return;
        }

        const filteredContracts = contracts.filter((c) =>
          stationIds.includes(c.stationId),
        );

        const partnerReportData = {};

        for (const contract of filteredContracts) {
          const contractId = contract.id;
          const partnerName = contract.partner;
          const contractNumber = contract.contractNumber;
          const startBalance = contract.startBalance;
          const startBalanceDate = contract.startBalanceDate;
          const transactions = Array.isArray(contract.transactions)
            ? contract.transactions
            : [];
          const autoId = toNumber(contract.autoId);

          // Получаем данные партнера из загруженного объекта
          const partnerInfo = partnersData[partnerName] || {};

          // Дополнительные поля для детального модального окна из коллекции partners
          const inn = partnerInfo.inn || contract.inn;
          const director = partnerInfo.director || contract.director;
          const shhr = partnerInfo.shhr || contract.shhr;
          const bankAccount = partnerInfo.bankAccount || contract.bankAccount;
          const partnerAddress = partnerInfo.address || contract.address;
          const partnerPhone = partnerInfo.phone || contract.phone;
          const files = contract.files || [];

          if (!startBalanceDate) continue;
          if (startBalanceDate > endDate) continue;

          let currentBalance = toNumber(startBalance);
          let totalSoldAmount = 0;
          let totalSoldVolume = 0;
          let totalPaid = 0;

          // Транзакции ДО периода
          for (const t of transactions) {
            const d = t?.reportDate;
            if (!d) continue;

            if (d < startDate) {
              const soldAmount = toNumber(t.totalAmount);
              const payment = toNumber(t.paymentSum);
              currentBalance += soldAmount - payment;
            }
          }

          // Транзакции В периоде
          for (const t of transactions) {
            const d = t?.reportDate;
            if (!d) continue;

            if (d >= startDate && d <= endDate) {
              const soldAmount = toNumber(t.totalAmount);
              const soldVolume =
                toNumber(t.soldM3) || toNumber(t.quantity) || 0; // Добавляем объем газа
              const payment = toNumber(t.paymentSum);

              totalSoldAmount += soldAmount;
              totalSoldVolume += soldVolume;
              totalPaid += payment;
              currentBalance += soldAmount - payment;
            }
          }

          const periodStartBalance =
            currentBalance - totalSoldAmount + totalPaid;

          partnerReportData[contractId] = {
            contractId,
            partnerName,
            contractNumber,
            startBalance: periodStartBalance,
            totalSoldAmount,
            totalSoldVolume,
            totalPaid,
            endBalance: currentBalance,
            autoId: autoId || 0,
            // Данные из partners коллекции
            inn,
            director,
            shhr,
            bankAccount,
            partnerAddress,
            partnerPhone,
            contractDate: contract.contractDate,
            contractEndDate: contract.contractEndDate,
            startBalanceDate,
            files,
            stationName: contract.stationName,
            stationId: contract.stationId,
          };
        }

        const reportArray = Object.values(partnerReportData).sort((a, b) => {
          const d = toNumber(a.autoId) - toNumber(b.autoId);
          if (d !== 0) return d;
          return String(a.partnerName || "").localeCompare(
            String(b.partnerName || ""),
          );
        });

        setReportData(reportArray);
      } catch (error) {
        toast.error(error?.message || "Ҳисобот яратишда хатолик");
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
    partnersData,
  ]);

  // Обработчик клика по строке партнера
  const handlePartnerClick = (partner) => {
    setSelectedPartnerDetails(partner);
    setIsPartnerModalOpen(true);
  };

  // ---------- Экспорт в Excel ----------
  const exportToExcel = () => {
    if (!reportData.length) return;

    const { startDate, endDate } = getPeriodDates(
      selectedPeriod,
      selectedYear,
      selectedMonth,
      selectedQuarter,
    );

    const periodLabel = periodOptions.find(
      (p) => p.value === selectedPeriod,
    )?.label;

    const selectedStationData = stations.find((s) => s.id === selectedStation);

    let periodDetail = "";
    if (selectedPeriod === "month") {
      const monthLabel = monthOptions.find(
        (m) => m.value === selectedMonth,
      )?.label;
      periodDetail = `${monthLabel} ${selectedYear}`;
    } else if (selectedPeriod === "quarter") {
      const quarterLabel = quarterOptions.find(
        (q) => q.value === selectedQuarter,
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
        "Сотилган газ (м³)",
        "Сотилган газ (сум)",
        "Тўланди",
        "Давр охирига сальдо",
      ],
      ...reportData.map((partner, index) => [
        index + 1,
        partner.partnerName,
        partner.contractNumber,
        partner.startBalance,
        partner.totalSoldVolume,
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
        calculateTotals.totalSoldVolume,
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
        "",
        calculateTotals.totalPrepaymentEnd,
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Хамкорлар карздорлиги");

    ws["!cols"] = [
      { wch: 5 },
      { wch: 40 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 20 },
    ];

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
                onChange={(e) => setSelectedStation(e.target.value)}
              >
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
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
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
                onChange={(e) => setSelectedYear(e.target.value)}
              >
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
            )}

            {selectedPeriod === "quarter" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 md:mb-2">
                  Чорак *
                </label>
                <select
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}
                >
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
              disabled={!reportData.length}
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
                        Сотилган газ (м³)
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
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handlePartnerClick(partner)}
                      >
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
                            toNumber(partner.startBalance) >= 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {formatNumber(partner.startBalance)} сўм
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-purple-600 font-semibold">
                          {formatNumberM3(partner.totalSoldVolume)} м³
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600 font-semibold">
                          {formatNumber(partner.totalSoldAmount)} сўм
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-semibold">
                          {formatNumber(partner.totalPaid)} сўм
                        </td>
                        <td
                          className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${
                            toNumber(partner.endBalance) >= 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
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
                        }`}
                      >
                        {formatNumber(calculateTotals.totalStartBalance)} сўм
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-purple-600">
                        {formatNumberM3(calculateTotals.totalSoldVolume)} м³
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
                        }`}
                      >
                        {formatNumber(calculateTotals.totalEndBalance)} сўм
                      </td>
                    </tr>

                    <tr className="bg-red-50 font-semibold">
                      <td className="px-4 py-3 text-sm text-gray-900"></td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        Жами қарздорлик
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500"></td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600">
                        {formatNumber(calculateTotals.totalDebtStart)} сўм
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm"></td>
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
                Филтрларни танланг
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Ҳисобот яратиш учун давр ва йилни танланг
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно с детальной информацией о партнере */}
      <PartnerDetailsModal
        isOpen={isPartnerModalOpen}
        onClose={() => setIsPartnerModalOpen(false)}
        partner={selectedPartnerDetails}
        stationName={
          stations.find((s) => s.id === selectedStation)?.stationName ||
          selectedPartnerDetails?.stationName ||
          "Заправка"
        }
      />
    </div>
  );
};

export default ReportOnDebtsPartners;
