import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";
import * as XLSX from "xlsx";
import { toast } from "react-hot-toast";

const ReportOnDebtsPartners = () => {
  const userData = useAppStore((state) => state.userData);
  const [stations, setStations] = useState([]);
  const [partners, setPartners] = useState([]);
  const [selectedStation, setSelectedStation] = useState("");
  const [selectedPartner, setSelectedPartner] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Периоды для выбора
  const periodOptions = [
    { value: "month", label: "Месячный" },
    { value: "quarter", label: "Квартальный" },
    { value: "halfYear", label: "Полугодовой" },
    { value: "year", label: "Годовой" },
  ];

  // Месяцы для выбора
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

  // Загрузка партнеров и контрактов
  useEffect(() => {
    const fetchPartners = async () => {
      if (!userData?.stations?.length) return;

      try {
        const contractsQuery = query(
          collection(db, "contracts"),
          where("stationId", "in", userData.stations)
        );

        const snapshot = await getDocs(contractsQuery);
        const partnersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setPartners(partnersData);
      } catch (error) {
        toast.error(error);
      }
    };

    fetchPartners();
  }, [userData]);

  // Фильтрация партнеров при выборе станции
  const filteredPartners = useMemo(() => {
    if (selectedStation) {
      return partners.filter(
        (partner) => partner.stationId === selectedStation
      );
    }
    return partners;
  }, [partners, selectedStation]);

  // Расчет дат периода
  const getPeriodDates = (periodType, baseMonth) => {
    if (!baseMonth) return { startDate: "", endDate: "" };

    const [year, month] = baseMonth.split("-").map(Number);
    let startDate, endDate;

    switch (periodType) {
      case "month":
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0); // Последний день месяца
        break;
      case "quarter":
        const quarterStartMonth = Math.floor((month - 1) / 3) * 3;
        startDate = new Date(year, quarterStartMonth, 1);
        endDate = new Date(year, quarterStartMonth + 3, 0);
        break;
      case "halfYear":
        const halfYearStartMonth = month <= 6 ? 0 : 6;
        startDate = new Date(year, halfYearStartMonth, 1);
        endDate = new Date(year, halfYearStartMonth + 6, 0);
        break;
      case "year":
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31);
        break;
      default:
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0);
    }

    // Преобразуем в строки и убедимся, что это правильные даты
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    console.log("Рассчитанный период:", {
      baseMonth,
      periodType,
      startDate: startDateStr,
      endDate: endDateStr,
      startDateObj: startDate,
      endDateObj: endDate,
    });

    return {
      startDate: startDateStr,
      endDate: endDateStr,
    };
  };

  // Загрузка начального сальдо из последнего отчета предыдущего месяца
  const getStartBalances = async (stationIds, startDate) => {
    try {
      const startBalances = {};

      for (const stationId of stationIds) {
        // Получаем последний отчет предыдущего месяца для определения начального сальдо
        const previousMonthQuery = query(
          collection(db, "unifiedDailyReports"),
          where("stationId", "==", stationId),
          where("reportDate", "<", startDate),
          orderBy("reportDate", "desc"),
          limit(1)
        );

        const previousSnapshot = await getDocs(previousMonthQuery);

        if (!previousSnapshot.empty) {
          const lastReport = previousSnapshot.docs[0].data();
          const reportPartners = lastReport.partnerData || [];

          reportPartners.forEach((partner) => {
            const partnerId = partner.partnerId;
            if (!startBalances[partnerId]) {
              startBalances[partnerId] = {
                startBalance: parseFloat(partner.endBalance) || 0, // Берем endBalance предыдущего отчета как startBalance текущего
                partnerName: partner.partnerName,
                contractNumber: partner.contractNumber,
              };
            }
          });
        } else {
          // Если предыдущих отчетов нет, ищем первый отчет текущего месяца
          const firstReportQuery = query(
            collection(db, "unifiedDailyReports"),
            where("stationId", "==", stationId),
            where("reportDate", ">=", startDate),
            orderBy("reportDate", "asc"),
            limit(1)
          );

          const firstSnapshot = await getDocs(firstReportQuery);

          if (!firstSnapshot.empty) {
            const firstReport = firstSnapshot.docs[0].data();
            const reportPartners = firstReport.partnerData || [];

            reportPartners.forEach((partner) => {
              const partnerId = partner.partnerId;
              if (!startBalances[partnerId]) {
                startBalances[partnerId] = {
                  startBalance: parseFloat(partner.startBalance) || 0,
                  partnerName: partner.partnerName,
                  contractNumber: partner.contractNumber,
                };
              }
            });
          }
        }
      }

      return startBalances;
    } catch (error) {
      console.error("Error loading start balances:", error);
      return {};
    }
  };

  // Загрузка и расчет данных отчета
  useEffect(() => {
    if (!selectedPeriod || !selectedMonth) {
      setReportData([]);
      return;
    }

    const generateReport = async () => {
      setLoading(true);
      try {
        const { startDate, endDate } = getPeriodDates(
          selectedPeriod,
          selectedMonth
        );

        console.log("Период отчета:", {
          startDate,
          endDate,
          selectedPeriod,
          selectedMonth,
        });

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

        // Загружаем начальные сальдо из последнего отчета предыдущего месяца
        const startBalances = await getStartBalances(stationIds, startDate);

        // Загружаем все отчеты за период
        const reportsQuery = query(
          collection(db, "unifiedDailyReports"),
          where("stationId", "in", stationIds),
          where("reportDate", ">=", startDate),
          where("reportDate", "<=", endDate),
          orderBy("reportDate", "asc")
        );

        const snapshot = await getDocs(reportsQuery);
        const allReports = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        console.log("Все отчеты за период:", allReports);
        console.log("Начальные сальдо:", startBalances);

        // Собираем данные по партнерам
        const partnerReportData = {};

        // Обрабатываем каждый отчет
        allReports.forEach((report) => {
          console.log(
            `Обработка отчета за ${report.reportDate}:`,
            report.partnerData
          );

          const reportPartners = report.partnerData || [];

          reportPartners.forEach((partner) => {
            const partnerId = partner.partnerId;

            // Фильтрация по выбранному партнеру
            if (selectedPartner && partnerId !== selectedPartner) {
              return;
            }

            // Отладочная информация для каждого партнера
            console.log(
              `Партнер ${partner.partnerName} в отчете ${report.reportDate}:`,
              {
                soldM3: partner.soldM3,
                totalAmount: partner.totalAmount,
                paymentSum: partner.paymentSum,
                startBalance: partner.startBalance,
                endBalance: partner.endBalance,
              }
            );

            if (!partnerReportData[partnerId]) {
              // Используем данные из начальных сальдо или создаем новую запись
              const startBalanceData = startBalances[partnerId];

              if (!startBalanceData) {
                // Если нет данных о начальном сальдо, используем данные из первого отчета
                partnerReportData[partnerId] = {
                  partnerId,
                  partnerName: partner.partnerName,
                  contractNumber: partner.contractNumber,
                  startBalance: parseFloat(partner.startBalance) || 0,
                  totalSoldM3: 0,
                  totalSoldAmount: 0,
                  totalPaid: 0,
                };
              } else {
                partnerReportData[partnerId] = {
                  partnerId,
                  partnerName: startBalanceData.partnerName,
                  contractNumber: startBalanceData.contractNumber,
                  startBalance: startBalanceData.startBalance,
                  totalSoldM3: 0,
                  totalSoldAmount: 0,
                  totalPaid: 0,
                };
              }
            }

            const partnerData = partnerReportData[partnerId];

            // Добавляем проданный газ
            const soldM3 = parseFloat(partner.soldM3) || 0;
            const totalAmount = parseFloat(partner.totalAmount) || 0;

            partnerData.totalSoldM3 += soldM3;
            partnerData.totalSoldAmount += totalAmount;

            // Добавляем оплаты
            const paymentSum = parseFloat(partner.paymentSum) || 0;
            partnerData.totalPaid += paymentSum;

            console.log(`После обработки партнера ${partner.partnerName}:`, {
              totalSoldM3: partnerData.totalSoldM3,
              totalSoldAmount: partnerData.totalSoldAmount,
              totalPaid: partnerData.totalPaid,
            });
          });
        });

        // Преобразуем в массив и рассчитываем конечное сальдо
        const reportArray = Object.values(partnerReportData).map((partner) => {
          const endBalance =
            partner.startBalance + partner.totalSoldAmount - partner.totalPaid;

          console.log(`Итог по партнеру ${partner.partnerName}:`, {
            startBalance: partner.startBalance,
            totalSoldAmount: partner.totalSoldAmount,
            totalPaid: partner.totalPaid,
            endBalance: endBalance,
          });

          return {
            ...partner,
            endBalance: endBalance,
          };
        });

        console.log("Итоговые данные отчета:", reportArray);

        setReportData(reportArray);
      } catch (error) {
        console.error("Error generating report:", error);
        setReportData([]);
      } finally {
        setLoading(false);
      }
    };

    generateReport();
  }, [
    selectedStation,
    selectedPartner,
    selectedPeriod,
    selectedMonth,
    userData,
    partners,
  ]);

  // Сброс фильтра партнера при изменении станции
  useEffect(() => {
    if (selectedPartner) {
      const partner = partners.find((p) => p.id === selectedPartner);
      if (partner && selectedStation && partner.stationId !== selectedStation) {
        setSelectedPartner("");
      }
    }
  }, [selectedStation, selectedPartner, partners]);

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
      selectedMonth
    );
    const periodLabel = periodOptions.find(
      (p) => p.value === selectedPeriod
    )?.label;
    const selectedStationData = stations.find((s) => s.id === selectedStation);

    const worksheetData = [
      ["Отчет по задолженностям партнеров"],
      [
        selectedStation
          ? `Станция: ${selectedStationData?.stationName || selectedStation}`
          : `Все станции`,
      ],
      [
        selectedPartner
          ? `Партнер: ${
              partners.find((p) => p.id === selectedPartner)?.partner ||
              selectedPartner
            }`
          : `Все партнеры`,
      ],
      [`Период: ${periodLabel} (${startDate} - ${endDate})`],
      [],
      [
        "Партнер",
        "Договор",
        "Сальдо на начало периода",
        "Продано газа (м³)",
        "Продано газа (сумма)",
        "Оплачено",
        "Сальдо на конец периода",
      ],
      ...reportData.map((partner) => [
        partner.partnerName,
        partner.contractNumber,
        partner.startBalance,
        partner.totalSoldM3,
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
      { wch: 15 }, // Продано м³
      { wch: 20 }, // Продано сумма
      { wch: 15 }, // Оплачено
      { wch: 20 }, // Сальдо на конец
    ];

    ws["!cols"] = colWidths;

    const fileName = `Задолженности_партнеров_${selectedPeriod}_${selectedMonth}`;
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

            {/* Выбор партнера */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Партнер
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedPartner}
                onChange={(e) => setSelectedPartner(e.target.value)}
                disabled={!selectedStation && filteredPartners.length > 0}>
                <option value="">Все партнеры</option>
                {filteredPartners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.partner} ({partner.contractNumber})
                  </option>
                ))}
              </select>
              {selectedStation && filteredPartners.length === 0 && (
                <p className="text-sm text-orange-600 mt-1">
                  На выбранной станции нет прикрепленных партнеров
                </p>
              )}
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

            {/* Выбор месяца */}
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
        {!loading && selectedPeriod && selectedMonth && (
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
                        Продано газа (м³)
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
                        key={partner.partnerId}
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
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600">
                          {formatNumber(partner.totalSoldM3)} м³
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
        {(!selectedPeriod || !selectedMonth) && !loading && (
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
                Выберите период и месяц для генерации отчета
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportOnDebtsPartners;
