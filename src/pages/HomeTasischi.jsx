import React, { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { motion } from "framer-motion";

// Вспомогательные функции вынесены за пределы компонента
const formatDate = (dateString) => {
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
    console.error("Error formatting date:", error, dateString);
    return dateString;
  }
};

const formatNumber = (num) => {
  return new Intl.NumberFormat("ru-RU").format(num);
};

const formatCurrency = (num) => {
  return new Intl.NumberFormat("ru-RU").format(num) + " ₽";
};

const HomeTasischi = () => {
  const [analysisData, setAnalysisData] = useState({
    autopilotData: [],
    comparisonData: [],
    negativeDifferenceData: [],
    missingReportsData: [],
    controlDifferenceData: [],
    expiredDocumentsData: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [comparisonType, setComparisonType] = useState("yesterday");

  // Новые состояния для выпадающих меню
  const [negativeDiffPeriod, setNegativeDiffPeriod] = useState("1day");
  const [missingReportsPeriod, setMissingReportsPeriod] = useState("1day");
  const [controlDiffPeriod, setControlDiffPeriod] = useState("yesterday");

  // Загрузка всех данных для анализа
  useEffect(() => {
    loadAnalysisData();
  }, [negativeDiffPeriod, missingReportsPeriod, controlDiffPeriod]);

  const loadAnalysisData = async () => {
    try {
      setLoading(true);

      // Загружаем данные unifiedDailyReports
      const reportsQuery = query(
        collection(db, "unifiedDailyReports"),
        orderBy("reportDate", "desc")
      );
      const reportsSnapshot = await getDocs(reportsQuery);
      const allReports = reportsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Загружаем данные documents
      const documentsQuery = query(collection(db, "documents"));
      const documentsSnapshot = await getDocs(documentsQuery);
      const allDocuments = documentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Анализ 1: Станции по autopilotReading
      const autopilotData = analyzeAutopilotData(allReports);

      // Анализ 2: Сравнительные данные
      const comparisonData = analyzeComparisonData(allReports, comparisonType);

      // Анализ 3: Отрицательная разница с периодом
      const negativeDifferenceData = analyzeNegativeDifference(
        allReports,
        negativeDiffPeriod
      );

      // Анализ 4: Отсутствующие отчеты с периодом
      const missingReportsData = await analyzeMissingReports(
        allReports,
        missingReportsPeriod
      );

      // Анализ 5: Разница контрольных сумм с периодом - ОБНОВЛЕННАЯ ВЕРСИЯ
      const controlDifferenceData = analyzeControlDifference(
        allReports,
        controlDiffPeriod
      );

      // Анализ 6: Просроченные документы
      const expiredDocumentsData = analyzeExpiredDocuments(allDocuments);

      setAnalysisData({
        autopilotData,
        comparisonData,
        negativeDifferenceData,
        missingReportsData,
        controlDifferenceData,
        expiredDocumentsData,
      });
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
    } finally {
      setLoading(false);
    }
  };

  // Анализ 1: Станции по autopilotReading
  const analyzeAutopilotData = (reports) => {
    const latestReports = getLatestReports(reports);
    return latestReports
      .map((report) => ({
        stationName: report.stationName,
        autopilotReading: report.generalData?.autopilotReading || 0,
        reportDate: report.reportDate,
        stationId: report.stationId,
      }))
      .sort((a, b) => a.autopilotReading - b.autopilotReading);
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

    return latestReports
      .filter((report) => {
        const autopilot = report.generalData?.autopilotReading || 0;
        const hoseTotal = report.hoseTotalGas || 0;
        return hoseTotal - autopilot < 0;
      })
      .map((report) => ({
        stationName: report.stationName,
        autopilotReading: report.generalData?.autopilotReading || 0,
        hoseTotalGas: report.hoseTotalGas || 0,
        difference:
          (report.hoseTotalGas || 0) -
          (report.generalData?.autopilotReading || 0),
        reportDate: report.reportDate,
        stationId: report.stationId,
      }))
      .sort((a, b) => a.difference - b.difference);
  };

  // Анализ 4: Отсутствующие отчеты с периодами
  const analyzeMissingReports = async (reports, period) => {
    const datesToCheck = getDatesForPeriod(period);
    const allStations = await getAllStations();

    const missingReports = [];

    datesToCheck.forEach((date) => {
      const stationsWithReports = new Set(
        reports
          .filter((report) => report.reportDate === date)
          .map((report) => report.stationId)
      );

      const stationsMissing = allStations
        .filter((station) => !stationsWithReports.has(station.id))
        .map((station) => ({
          stationName: station.stationName,
          stationId: station.id,
          missingDate: date,
          period: period,
        }));

      missingReports.push(...stationsMissing);
    });

    // Убираем дубликаты (если станция отсутствует в нескольких датах)
    const uniqueStations = new Map();
    missingReports.forEach((report) => {
      if (!uniqueStations.has(report.stationId)) {
        uniqueStations.set(report.stationId, report);
      }
    });

    return Array.from(uniqueStations.values());
  };

  // Анализ 5: Разница контрольных сумм с периодами - ОБНОВЛЕННАЯ ВЕРСИЯ
  const analyzeControlDifference = (reports, period) => {
    const filteredReports = filterReportsByPeriod(reports, period);

    const problematicReports = filteredReports
      .filter((report) => {
        const generalData = report.generalData || {};

        // Получаем значения, заменяем undefined/null на 0
        const cashAmount = generalData.cashAmount || 0;
        const humoTerminal = generalData.humoTerminal || 0;
        const uzcardTerminal = generalData.uzcardTerminal || 0;
        const electronicPaymentSystem =
          generalData.electronicPaymentSystem || 0;

        const controlTotalSum = generalData.controlTotalSum || 0;
        const controlHumoSum = generalData.controlHumoSum || 0;
        const controlUzcardSum = generalData.controlUzcardSum || 0;
        const controlElectronicSum = generalData.controlElectronicSum || 0;

        // Проверяем разницы по НОВОЙ логике
        const cashDiff = cashAmount - controlTotalSum;
        const humoDiff = humoTerminal - controlHumoSum;
        const uzcardDiff = uzcardTerminal - controlUzcardSum;
        const electronicDiff = electronicPaymentSystem - controlElectronicSum;

        // Считаем проблемными если:
        // 1. Контрольная сумма не введена вообще (равна 0) И есть данные по терминалам
        // 2. Контрольная сумма меньше суммы отчета (отрицательная разница)
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

        // Получаем значения с заменой undefined/null на 0
        const cashAmount = generalData.cashAmount || 0;
        const humoTerminal = generalData.humoTerminal || 0;
        const uzcardTerminal = generalData.uzcardTerminal || 0;
        const electronicPaymentSystem =
          generalData.electronicPaymentSystem || 0;

        const controlTotalSum = generalData.controlTotalSum || 0;
        const controlHumoSum = generalData.controlHumoSum || 0;
        const controlUzcardSum = generalData.controlUzcardSum || 0;
        const controlElectronicSum = generalData.controlElectronicSum || 0;

        // Определяем типы проблем по НОВОЙ логике
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

        // Проверяем отрицательную разницу (контрольная сумма меньше суммы отчета)
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
            cash: cashAmount - controlTotalSum,
            humo: humoTerminal - controlHumoSum,
            uzcard: uzcardTerminal - controlUzcardSum,
            electronic: electronicPaymentSystem - controlElectronicSum,
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
      // Для одного дня берем последний отчет каждой станции
      return getLatestReports(reports);
    } else {
      // Для периодов больше дня показываем все отчеты в периоде
      return reports;
    }
  };

  const getAllStations = async () => {
    const stationsQuery = query(collection(db, "stations"));
    const stationsSnapshot = await getDocs(stationsQuery);
    return stationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
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

  const getPeriodDisplayName = (period) => {
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

  // Компоненты для отображения деталей анализа
  const AnalysisDetails = () => {
    if (!selectedAnalysis) return null;

    switch (selectedAnalysis.type) {
      case "autopilot":
        return <AutopilotDetails data={analysisData.autopilotData} />;
      case "comparison":
        return (
          <ComparisonDetails
            data={analysisData.comparisonData}
            type={comparisonType}
            onTypeChange={setComparisonType}
          />
        );
      case "negativeDifference":
        return (
          <NegativeDifferenceDetails
            data={analysisData.negativeDifferenceData}
            period={negativeDiffPeriod}
            onPeriodChange={setNegativeDiffPeriod}
          />
        );
      case "missingReports":
        return (
          <MissingReportsDetails
            data={analysisData.missingReportsData}
            period={missingReportsPeriod}
            onPeriodChange={setMissingReportsPeriod}
          />
        );
      case "controlDifference":
        return (
          <ControlDifferenceDetails
            data={analysisData.controlDifferenceData}
            period={controlDiffPeriod}
            onPeriodChange={setControlDiffPeriod}
          />
        );
      case "expiredDocuments":
        return (
          <ExpiredDocumentsDetails data={analysisData.expiredDocumentsData} />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Загрузка данных анализа...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Анализ данных заправок
        </h1>
        <p className="text-gray-600 mb-8">
          Панель управления для учредителя сетей заправок
        </p>

        {/* Карточки с анализом */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <AnalysisCard
            title="Принято газа через AutoPilotPro"
            value={analysisData.autopilotData.length}
            subtitle="станций с данными"
            description="Сортировка по наименьшему количеству м³"
            onClick={() => setSelectedAnalysis({ type: "autopilot" })}
            color="blue"
            icon="📊"
          />

          <AnalysisCard
            title="Сравнительный анализ"
            value={analysisData.comparisonData.length}
            subtitle="станций для сравнения"
            description="Динамика продаж по периодам"
            onClick={() => setSelectedAnalysis({ type: "comparison" })}
            color="green"
            icon="📈"
          />

          <AnalysisCard
            title="Отрицательная разница"
            value={analysisData.negativeDifferenceData.length}
            subtitle="проблемных станций"
            description={`hoseTotalGas - autopilotReading < 0 (${getPeriodDisplayName(
              negativeDiffPeriod
            )})`}
            onClick={() => setSelectedAnalysis({ type: "negativeDifference" })}
            color="red"
            icon="⚠️"
          />

          <AnalysisCard
            title="Отсутствующие отчеты"
            value={analysisData.missingReportsData.length}
            subtitle="станций без отчета"
            description={`Отчеты не сданы вовремя (${getPeriodDisplayName(
              missingReportsPeriod
            )})`}
            onClick={() => setSelectedAnalysis({ type: "missingReports" })}
            color="orange"
            icon="⏰"
          />

          <AnalysisCard
            title="Разница контрольных сумм"
            value={analysisData.controlDifferenceData.length}
            subtitle="проблемных отчетов"
            description={`Расхождения в финансовых данных (${getPeriodDisplayName(
              controlDiffPeriod
            )})`}
            onClick={() => setSelectedAnalysis({ type: "controlDifference" })}
            color="purple"
            icon="💰"
          />

          <AnalysisCard
            title="Просроченные документы"
            value={analysisData.expiredDocumentsData.length}
            subtitle="станций с просрочкой"
            description="Документы с истекшим сроком"
            onClick={() => setSelectedAnalysis({ type: "expiredDocuments" })}
            color="yellow"
            icon="📄"
          />
        </div>

        {/* Детали анализа */}
        <AnalysisDetails />
      </div>
    </div>
  );
};

// Компонент карточки анализа (остается без изменений)
const AnalysisCard = ({
  title,
  value,
  subtitle,
  description,
  onClick,
  color,
  icon,
}) => {
  const colorClasses = {
    blue: "bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
    green:
      "bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
    red: "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
    orange:
      "bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700",
    purple:
      "bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700",
    yellow:
      "bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700",
  };

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className={`${colorClasses[color]} rounded-2xl p-6 text-white cursor-pointer shadow-lg border border-white border-opacity-20`}
      onClick={onClick}>
      <div className="flex items-start justify-between mb-4">
        <div className="text-3xl">{icon}</div>
        <div className="text-right">
          <div className="text-3xl font-bold">{value}</div>
          <div className="text-sm opacity-90">{subtitle}</div>
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <div className="text-sm opacity-90">{description}</div>
    </motion.div>
  );
};

// Компоненты для деталей анализа с выпадающими меню

const NegativeDifferenceDetails = ({ data, period, onPeriodChange }) => (
  <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
      <h3 className="text-lg md:text-xl font-semibold">
        Отрицательная разница
      </h3>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="text-sm text-gray-500">Период:</div>
        <select
          value={period}
          onChange={(e) => onPeriodChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 w-full sm:w-auto">
          <option value="1day">За 1 день</option>
          <option value="7days">За 7 дней</option>
          <option value="1month">За месяц</option>
        </select>
        <div className="text-sm text-red-600 font-semibold whitespace-nowrap">
          {data.length} проблемных станций
        </div>
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full table-auto min-w-[600px]">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700">
              Станция
            </th>
            <th className="px-3 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold text-gray-700">
              AutoPilot (м³)
            </th>
            <th className="px-3 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold text-gray-700">
              Шланги (м³)
            </th>
            <th className="px-3 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold text-gray-700">
              Разница
            </th>
            <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700">
              Дата
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((station, index) => (
            <tr
              key={station.stationId}
              className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2 md:px-4 md:py-3">
                <div className="font-medium text-gray-900 text-sm">
                  {station.stationName}
                </div>
              </td>
              <td className="px-3 py-2 md:px-4 md:py-3 text-right text-blue-600 text-sm">
                {formatNumber(station.autopilotReading)} м³
              </td>
              <td className="px-3 py-2 md:px-4 md:py-3 text-right text-green-600 text-sm">
                {formatNumber(station.hoseTotalGas)} м³
              </td>
              <td className="px-3 py-2 md:px-4 md:py-3 text-right font-semibold text-red-600 text-sm">
                {formatNumber(station.difference)} м³
              </td>
              <td className="px-3 py-2 md:px-4 md:py-3 text-gray-600 text-sm">
                {formatDate(station.reportDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const MissingReportsDetails = ({ data, period, onPeriodChange }) => (
  <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
      <h3 className="text-lg md:text-xl font-semibold">Отсутствующие отчеты</h3>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="text-sm text-gray-500">Период:</div>
        <select
          value={period}
          onChange={(e) => onPeriodChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-full sm:w-auto">
          <option value="1day">За 1 день</option>
          <option value="7days">За 7 дней</option>
          <option value="1month">За месяц</option>
          <option value="6months">За полгода</option>
          <option value="1year">За год</option>
        </select>
        <div className="text-sm text-red-600 font-semibold whitespace-nowrap">
          {data.length} станций не сдали отчет
        </div>
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full table-auto min-w-[500px]">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700">
              Станция
            </th>
            <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700">
              Отсутствует отчет за
            </th>
            <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700">
              Статус
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((station, index) => (
            <tr
              key={station.stationId}
              className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2 md:px-4 md:py-3">
                <div className="font-medium text-gray-900 text-sm">
                  {station.stationName}
                </div>
              </td>
              <td className="px-3 py-2 md:px-4 md:py-3 font-semibold text-red-600 text-sm">
                {formatDate(station.missingDate)}
              </td>
              <td className="px-3 py-2 md:px-4 md:py-3">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  Просрочено
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ОБНОВЛЕННЫЙ компонент ControlDifferenceDetails
const ControlDifferenceDetails = ({ data, period, onPeriodChange }) => {
  const getProblemText = (problems) => {
    const problemTexts = {
      cash_negative: "Контрольная сумма по кассе меньше суммы отчета",
      humo_negative: "Контрольная сумма по Хумо меньше суммы отчета",
      uzcard_negative: "Контрольная сумма по Узкард меньше суммы отчета",
      electronic_negative:
        "Контрольная сумма по электронным меньше суммы отчета",
      cash_missing: "Не введена контрольная сумма по кассе",
      humo_missing: "Не введена контрольная сумма по Хумо",
      uzcard_missing: "Не введена контрольная сумма по Узкард",
      electronic_missing: "Не введена контрольная сумма по электронным",
    };

    return problems
      .map((problem) => problemTexts[problem] || problem)
      .join(", ");
  };

  const getStatusBadge = (problems) => {
    const hasMissing = problems.some((p) => p.includes("missing"));
    const hasNegative = problems.some((p) => p.includes("negative"));

    if (hasMissing) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Не введена
        </span>
      );
    } else if (hasNegative) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Меньше отчета
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Другая проблема
      </span>
    );
  };

  // Функция для определения цвета разницы
  const getDifferenceColor = (amount, controlAmount, difference) => {
    if (controlAmount === 0 && amount > 0) {
      return "text-red-600"; // Красный - не введена контрольная сумма
    } else if (difference > 0) {
      return "text-yellow-600"; // Желтый - контрольная сумма меньше суммы отчета
    } else {
      return "text-green-600"; // Зеленый - все в порядке
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <h3 className="text-lg md:text-xl font-semibold">
          Разница контрольных сумм
        </h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="text-sm text-gray-500">Период:</div>
          <select
            value={period}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 w-full sm:w-auto">
            <option value="yesterday">За вчерашний день</option>
            <option value="7days">За 7 дней</option>
            <option value="1month">За месяц</option>
            <option value="6months">За полгода</option>
            <option value="1year">За год</option>
          </select>
          <div className="text-sm text-red-600 font-semibold whitespace-nowrap">
            {data.length} проблемных отчетов
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Нет проблемных отчетов с контрольными суммами за выбранный период
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-auto min-w-[800px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700">
                  Станция
                </th>
                <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700">
                  Дата
                </th>
                <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700">
                  Проблемы
                </th>
                <th className="px-3 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold text-gray-700">
                  Касса
                </th>
                <th className="px-3 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold text-gray-700">
                  Хумо
                </th>
                <th className="px-3 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold text-gray-700">
                  Узкард
                </th>
                <th className="px-3 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold text-gray-700">
                  Электронные
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((station, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 md:px-4 md:py-3">
                    <div className="font-medium text-gray-900 text-sm">
                      {station.stationName}
                    </div>
                  </td>
                  <td className="px-3 py-2 md:px-4 md:py-3 text-gray-600 text-sm">
                    {formatDate(station.reportDate)}
                  </td>
                  <td className="px-3 py-2 md:px-4 md:py-3">
                    <div className="space-y-1">
                      {getStatusBadge(station.problems)}
                      <div className="text-xs text-gray-500 max-w-[150px] md:max-w-xs">
                        {getProblemText(station.problems)}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 md:px-4 md:py-3">
                    <div className="text-right">
                      <div
                        className={`font-semibold text-sm ${getDifferenceColor(
                          station.amounts.cash,
                          station.controlAmounts.cash,
                          station.differences.cash
                        )}`}>
                        {formatCurrency(station.differences.cash)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(station.amounts.cash)} /{" "}
                        {formatCurrency(station.controlAmounts.cash)}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 md:px-4 md:py-3">
                    <div className="text-right">
                      <div
                        className={`font-semibold text-sm ${getDifferenceColor(
                          station.amounts.humo,
                          station.controlAmounts.humo,
                          station.differences.humo
                        )}`}>
                        {formatCurrency(station.differences.humo)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(station.amounts.humo)} /{" "}
                        {formatCurrency(station.controlAmounts.humo)}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 md:px-4 md:py-3">
                    <div className="text-right">
                      <div
                        className={`font-semibold text-sm ${getDifferenceColor(
                          station.amounts.uzcard,
                          station.controlAmounts.uzcard,
                          station.differences.uzcard
                        )}`}>
                        {formatCurrency(station.differences.uzcard)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(station.amounts.uzcard)} /{" "}
                        {formatCurrency(station.controlAmounts.uzcard)}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 md:px-4 md:py-3">
                    <div className="text-right">
                      <div
                        className={`font-semibold text-sm ${getDifferenceColor(
                          station.amounts.electronic,
                          station.controlAmounts.electronic,
                          station.differences.electronic
                        )}`}>
                        {formatCurrency(station.differences.electronic)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(station.amounts.electronic)} /{" "}
                        {formatCurrency(station.controlAmounts.electronic)}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Остальные компоненты остаются без изменений
const AutopilotDetails = ({ data }) => (
  <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
      <h3 className="text-lg md:text-xl font-semibold">
        Станции по количеству принятого газа через AutoPilotPro
      </h3>
      <div className="text-sm text-gray-500">Всего: {data.length} станций</div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full table-auto min-w-[600px]">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700">
              #
            </th>
            <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700">
              Станция
            </th>
            <th className="px-3 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold text-gray-700">
              AutoPilot (м³)
            </th>
            <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700">
              Дата отчета
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((station, index) => (
            <tr
              key={station.stationId}
              className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2 md:px-4 md:py-3 text-gray-600 text-sm">
                {index + 1}
              </td>
              <td className="px-3 py-2 md:px-4 md:py-3">
                <div className="font-medium text-gray-900 text-sm">
                  {station.stationName}
                </div>
              </td>
              <td className="px-3 py-2 md:px-4 md:py-3 text-right">
                <div className="font-semibold text-blue-600 text-sm">
                  {formatNumber(station.autopilotReading)} м³
                </div>
              </td>
              <td className="px-3 py-2 md:px-4 md:py-3 text-gray-600 text-sm">
                {formatDate(station.reportDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const ComparisonDetails = ({ data, type, onTypeChange }) => (
  <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
      <h3 className="text-lg md:text-xl font-semibold">
        Сравнительный анализ продаж
      </h3>
      <select
        value={type}
        onChange={(e) => onTypeChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-auto">
        <option value="yesterday">Сравнение с предыдущим днем</option>
        <option value="last7days">Сравнение по дням недели</option>
        <option value="last30days">Сравнение по последним отчетам</option>
      </select>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full table-auto min-w-[700px]">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700">
              Станция
            </th>
            <th className="px-3 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold text-gray-700">
              Текущие продажи (м³)
            </th>
            <th className="px-3 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold text-gray-700">
              Предыдущие продажи (м³)
            </th>
            <th className="px-3 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold text-gray-700">
              Разница
            </th>
            <th className="px-3 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold text-gray-700">
              Изменение
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((station, index) => (
            <tr key={index} className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2 md:px-4 md:py-3">
                <div className="font-medium text-gray-900 text-sm">
                  {station.stationName}
                </div>
                <div className="text-xs text-gray-500">
                  {formatDate(station.currentDate)} vs{" "}
                  {formatDate(station.previousDate)}
                </div>
              </td>
              <td className="px-3 py-2 md:px-4 md:py-3 text-right font-semibold text-green-600 text-sm">
                {formatNumber(station.currentValue)} м³
              </td>
              <td className="px-3 py-2 md:px-4 md:py-3 text-right text-gray-600 text-sm">
                {formatNumber(station.previousValue)} м³
              </td>
              <td
                className={`px-3 py-2 md:px-4 md:py-3 text-right font-semibold text-sm ${
                  station.difference >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                {station.difference >= 0 ? "+" : ""}
                {formatNumber(station.difference)} м³
              </td>
              <td
                className={`px-3 py-2 md:px-4 md:py-3 text-right font-semibold text-sm ${
                  station.percentageChange >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}>
                {station.percentageChange >= 0 ? "+" : ""}
                {station.percentageChange.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const ExpiredDocumentsDetails = ({ data }) => (
  <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
      <h3 className="text-lg md:text-xl font-semibold">
        Просроченные документы
      </h3>
      <div className="text-sm text-red-600 font-semibold">
        {data.length} станций с просрочкой
      </div>
    </div>
    <div className="space-y-4">
      {data.map((station, index) => (
        <div
          key={index}
          className="border border-red-200 rounded-xl p-4 bg-red-50">
          <h4 className="font-semibold text-lg mb-3 text-red-900">
            {station.stationName}
          </h4>
          <div className="space-y-2">
            {station.documents.map((doc, docIndex) => (
              <div
                key={docIndex}
                className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white p-3 rounded-lg border border-red-100 gap-2">
                <div>
                  <span className="font-medium text-gray-900">
                    {doc.docType}
                  </span>
                  <span className="text-gray-600 ml-2">№{doc.docNumber}</span>
                  {doc.issueDate && (
                    <div className="text-sm text-gray-500">
                      Выдан: {formatDate(doc.issueDate)}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-red-600 font-semibold">
                    Просрочено на {doc.daysOverdue} дней
                  </div>
                  <div className="text-sm text-gray-600">
                    Истек: {formatDate(doc.expiryDate)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default HomeTasischi;
