// hooks/useStationAnalytics.js
import { useState, useEffect, useRef } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";

// Вспомогательные функции
export const formatDate = (dateString) => {
  if (!dateString) return "";

  const months = {
    "01": "январь",
    "02": "февраль",
    "03": "март",
    "04": "апрель",
    "05": "май",
    "06": "июнь",
    "07": "июль",
    "08": "август",
    "09": "сентябрь",
    10: "октябрь",
    11: "ноябрь",
    12: "декабрь",
  };

  try {
    const [year, month, day] = dateString.split("-");
    const monthName = months[month] || month;
    return `${day} ${monthName} ${year}`;
  } catch (error) {
    return dateString;
  }
};

export const formatNumber = (num) => {
  return new Intl.NumberFormat("ru-RU").format(num);
};

export const formatCurrency = (num) => {
  return new Intl.NumberFormat("ru-RU").format(num) + " сўм";
};

export const useStationAnalytics = (managedStations = []) => {
  const [analysisData, setAnalysisData] = useState({
    autopilotData: [],
    comparisonData: [],
    negativeDifferenceData: [],
    missingReportsData: [],
    controlDifferenceData: [],
    expiredDocumentsData: [],
    gasAndPaymentsData: [], // НОВЫЙ АНАЛИЗ
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Добавим состояние для отладки
  const [debugInfo, setDebugInfo] = useState({
    reportsCount: 0,
    documentsCount: 0,
    managedStationsCount: managedStations.length,
  });

  // Добавим useRef для отслеживания предыдущих managedStations
  const prevManagedStationsRef = useRef(managedStations);
  const isInitialLoadRef = useRef(true);

  // Вспомогательные функции для периодов
  const filterReportsByPeriod = (reports, period) => {
    const today = new Date();
    let startDate = new Date();

    switch (period) {
      case "1day":
      case "yesterday":
        startDate.setDate(today.getDate() - 1);
        break;
      case "7days":
        startDate.setDate(today.getDate() - 7);
        break;
      case "1month":
        startDate.setMonth(today.getMonth() - 1);
        break;
      case "6months":
        startDate.setMonth(today.getMonth() - 6);
        break;
      case "1year":
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      default:
        startDate.setDate(today.getDate() - 1);
    }

    const startDateStr = startDate.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    return reports.filter(
      (report) =>
        report.reportDate >= startDateStr && report.reportDate <= todayStr
    );
  };

  const getDatesForPeriod = (period) => {
    const dates = [];
    const today = new Date();
    let daysBack = 1;

    switch (period) {
      case "1day":
        daysBack = 1;
        break;
      case "7days":
        daysBack = 7;
        break;
      case "1month":
        daysBack = 30;
        break;
      case "6months":
        daysBack = 180;
        break;
      case "1year":
        daysBack = 365;
        break;
      default:
        daysBack = 1;
    }

    for (let i = 1; i <= daysBack; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split("T")[0]);
    }

    return dates;
  };

  const getLatestReportsByPeriod = (reports, period) => {
    if (period === "1day") {
      return getLatestReports(reports);
    } else {
      return reports;
    }
  };

  const getLatestReports = (reports) => {
    const latestMap = new Map();
    reports.forEach((report) => {
      if (
        !latestMap.has(report.stationId) ||
        new Date(report.reportDate) >
          new Date(latestMap.get(report.stationId).reportDate)
      ) {
        latestMap.set(report.stationId, report);
      }
    });
    return Array.from(latestMap.values());
  };

  const getAllStations = async () => {
    try {
      const stationsQuery = query(collection(db, "stations"));
      const stationsSnapshot = await getDocs(stationsQuery);
      return stationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      return [];
    }
  };

  // НОВАЯ ФУНКЦИЯ: Анализ расхода газа и поступлений платежей
  const analyzeGasAndPayments = (reports, period = "1day") => {
    try {
      // Фильтруем отчеты по периоду
      const filteredReports = filterReportsByPeriod(reports, period);

      if (filteredReports.length === 0) {
        return [];
      }

      // Группируем отчеты по станциям
      const stationsMap = new Map();

      filteredReports.forEach((report) => {
        const stationId = report.stationId;

        if (!stationsMap.has(stationId)) {
          stationsMap.set(stationId, {
            stationName: report.stationName,
            stationId: stationId,
            totalGas: 0,
            totalCash: 0,
            totalHumo: 0,
            totalUzcard: 0,
            totalElectronic: 0,
            reportsCount: 0,
            period: period,
          });
        }

        const stationData = stationsMap.get(stationId);

        // Суммируем данные
        stationData.totalGas += report.hoseTotalGas || 0;
        stationData.totalCash += report.generalData?.cashAmount || 0;
        stationData.totalHumo += report.generalData?.humoTerminal || 0;
        stationData.totalUzcard += report.generalData?.uzcardTerminal || 0;
        stationData.totalElectronic +=
          report.generalData?.electronicPaymentSystem || 0;
        stationData.reportsCount += 1;
      });

      // Преобразуем в массив и добавляем расчеты
      const result = Array.from(stationsMap.values()).map((station) => {
        const totalPayments =
          station.totalCash +
          station.totalHumo +
          station.totalUzcard +
          station.totalElectronic;
        const averageGasPerReport =
          station.reportsCount > 0
            ? station.totalGas / station.reportsCount
            : 0;
        const averagePaymentsPerReport =
          station.reportsCount > 0 ? totalPayments / station.reportsCount : 0;

        return {
          ...station,
          totalPayments,
          averageGasPerReport,
          averagePaymentsPerReport,
          paymentDistribution: {
            cash: station.totalCash,
            humo: station.totalHumo,
            uzcard: station.totalUzcard,
            electronic: station.totalElectronic,
            cashPercentage:
              totalPayments > 0 ? (station.totalCash / totalPayments) * 100 : 0,
            humoPercentage:
              totalPayments > 0 ? (station.totalHumo / totalPayments) * 100 : 0,
            uzcardPercentage:
              totalPayments > 0
                ? (station.totalUzcard / totalPayments) * 100
                : 0,
            electronicPercentage:
              totalPayments > 0
                ? (station.totalElectronic / totalPayments) * 100
                : 0,
          },
        };
      });

      // Сортируем по общему объему газа (по убыванию)
      return result.sort((a, b) => b.totalGas - a.totalGas);
    } catch (error) {
      console.error("Error analyzing gas and payments:", error);
      return [];
    }
  };

  // НОВАЯ ФУНКЦИЯ: Анализ по дням, месяцам, годам
  const analyzeGasAndPaymentsByDateRange = (reports, dateRange) => {
    try {
      const { startDate, endDate, rangeType } = dateRange;

      // Фильтруем отчеты по дате
      const filteredReports = reports.filter((report) => {
        const reportDate = new Date(report.reportDate);
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Включаем весь конечный день

        return reportDate >= start && reportDate <= end;
      });

      if (filteredReports.length === 0) {
        return {
          summary: {
            totalGas: 0,
            totalCash: 0,
            totalHumo: 0,
            totalUzcard: 0,
            totalElectronic: 0,
            totalPayments: 0,
            reportsCount: 0,
            period: `${formatDate(startDate)} - ${formatDate(endDate)}`,
          },
          dailyData: [],
          stationsData: [],
        };
      }

      // Группируем по дням для детального анализа
      const dailyMap = new Map();
      const stationsMap = new Map();

      filteredReports.forEach((report) => {
        const reportDate = report.reportDate;
        const stationId = report.stationId;

        // Группировка по дням
        if (!dailyMap.has(reportDate)) {
          dailyMap.set(reportDate, {
            date: reportDate,
            totalGas: 0,
            totalCash: 0,
            totalHumo: 0,
            totalUzcard: 0,
            totalElectronic: 0,
            reportsCount: 0,
          });
        }

        const dailyData = dailyMap.get(reportDate);
        dailyData.totalGas += report.hoseTotalGas || 0;
        dailyData.totalCash += report.generalData?.cashAmount || 0;
        dailyData.totalHumo += report.generalData?.humoTerminal || 0;
        dailyData.totalUzcard += report.generalData?.uzcardTerminal || 0;
        dailyData.totalElectronic +=
          report.generalData?.electronicPaymentSystem || 0;
        dailyData.reportsCount += 1;

        // Группировка по станциям
        if (!stationsMap.has(stationId)) {
          stationsMap.set(stationId, {
            stationName: report.stationName,
            stationId: stationId,
            totalGas: 0,
            totalCash: 0,
            totalHumo: 0,
            totalUzcard: 0,
            totalElectronic: 0,
            reportsCount: 0,
          });
        }

        const stationData = stationsMap.get(stationId);
        stationData.totalGas += report.hoseTotalGas || 0;
        stationData.totalCash += report.generalData?.cashAmount || 0;
        stationData.totalHumo += report.generalData?.humoTerminal || 0;
        stationData.totalUzcard += report.generalData?.uzcardTerminal || 0;
        stationData.totalElectronic +=
          report.generalData?.electronicPaymentSystem || 0;
        stationData.reportsCount += 1;
      });

      // Преобразуем в массивы
      const dailyData = Array.from(dailyMap.values())
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((day) => ({
          ...day,
          totalPayments:
            day.totalCash +
            day.totalHumo +
            day.totalUzcard +
            day.totalElectronic,
        }));

      const stationsData = Array.from(stationsMap.values())
        .sort((a, b) => b.totalGas - a.totalGas)
        .map((station) => ({
          ...station,
          totalPayments:
            station.totalCash +
            station.totalHumo +
            station.totalUzcard +
            station.totalElectronic,
          paymentDistribution: {
            cash: station.totalCash,
            humo: station.totalHumo,
            uzcard: station.totalUzcard,
            electronic: station.totalElectronic,
            cashPercentage:
              station.totalPayments > 0
                ? (station.totalCash / station.totalPayments) * 100
                : 0,
            humoPercentage:
              station.totalPayments > 0
                ? (station.totalHumo / station.totalPayments) * 100
                : 0,
            uzcardPercentage:
              station.totalPayments > 0
                ? (station.totalUzcard / station.totalPayments) * 100
                : 0,
            electronicPercentage:
              station.totalPayments > 0
                ? (station.totalElectronic / station.totalPayments) * 100
                : 0,
          },
        }));

      // Общая сводка
      const summary = {
        totalGas: dailyData.reduce((sum, day) => sum + day.totalGas, 0),
        totalCash: dailyData.reduce((sum, day) => sum + day.totalCash, 0),
        totalHumo: dailyData.reduce((sum, day) => sum + day.totalHumo, 0),
        totalUzcard: dailyData.reduce((sum, day) => sum + day.totalUzcard, 0),
        totalElectronic: dailyData.reduce(
          (sum, day) => sum + day.totalElectronic,
          0
        ),
        totalPayments: dailyData.reduce(
          (sum, day) => sum + day.totalPayments,
          0
        ),
        reportsCount: filteredReports.length,
        period: `${formatDate(startDate)} - ${formatDate(endDate)}`,
        rangeType: rangeType,
      };

      return {
        summary,
        dailyData,
        stationsData,
      };
    } catch (error) {
      console.error("Error analyzing gas and payments by date range:", error);
      return {
        summary: {
          totalGas: 0,
          totalCash: 0,
          totalHumo: 0,
          totalUzcard: 0,
          totalElectronic: 0,
          totalPayments: 0,
          reportsCount: 0,
          period: "Ҳисобда хатолик",
        },
        dailyData: [],
        stationsData: [],
      };
    }
  };

  // ОБНОВЛЕННАЯ ОСНОВНАЯ ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ
  const loadAnalysisData = async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);

      let allReports = [];
      let allDocuments = [];

      // Загружаем данные unifiedDailyReports
      try {
        const reportsQuery = query(
          collection(db, "unifiedDailyReports"),
          orderBy("reportDate", "desc")
        );
        const reportsSnapshot = await getDocs(reportsQuery);
        allReports = reportsSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter(
            (report) =>
              managedStations.length === 0 ||
              managedStations.includes(report.stationId)
          );
      } catch (error) {
        setError(`Ҳисобтларни юклашда хатолик: ${error.message}`);
      }

      // Загружаем данные documents
      try {
        const documentsQuery = query(collection(db, "documents"));
        const documentsSnapshot = await getDocs(documentsQuery);
        allDocuments = documentsSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter(
            (doc) =>
              managedStations.length === 0 ||
              managedStations.includes(doc.stationId)
          );
      } catch (error) {}

      // Обновляем отладочную информацию
      setDebugInfo({
        reportsCount: allReports.length,
        documentsCount: allDocuments.length,
        managedStationsCount: managedStations.length,
      });

      // Если нет отчетов, показываем информационное сообщение
      if (allReports.length === 0) {
        setAnalysisData({
          autopilotData: [],
          comparisonData: [],
          negativeDifferenceData: [],
          missingReportsData: [],
          controlDifferenceData: [],
          expiredDocumentsData: [],
          gasAndPaymentsData: [], // НОВЫЙ АНАЛИЗ
        });
        setLoading(false);
        return;
      }

      // Выполняем анализы с учетом фильтров
      const {
        negativeDiffPeriod = "1day",
        missingReportsPeriod = "1day",
        controlDiffPeriod = "yesterday",
        comparisonType = "yesterday",
        autopilotPeriod = "1day",
        gasPaymentsPeriod = "1day", // НОВЫЙ ФИЛЬТР
        gasPaymentsDateRange = null, // НОВЫЙ ФИЛЬТР ДЛЯ ДИАПАЗОНА ДАТ
      } = filters;

      const autopilotData = analyzeAutopilotData(allReports, autopilotPeriod);
      const comparisonData = analyzeComparisonData(allReports, comparisonType);
      const negativeDifferenceData = analyzeNegativeDifference(
        allReports,
        negativeDiffPeriod
      );
      const missingReportsData = await analyzeMissingReports(
        allReports,
        missingReportsPeriod
      );
      const controlDifferenceData = analyzeControlDifference(
        allReports,
        controlDiffPeriod
      );
      const expiredDocumentsData = analyzeExpiredDocuments(allDocuments);

      // НОВЫЙ АНАЛИЗ: Расход газа и поступления платежей
      let gasAndPaymentsData = [];
      if (gasPaymentsDateRange) {
        gasAndPaymentsData = analyzeGasAndPaymentsByDateRange(
          allReports,
          gasPaymentsDateRange
        );
      } else {
        gasAndPaymentsData = analyzeGasAndPayments(
          allReports,
          gasPaymentsPeriod
        );
      }

      setAnalysisData({
        autopilotData,
        comparisonData,
        negativeDifferenceData,
        missingReportsData,
        controlDifferenceData,
        expiredDocumentsData,
        gasAndPaymentsData, // НОВЫЙ АНАЛИЗ
      });
    } catch (error) {
      setError(`Ошибка загрузки данных: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Существующие функции анализов (оставляем без изменений)
  const analyzeAutopilotData = (reports, period = "1day") => {
    const filteredReports = filterReportsByPeriod(reports, period);

    // Группируем отчеты по станциям
    const stationsMap = new Map();

    filteredReports.forEach((report) => {
      const stationId = report.stationId;

      // Используем autopilotReading из generalData (как показала отладка)
      const autopilotReading = report.generalData?.autopilotReading || 0;

      if (!stationsMap.has(stationId)) {
        stationsMap.set(stationId, {
          stationName: report.stationName,
          stationId: stationId,
          totalAutopilot: 0,
          reportsCount: 0,
          latestDate: report.reportDate,
        });
      }

      const stationData = stationsMap.get(stationId);
      stationData.totalAutopilot += autopilotReading;
      stationData.reportsCount += 1;

      // Обновляем самую позднюю дату
      if (new Date(report.reportDate) > new Date(stationData.latestDate)) {
        stationData.latestDate = report.reportDate;
      }
    });

    // Преобразуем в массив и фильтруем станции с данными
    const result = Array.from(stationsMap.values())
      .map((station) => ({
        ...station,
        averageAutopilot:
          station.reportsCount > 0
            ? station.totalAutopilot / station.reportsCount
            : 0,
      }))
      .filter((station) => station.totalAutopilot > 0) // Только станции с данными
      .sort((a, b) => a.totalAutopilot - b.totalAutopilot);

    return result;
  };

  // Анализ 2: Сравнительные данные
  const analyzeComparisonData = (reports, type) => {
    const stationsMap = new Map();

    reports.forEach((report) => {
      if (!stationsMap.has(report.stationId)) {
        stationsMap.set(report.stationId, {
          stationName: report.stationName,
          reports: [],
        });
      }
      stationsMap.get(report.stationId).reports.push(report);
    });

    const comparisonResults = [];

    stationsMap.forEach((stationData, stationId) => {
      stationData.reports.sort(
        (a, b) => new Date(b.reportDate) - new Date(a.reportDate)
      );

      if (stationData.reports.length >= 2) {
        const latestReport = stationData.reports[0];
        const previousReport = stationData.reports[1];

        const currentValue = latestReport.hoseTotalGas || 0;
        const previousValue = previousReport.hoseTotalGas || 0;
        const difference = currentValue - previousValue;
        const percentageChange =
          previousValue !== 0 ? (difference / previousValue) * 100 : 0;

        comparisonResults.push({
          stationName: stationData.stationName,
          currentValue,
          previousValue,
          difference,
          percentageChange,
          currentDate: latestReport.reportDate,
          previousDate: previousReport.reportDate,
        });
      }
    });

    return comparisonResults.sort((a, b) => b.difference - a.difference);
  };

  // Анализ 3: Отрицательная разница с периодами
  const analyzeNegativeDifference = (reports, period) => {
    const filteredReports = filterReportsByPeriod(reports, period);
    const latestReports = getLatestReportsByPeriod(filteredReports, period);

    const negativeReports = latestReports
      .filter((report) => {
        const autopilot = report.generalData?.autopilotReading || 0;
        const hoseTotal = report.hoseTotalGas || 0;
        const difference = hoseTotal - autopilot;

        return difference < 0;
      })
      .map((report) => {
        const autopilot = report.generalData?.autopilotReading || 0;

        return {
          stationName: report.stationName,
          autopilotReading: autopilot,
          hoseTotalGas: report.hoseTotalGas || 0,
          difference: (report.hoseTotalGas || 0) - autopilot,
          reportDate: report.reportDate,
          stationId: report.stationId,
        };
      })
      .sort((a, b) => a.difference - b.difference);

    return negativeReports;
  };

  // Анализ 4: Отсутствующие отчеты с периодами - ИСПРАВЛЕННАЯ ВЕРСИЯ
  const analyzeMissingReports = async (reports, period) => {
    try {
      // Получаем даты для проверки
      const datesToCheck = getDatesForPeriod(period);
      const allStations = await getAllStations();

      // Получаем последнюю дату отчета из загруженных данных
      const lastReportDate =
        reports.length > 0
          ? reports.reduce((latest, report) => {
              return report.reportDate > latest ? report.reportDate : latest;
            }, reports[0].reportDate)
          : null;

      const missingReports = [];

      // Для каждой даты в периоде проверяем отсутствующие отчеты
      datesToCheck.forEach((date) => {
        const stationsWithReports = new Set(
          reports
            .filter((report) => report.reportDate === date)
            .map((report) => report.stationId)
        );

        // Для учредителя (managedStations пустой) проверяем все станции
        const stationsToCheck =
          managedStations.length > 0
            ? managedStations
            : allStations.map((station) => station.id);

        const stationsMissing = stationsToCheck
          .filter((stationId) => !stationsWithReports.has(stationId))
          .map((stationId) => {
            const station = allStations.find((s) => s.id === stationId);
            return {
              stationName:
                station?.stationName ||
                `Станция ${stationId.substring(0, 8)}...`,
              stationId: stationId,
              missingDate: date,
              period: period,
            };
          });

        missingReports.push(...stationsMissing);
      });

      // Убираем дубликаты
      const uniqueStations = new Map();
      missingReports.forEach((report) => {
        const key = `${report.stationId}-${report.missingDate}`;
        if (!uniqueStations.has(key)) {
          uniqueStations.set(key, report);
        }
      });

      const result = Array.from(uniqueStations.values());

      return result;
    } catch (error) {
      return [];
    }
  };

  // Анализ 5: Разница контрольных сумм с периодами - ИСПРАВЛЕННАЯ ВЕРСИЯ
  const analyzeControlDifference = (reports, period) => {
    const filteredReports = filterReportsByPeriod(reports, period);

    const problematicReports = filteredReports
      .filter((report) => {
        const generalData = report.generalData || {};

        const cashAmount = generalData.cashAmount || 0;
        const humoTerminal = generalData.humoTerminal || 0;
        const uzcardTerminal = generalData.uzcardTerminal || 0;
        const electronicPaymentSystem =
          generalData.electronicPaymentSystem || 0;

        const controlTotalSum = generalData.controlTotalSum || 0;
        const controlHumoSum = generalData.controlHumoSum || 0;
        const controlUzcardSum = generalData.controlUzcardSum || 0;
        const controlElectronicSum = generalData.controlElectronicSum || 0;

        // Сначала определяем разницы
        const cashDiff = cashAmount - controlTotalSum;
        const humoDiff = humoTerminal - controlHumoSum;
        const uzcardDiff = uzcardTerminal - controlUzcardSum;
        const electronicDiff = electronicPaymentSystem - controlElectronicSum;

        const hasMissingControlSums =
          (cashAmount > 0 && controlTotalSum === 0) ||
          (humoTerminal > 0 && controlHumoSum === 0) ||
          (uzcardTerminal > 0 && controlUzcardSum === 0) ||
          (electronicPaymentSystem > 0 && controlElectronicSum === 0);

        const hasNegativeDifference =
          cashDiff > 0 || humoDiff > 0 || uzcardDiff > 0 || electronicDiff > 0;

        return hasMissingControlSums || hasNegativeDifference;
      })
      .map((report) => {
        const generalData = report.generalData || {};

        const cashAmount = generalData.cashAmount || 0;
        const humoTerminal = generalData.humoTerminal || 0;
        const uzcardTerminal = generalData.uzcardTerminal || 0;
        const electronicPaymentSystem = generalData.eternalPaymentSystem || 0;

        const controlTotalSum = generalData.controlTotalSum || 0;
        const controlHumoSum = generalData.controlHumoSum || 0;
        const controlUzcardSum = generalData.controlUzcardSum || 0;
        const controlElectronicSum = generalData.controlElectronicSum || 0;

        // Определяем разницы для использования в маппинге
        const cashDiff = cashAmount - controlTotalSum;
        const humoDiff = humoTerminal - controlHumoSum;
        const uzcardDiff = uzcardTerminal - controlUzcardSum;
        const electronicDiff = electronicPaymentSystem - controlElectronicSum;

        const problems = [];

        // Проверяем отсутствие контрольных сумм
        if (cashAmount > 0 && controlTotalSum === 0)
          problems.push("cash_missing");
        if (humoTerminal > 0 && controlHumoSum === 0)
          problems.push("humo_missing");
        if (uzcardTerminal > 0 && controlUzcardSum === 0)
          problems.push("uzcard_missing");
        if (electronicPaymentSystem > 0 && controlElectronicSum === 0)
          problems.push("electronic_missing");

        // Проверяем отрицательную разницу
        if (cashAmount > controlTotalSum && controlTotalSum > 0)
          problems.push("cash_negative");
        if (humoTerminal > controlHumoSum && controlHumoSum > 0)
          problems.push("humo_negative");
        if (uzcardTerminal > controlUzcardSum && controlUzcardSum > 0)
          problems.push("uzcard_negative");
        if (
          electronicPaymentSystem > controlElectronicSum &&
          controlElectronicSum > 0
        )
          problems.push("electronic_negative");

        return {
          stationName: report.stationName,
          reportDate: report.reportDate,
          stationId: report.stationId,
          differences: {
            cash: cashDiff,
            humo: humoDiff,
            uzcard: uzcardDiff,
            electronic: electronicDiff,
          },
          amounts: {
            cash: cashAmount,
            humo: humoTerminal,
            uzcard: uzcardTerminal,
            electronic: electronicPaymentSystem,
          },
          controlAmounts: {
            cash: controlTotalSum,
            humo: controlHumoSum,
            uzcard: controlUzcardSum,
            electronic: controlElectronicSum,
          },
          problems: problems,
          generalData: generalData,
        };
      });

    return problematicReports;
  };

  // Анализ 6: Просроченные документы
  const analyzeExpiredDocuments = (documents) => {
    const today = new Date();
    const expiredDocs = documents.filter((doc) => {
      if (!doc.expiryDate) return false;
      const expiryDate = new Date(doc.expiryDate);
      return expiryDate < today;
    });

    const stationsMap = new Map();
    expiredDocs.forEach((doc) => {
      if (!stationsMap.has(doc.stationId)) {
        stationsMap.set(doc.stationId, {
          stationName: doc.stationName,
          documents: [],
        });
      }
      const stationData = stationsMap.get(doc.stationId);
      const expiryDate = new Date(doc.expiryDate);
      const daysOverdue = Math.floor(
        (today - expiryDate) / (1000 * 60 * 60 * 24)
      );

      stationData.documents.push({
        docType: doc.docType,
        expiryDate: doc.expiryDate,
        daysOverdue: daysOverdue,
        docNumber: doc.docNumber,
        issueDate: doc.issueDate,
      });
    });

    return Array.from(stationsMap.values());
  };

  // Загружаем данные при изменении managedStations - ИСПРАВЛЕННЫЙ useEffect
  useEffect(() => {
    // Проверяем, изменились ли managedStations или это первая загрузка
    const prevStations = prevManagedStationsRef.current;
    const stationsChanged =
      JSON.stringify(prevStations) !== JSON.stringify(managedStations);

    if (isInitialLoadRef.current || stationsChanged) {
      loadAnalysisData();

      // Обновляем рефы
      prevManagedStationsRef.current = managedStations;
      isInitialLoadRef.current = false;
    }
  }, [managedStations]);

  return {
    analysisData,
    loading,
    error,
    loadAnalysisData,
    refreshData: () => loadAnalysisData(),
    debugInfo,
  };
};

// Хелпер функция для отображения периодов - ОБНОВЛЕНА
export const getPeriodDisplayName = (period) => {
  const periodNames = {
    "1day": "за 1 день",
    "7days": "за 7 дней",
    "1month": "за месяц",
    "6months": "за полгода",
    "1year": "за год",
    yesterday: "за вчерашний день",
  };
  return periodNames[period] || period;
};
