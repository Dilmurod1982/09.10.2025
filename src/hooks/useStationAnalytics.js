// hooks/useStationAnalytics.js
import { useState, useEffect, useRef, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
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
  return (
    new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num) + " сўм"
  );
};

// Функция для определения квартала по дате
const getQuarterForDate = (dateString) => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();

  if (month >= 1 && month <= 3) return "I";
  if (month >= 4 && month <= 6) return "II";
  if (month >= 7 && month <= 9) return "III";
  return "IV";
};

// Функция для получения названия коллекции
const getCollectionName = (dateString) => {
  const quarter = getQuarterForDate(dateString);
  const year = new Date(dateString).getFullYear();
  return `unifiedDailyReports_${quarter}_${year}`;
};

// Функция для получения коллекций за период
const getCollectionsForPeriod = (startDate, endDate) => {
  const collections = new Set();
  const currentDate = new Date(startDate);
  const end = new Date(endDate);

  // Добавляем коллекцию для начала периода
  const startCollection = getCollectionName(startDate);
  collections.add(startCollection);

  // Добавляем коллекцию для конца периода
  const endCollection = getCollectionName(endDate);
  collections.add(endCollection);

  // Добавляем возможные промежуточные коллекции
  const tempDate = new Date(currentDate);
  while (tempDate <= end) {
    const collectionName = getCollectionName(
      tempDate.toISOString().split("T")[0]
    );
    collections.add(collectionName);
    tempDate.setMonth(tempDate.getMonth() + 3); // Следующий квартал
  }

  return Array.from(collections);
};

// Функция для загрузки отчетов из всех необходимых коллекций
const loadReportsFromCollections = async (stationIds, startDate, endDate) => {
  try {
    // Если нет станций, возвращаем пустой массив
    if (!stationIds || stationIds.length === 0) {
      return [];
    }

    // Получаем список коллекций за период
    const collections = getCollectionsForPeriod(startDate, endDate);

    const allReports = [];

    // Загружаем из каждой коллекции
    for (const collectionName of collections) {
      try {
        // Загружаем все документы из коллекции
        const reportsRef = collection(db, collectionName);
        const snapshot = await getDocs(reportsRef);

        // Фильтруем по станциям и дате
        snapshot.forEach((doc) => {
          const data = doc.data();
          const reportDate = data.reportDate;
          const dataStationId = data.stationId;

          // Проверяем дату
          const isDateInRange =
            reportDate >= startDate && reportDate <= endDate;

          // Проверяем станцию
          const isStationIncluded = stationIds.includes(dataStationId);

          if (isDateInRange && isStationIncluded) {
            allReports.push({
              id: doc.id,
              collection: collectionName,
              ...data,
            });
          }
        });
      } catch (err) {
        console.warn(
          `Ошибка при загрузке коллекции ${collectionName}:`,
          err.message
        );
      }
    }

    // Также проверяем старую коллекцию для обратной совместимости
    try {
      const oldCollectionRef = collection(db, "unifiedDailyReports");
      const oldSnapshot = await getDocs(oldCollectionRef);

      oldSnapshot.forEach((doc) => {
        const data = doc.data();
        const reportDate = data.reportDate;
        const dataStationId = data.stationId;

        const isDateInRange = reportDate >= startDate && reportDate <= endDate;
        const isStationIncluded = stationIds.includes(dataStationId);

        if (isDateInRange && isStationIncluded) {
          allReports.push({
            id: doc.id,
            collection: "unifiedDailyReports",
            ...data,
          });
        }
      });
    } catch (err) {
      console.warn("Ошибка при загрузке старой коллекции:", err.message);
    }

    return allReports;
  } catch (error) {
    console.error("Ошибка при загрузке отчетов:", error);
    return [];
  }
};

// Функция для получения суммы наличных
const getCashAmount = (report) => {
  // Новая структура paymentData
  if (report.paymentData && report.paymentData.zhisobot !== undefined) {
    return report.paymentData.zhisobot || 0;
  }
  // Старая структура generalData
  return report.generalData?.cashAmount || 0;
};

// Функция для получения суммы Humo
const getHumoAmount = (report) => {
  // Новая структура paymentData
  if (report.paymentData && report.paymentData.humo !== undefined) {
    return report.paymentData.humo || 0;
  }
  // Старая структура generalData
  return report.generalData?.humoTerminal || 0;
};

// Функция для получения суммы Uzcard
const getUzcardAmount = (report) => {
  // Новая структура paymentData
  if (report.paymentData && report.paymentData.uzcard !== undefined) {
    return report.paymentData.uzcard || 0;
  }
  // Старая структура generalData
  return report.generalData?.uzcardTerminal || 0;
};

// Функция для получения суммы электронных платежей (Click, PayMe, PayNet)
const getElectronicPayments = (report) => {
  const paymentData = report.paymentData || {};
  const generalData = report.generalData || {};

  let total = 0;

  // Суммируем все электронные платежи из paymentData
  if (paymentData.click) total += paymentData.click;
  if (paymentData.payme) total += paymentData.payme;
  if (paymentData.paynet) total += paymentData.paynet;

  // Если есть электронная платежная система в старых данных
  if (paymentData.electronicPaymentSystem) {
    total += paymentData.electronicPaymentSystem;
  }

  // Старая структура для обратной совместимости
  if (total === 0 && generalData.electronicPaymentSystem) {
    total = generalData.electronicPaymentSystem;
  }

  return total;
};

// Функция для получения общей суммы всех платежей
const getTotalPayments = (report) => {
  const cash = getCashAmount(report);
  const humo = getHumoAmount(report);
  const uzcard = getUzcardAmount(report);
  const electronic = getElectronicPayments(report);

  return cash + humo + uzcard + electronic;
};

// Функция для получения контрольной суммы из отчета
const getControlSum = (report) => {
  const generalData = report.generalData || {};

  // Суммируем все контрольные суммы
  let total = 0;

  if (generalData.controlTotalSum) total += generalData.controlTotalSum;
  if (generalData.controlHumoSum) total += generalData.controlHumoSum;
  if (generalData.controlUzcardSum) total += generalData.controlUzcardSum;
  if (generalData.controlClickSum) total += generalData.controlClickSum;
  if (generalData.controlPaymeSum) total += generalData.controlPaymeSum;
  if (generalData.controlPaynetSum) total += generalData.controlPaynetSum;
  if (generalData.controlElectronicSum)
    total += generalData.controlElectronicSum;

  // Если есть прямая контрольная сумма
  if (generalData.controlSum) total = generalData.controlSum;

  return total;
};

export const useStationAnalytics = (managedStations = []) => {
  const [analysisData, setAnalysisData] = useState({
    autopilotData: [],
    comparisonData: [],
    negativeDifferenceData: [],
    missingReportsData: [],
    controlDifferenceData: [],
    expiredDocumentsData: [],
    gasAndPaymentsData: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({
    reportsCount: 0,
    documentsCount: 0,
    managedStationsCount: managedStations.length,
    loadedCollections: [],
    lastLoadTime: null,
  });

  // Для отслеживания загрузки
  const isMountedRef = useRef(true);
  const isLoadingRef = useRef(false);
  const lastLoadRef = useRef(0);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Вспомогательные функции для периодов
  const filterReportsByPeriod = (reports, period) => {
    const today = new Date();
    let startDate = new Date();

    // Сбрасываем время для корректного сравнения дат
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    switch (period) {
      case "1day":
      case "yesterday":
        startDate.setDate(today.getDate() - 1);
        break;
      case "2days":
        startDate.setDate(today.getDate() - 2);
        break;
      case "3days":
        startDate.setDate(today.getDate() - 3);
        break;
      case "7days":
        startDate.setDate(today.getDate() - 7);
        break;
      case "30days":
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
        startDate.setDate(today.getDate() - 7); // По умолчанию 7 дней
    }

    const startDateStr = startDate.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    const filtered = reports.filter(
      (report) =>
        report.reportDate >= startDateStr && report.reportDate <= todayStr
    );

    return filtered;
  };

  const getDatesForPeriod = (period) => {
    const dates = [];
    const today = new Date();
    let daysBack = 1;

    switch (period) {
      case "1day":
        daysBack = 1;
        break;
      case "2days":
        daysBack = 2;
        break;
      case "3days":
        daysBack = 3;
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

    for (let i = 0; i <= daysBack; i++) {
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
      const stationsRef = collection(db, "stations");
      const stationsSnapshot = await getDocs(stationsRef);
      const stations = stationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      return stations;
    } catch (error) {
      console.error("Ошибка при загрузке станций:", error);
      return [];
    }
  };

  // Упрощенная функция анализа расхода газа
  const analyzeGasAndPayments = (reports, period = "30days") => {
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
        const stationName = report.stationName || `Станция ${stationId}`;

        if (!stationsMap.has(stationId)) {
          stationsMap.set(stationId, {
            stationName: stationName,
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
        const gas = report.hoseTotalGas || 0;
        const cash = getCashAmount(report);
        const humo = getHumoAmount(report);
        const uzcard = getUzcardAmount(report);
        const electronic = getElectronicPayments(report);

        stationData.totalGas += gas;
        stationData.totalCash += cash;
        stationData.totalHumo += humo;
        stationData.totalUzcard += uzcard;
        stationData.totalElectronic += electronic;
        stationData.reportsCount += 1;
      });

      // Преобразуем в массив
      const result = Array.from(stationsMap.values()).map((station) => {
        const totalPayments =
          station.totalCash +
          station.totalHumo +
          station.totalUzcard +
          station.totalElectronic;

        // Рассчитываем проценты
        const total = totalPayments > 0 ? totalPayments : 1; // избегаем деления на 0

        const paymentDistribution = {
          cashPercentage: (station.totalCash / total) * 100,
          humoPercentage: (station.totalHumo / total) * 100,
          uzcardPercentage: (station.totalUzcard / total) * 100,
          electronicPercentage: (station.totalElectronic / total) * 100,
        };

        return {
          ...station,
          totalPayments,
          paymentDistribution,
        };
      });

      return result.sort((a, b) => b.totalGas - a.totalGas);
    } catch (error) {
      console.error("Ошибка анализа расхода газа:", error);
      return [];
    }
  };

  // ОСНОВНАЯ ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ
  const loadAnalysisData = useCallback(
    async (filters = {}) => {
      // Защита от множественных вызовов
      const currentTime = Date.now();
      if (isLoadingRef.current && currentTime - lastLoadRef.current < 1000) {
        return;
      }

      if (!isMountedRef.current) return;

      try {
        isLoadingRef.current = true;
        lastLoadRef.current = currentTime;

        // Если нет управляемых станций, сбрасываем данные
        if (!managedStations || managedStations.length === 0) {
          if (isMountedRef.current) {
            setAnalysisData({
              autopilotData: [],
              comparisonData: [],
              negativeDifferenceData: [],
              missingReportsData: [],
              controlDifferenceData: [],
              expiredDocumentsData: [],
              gasAndPaymentsData: [],
            });
            setDebugInfo((prev) => ({
              ...prev,
              reportsCount: 0,
              documentsCount: 0,
              lastLoadTime: new Date().toISOString(),
            }));
            setLoading(false);
          }
          isLoadingRef.current = false;
          return;
        }

        if (isMountedRef.current) {
          setLoading(true);
          setError(null);
        }

        // Получаем даты для периода (по умолчанию последние 30 дней)
        const currentDate = new Date();
        const today = currentDate.toISOString().split("T")[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const startDateStr = startDate.toISOString().split("T")[0];

        // Загружаем отчеты из квартальных коллекций
        let allReports = [];
        let allDocuments = [];

        try {
          allReports = await loadReportsFromCollections(
            managedStations,
            startDateStr,
            today
          );
        } catch (error) {
          console.error("Ошибка при загрузке отчетов:", error);
          if (isMountedRef.current) {
            setError(`Ҳисоботларни юклашда хатолик: ${error.message}`);
          }
        }

        // Загружаем данные documents
        try {
          const documentsRef = collection(db, "documents");
          const documentsSnapshot = await getDocs(documentsRef);
          allDocuments = documentsSnapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))
            .filter((doc) => managedStations.includes(doc.stationId));
        } catch (error) {
          console.error("Ошибка при загрузке документов:", error);
        }

        // Обновляем отладочную информацию
        const uniqueCollections = [
          ...new Set(allReports.map((r) => r.collection)),
        ];

        const debugInfoUpdate = {
          reportsCount: allReports.length,
          documentsCount: allDocuments.length,
          managedStationsCount: managedStations.length,
          loadedCollections: uniqueCollections,
          lastLoadTime: new Date().toISOString(),
        };

        if (isMountedRef.current) {
          setDebugInfo(debugInfoUpdate);
        }

        // Если нет отчетов, устанавливаем пустые данные
        if (allReports.length === 0) {
          if (isMountedRef.current) {
            setAnalysisData({
              autopilotData: [],
              comparisonData: [],
              negativeDifferenceData: [],
              missingReportsData: [],
              controlDifferenceData: [],
              expiredDocumentsData: [],
              gasAndPaymentsData: [],
            });
            setLoading(false);
          }
          isLoadingRef.current = false;
          return;
        }

        // Выполняем анализы с учетом фильтров
        const {
          negativeDiffPeriod = "30days",
          missingReportsPeriod = "30days",
          controlDiffPeriod = "30days",
          comparisonType = "30days",
          autopilotPeriod = "30days",
          gasPaymentsPeriod = "30days",
          gasPaymentsDateRange = null,
        } = filters;

        // Выполняем анализы
        const autopilotData = analyzeAutopilotData(allReports, autopilotPeriod);
        const comparisonData = analyzeComparisonData(
          allReports,
          comparisonType
        );
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
        const expiredDocumentsData = await analyzeExpiredDocuments(
          allDocuments
        );

        // Анализ расхода газа
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

        if (isMountedRef.current) {
          setAnalysisData({
            autopilotData,
            comparisonData,
            negativeDifferenceData,
            missingReportsData,
            controlDifferenceData,
            expiredDocumentsData,
            gasAndPaymentsData,
          });
          setLoading(false);
        }
      } catch (error) {
        console.error("Критическая ошибка загрузки данных:", error);
        if (isMountedRef.current) {
          setError(`Ошибка загрузки данных: ${error.message}`);
          setLoading(false);
        }
      } finally {
        isLoadingRef.current = false;
      }
    },
    [managedStations]
  );

  // Анализ 1: AutoPilot данные
  const analyzeAutopilotData = (reports, period = "1day") => {
    try {
      const filteredReports = filterReportsByPeriod(reports, period);
      const stationsMap = new Map();

      filteredReports.forEach((report) => {
        const stationId = report.stationId;
        const autopilotReading = report.generalData?.autopilotReading || 0;

        if (autopilotReading > 0) {
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

          if (new Date(report.reportDate) > new Date(stationData.latestDate)) {
            stationData.latestDate = report.reportDate;
          }
        }
      });

      const result = Array.from(stationsMap.values())
        .map((station) => ({
          ...station,
          averageAutopilot:
            station.reportsCount > 0
              ? station.totalAutopilot / station.reportsCount
              : 0,
        }))
        .sort((a, b) => b.totalAutopilot - a.totalAutopilot);

      return result;
    } catch (error) {
      console.error("Ошибка анализа AutoPilot данных:", error);
      return [];
    }
  };

  // Анализ 2: Сравнительные данные
  const analyzeComparisonData = (reports, type) => {
    try {
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

          comparisonResults.push({
            stationName: stationData.stationName,
            currentValue,
            previousValue,
            difference,
            percentageChange:
              previousValue !== 0 ? (difference / previousValue) * 100 : 0,
            currentDate: latestReport.reportDate,
            previousDate: previousReport.reportDate,
            stationId: stationId,
          });
        }
      });

      return comparisonResults.sort((a, b) => b.difference - a.difference);
    } catch (error) {
      console.error("Ошибка анализа сравнения:", error);
      return [];
    }
  };

  // Анализ 3: Отрицательная разница
  const analyzeNegativeDifference = (reports, period) => {
    try {
      const filteredReports = filterReportsByPeriod(reports, period);
      const latestReports = getLatestReportsByPeriod(filteredReports, period);

      const negativeReports = latestReports
        .filter((report) => {
          const autopilot = report.generalData?.autopilotReading || 0;
          const hoseTotal = report.hoseTotalGas || 0;
          return hoseTotal - autopilot < 0;
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
        });

      return negativeReports.sort((a, b) => a.difference - b.difference);
    } catch (error) {
      console.error("Ошибка анализа отрицательной разницы:", error);
      return [];
    }
  };

  // Анализ 4: Отсутствующие отчеты
  const analyzeMissingReports = async (reports, period) => {
    try {
      const datesToCheck = getDatesForPeriod(period);
      const allStations = await getAllStations();
      const missingReports = [];

      datesToCheck.forEach((date) => {
        const stationsWithReports = new Set(
          reports
            .filter((report) => report.reportDate === date)
            .map((report) => report.stationId)
        );

        managedStations.forEach((stationId) => {
          if (!stationsWithReports.has(stationId)) {
            const station = allStations.find((s) => s.id === stationId);
            missingReports.push({
              stationName:
                station?.stationName ||
                `Станция ${stationId.substring(0, 8)}...`,
              stationId: stationId,
              missingDate: date,
              period: period,
            });
          }
        });
      });

      // Убираем дубликаты
      const uniqueStations = new Map();
      missingReports.forEach((report) => {
        const key = `${report.stationId}-${report.missingDate}`;
        if (!uniqueStations.has(key)) {
          uniqueStations.set(key, report);
        }
      });

      return Array.from(uniqueStations.values());
    } catch (error) {
      console.error("Ошибка анализа отсутствующих отчетов:", error);
      return [];
    }
  };

  // Анализ 5: Разница контрольных сумм - ИСПРАВЛЕННАЯ ВЕРСИЯ
  const analyzeControlDifference = (reports, period) => {
    try {
      const filteredReports = filterReportsByPeriod(reports, period);
      const problematicReports = [];

      filteredReports.forEach((report) => {
        // Получаем фактические суммы платежей из отчета
        const cashAmount = getCashAmount(report);
        const humoAmount = getHumoAmount(report);
        const uzcardAmount = getUzcardAmount(report);
        const electronicAmount = getElectronicPayments(report);

        // Общая сумма фактических платежей
        const totalActualPayments =
          cashAmount + humoAmount + uzcardAmount + electronicAmount;

        // Получаем контрольную сумму из отчета
        const controlSum = getControlSum(report);

        // Рассчитываем разницу
        const difference = totalActualPayments - controlSum;

        // Определяем, есть ли значительная разница (больше 100 сомов)
        const hasSignificantDifference = Math.abs(difference) > 100;

        // Если есть значительная разница, добавляем в отчет
        if (hasSignificantDifference) {
          problematicReports.push({
            stationName:
              report.stationName ||
              `Станция ${report.stationId?.substring(0, 8)}...`,
            reportDate: report.reportDate,
            stationId: report.stationId,

            // Фактические суммы
            cashAmount: cashAmount,
            humoAmount: humoAmount,
            uzcardAmount: uzcardAmount,
            electronicAmount: electronicAmount,
            totalPayments: totalActualPayments,

            // Контрольная сумма
            controlSum: controlSum,

            // Разница
            difference: difference,

            // Процентное соотношение
            percentage: controlSum > 0 ? (difference / controlSum) * 100 : 0,
          });
        }
      });

      // Сортируем по наибольшей разнице
      return problematicReports.sort(
        (a, b) => Math.abs(b.difference) - Math.abs(a.difference)
      );
    } catch (error) {
      console.error("Ошибка анализа контрольных сумм:", error);
      return [];
    }
  };

  // Анализ 6: Просроченные документы
  const analyzeExpiredDocuments = async (documents) => {
    try {
      const today = new Date();
      const expiredDocs = documents.filter((doc) => {
        if (!doc.expiryDate) return false;
        return new Date(doc.expiryDate) < today;
      });

      // Загружаем типы документов для маппинга
      let documentTypesMap = new Map();
      try {
        const docTypesRef = collection(db, "document_types");
        const docTypesSnapshot = await getDocs(docTypesRef);
        docTypesSnapshot.forEach((doc) => {
          const data = doc.data();
          documentTypesMap.set(doc.id, data.name || doc.id);
        });
      } catch (error) {
        console.warn("Не удалось загрузить типы документов:", error);
      }

      const stationsMap = new Map();
      expiredDocs.forEach((doc) => {
        if (!stationsMap.has(doc.stationId)) {
          stationsMap.set(doc.stationId, {
            stationName: doc.stationName,
            stationId: doc.stationId,
            documents: [],
          });
        }

        const stationData = stationsMap.get(doc.stationId);
        const expiryDate = new Date(doc.expiryDate);
        const daysOverdue = Math.floor(
          (today - expiryDate) / (1000 * 60 * 60 * 24)
        );

        const docTypeName = documentTypesMap.get(doc.docType) || doc.docType;

        stationData.documents.push({
          docType: docTypeName,
          originalDocType: doc.docType,
          expiryDate: doc.expiryDate,
          daysOverdue,
          docNumber: doc.docNumber,
          issueDate: doc.issueDate,
          description: doc.description || "",
        });
      });

      return Array.from(stationsMap.values());
    } catch (error) {
      console.error("Ошибка анализа просроченных документов:", error);
      return [];
    }
  };

  // Новая функция анализа по диапазону дат
  const analyzeGasAndPaymentsByDateRange = (reports, dateRange) => {
    try {
      const { startDate, endDate } = dateRange;
      const filteredReports = reports.filter((report) => {
        const reportDate = new Date(report.reportDate);
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
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

      // Простая группировка
      const summary = {
        totalGas: filteredReports.reduce(
          (sum, r) => sum + (r.hoseTotalGas || 0),
          0
        ),
        totalCash: filteredReports.reduce(
          (sum, r) => sum + getCashAmount(r),
          0
        ),
        totalHumo: filteredReports.reduce(
          (sum, r) => sum + getHumoAmount(r),
          0
        ),
        totalUzcard: filteredReports.reduce(
          (sum, r) => sum + getUzcardAmount(r),
          0
        ),
        totalElectronic: filteredReports.reduce(
          (sum, r) => sum + getElectronicPayments(r),
          0
        ),
        totalPayments: filteredReports.reduce(
          (sum, r) => sum + getTotalPayments(r),
          0
        ),
        reportsCount: filteredReports.length,
        period: `${formatDate(startDate)} - ${formatDate(endDate)}`,
      };

      return {
        summary,
        dailyData: [],
        stationsData: [],
      };
    } catch (error) {
      console.error("Ошибка анализа по диапазону дат:", error);
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

  // Загружаем данные при изменении managedStations
  useEffect(() => {
    if (!managedStations || managedStations.length === 0) {
      setLoading(false);
      return;
    }

    // Задержка для предотвращения двойной загрузки
    const timer = setTimeout(() => {
      loadAnalysisData();
    }, 100);

    return () => clearTimeout(timer);
  }, [managedStations, loadAnalysisData]);

  return {
    analysisData,
    loading,
    error,
    loadAnalysisData,
    refreshData: () => loadAnalysisData(),
    debugInfo,
  };
};

// Хелпер функция для отображения периодов
export const getPeriodDisplayName = (period) => {
  const periodNames = {
    "1day": "1 кунликда",
    "2days": "2 кунликда",
    "3days": "3 кунликда",
    "7days": "7 кунликда",
    "30days": "30 кунликда",
    "1month": "Бир ойда",
    "6months": "Ярим йилликда",
    "1year": "Бир йилликда",
    yesterday: "Кечаги кунга",
  };
  return periodNames[period] || period;
};
