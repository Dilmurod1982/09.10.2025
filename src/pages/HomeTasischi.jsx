import React, { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { motion } from "framer-motion";

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

  // Загрузка всех данных для анализа
  useEffect(() => {
    loadAnalysisData();
  }, []);

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

      // Анализ 3: Отрицательная разница
      const negativeDifferenceData = analyzeNegativeDifference(allReports);

      // Анализ 4: Отсутствующие отчеты
      const missingReportsData = await analyzeMissingReports(allReports);

      // Анализ 5: Разница контрольных сумм
      const controlDifferenceData = analyzeControlDifference(allReports);

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
    // Группируем отчеты по станциям и датам
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
      // Сортируем отчеты по дате
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

  // Анализ 3: Отрицательная разница
  const analyzeNegativeDifference = (reports) => {
    const latestReports = getLatestReports(reports);
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

  // Анализ 4: Отсутствующие отчеты
  const analyzeMissingReports = async (reports) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Получаем все уникальные станции
    const stationsQuery = query(collection(db, "stations"));
    const stationsSnapshot = await getDocs(stationsQuery);
    const allStations = stationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const stationsWithReports = new Set(
      reports
        .filter((report) => report.reportDate === yesterdayStr)
        .map((report) => report.stationId)
    );

    return allStations
      .filter((station) => !stationsWithReports.has(station.id))
      .map((station) => ({
        stationName: station.stationName,
        stationId: station.id,
        missingDate: yesterdayStr,
      }));
  };

  // Анализ 5: Разница контрольных сумм
  const analyzeControlDifference = (reports) => {
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const problematicReports = reports
      .filter((report) => {
        const reportDate = new Date(report.reportDate);
        return reportDate <= threeDaysAgo;
      })
      .filter((report) => {
        const generalData = report.generalData || {};
        const cashDiff =
          generalData.cashAmount - (generalData.controlTotalSum || 0);
        const humoDiff =
          generalData.humoTerminal - (generalData.controlHumoSum || 0);
        const uzcardDiff =
          generalData.uzcardTerminal - (generalData.controlUzcardSum || 0);
        const electronicDiff =
          generalData.electronicPaymentSystem -
          (generalData.controlElectronicSum || 0);

        return (
          cashDiff < 0 || humoDiff < 0 || uzcardDiff < 0 || electronicDiff < 0
        );
      })
      .map((report) => {
        const generalData = report.generalData || {};
        return {
          stationName: report.stationName,
          reportDate: report.reportDate,
          stationId: report.stationId,
          differences: {
            cash: generalData.cashAmount - (generalData.controlTotalSum || 0),
            humo: generalData.humoTerminal - (generalData.controlHumoSum || 0),
            uzcard:
              generalData.uzcardTerminal - (generalData.controlUzcardSum || 0),
            electronic:
              generalData.electronicPaymentSystem -
              (generalData.controlElectronicSum || 0),
          },
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

    // Группируем по станциям
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

  // Вспомогательные функции
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

  const formatNumber = (num) => {
    return new Intl.NumberFormat("ru-RU").format(num);
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat("ru-RU").format(num) + " ₽";
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
          />
        );
      case "missingReports":
        return <MissingReportsDetails data={analysisData.missingReportsData} />;
      case "controlDifference":
        return (
          <ControlDifferenceDetails data={analysisData.controlDifferenceData} />
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
            description="hoseTotalGas - autopilotReading < 0"
            onClick={() => setSelectedAnalysis({ type: "negativeDifference" })}
            color="red"
            icon="⚠️"
          />

          <AnalysisCard
            title="Отсутствующие отчеты"
            value={analysisData.missingReportsData.length}
            subtitle="станций без отчета"
            description="Отчеты не сданы вовремя"
            onClick={() => setSelectedAnalysis({ type: "missingReports" })}
            color="orange"
            icon="⏰"
          />

          <AnalysisCard
            title="Разница контрольных сумм"
            value={analysisData.controlDifferenceData.length}
            subtitle="проблемных отчетов"
            description="Расхождения в финансовых данных"
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

// Компонент карточки анализа
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

// Компоненты для деталей анализа
const AutopilotDetails = ({ data }) => (
  <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-xl font-semibold">
        Станции по количеству принятого газа через AutoPilotPro
      </h3>
      <div className="text-sm text-gray-500">Всего: {data.length} станций</div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full table-auto">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              #
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Станция
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
              AutoPilot (м³)
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Дата отчета
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((station, index) => (
            <tr
              key={station.stationId}
              className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">
                  {station.stationName}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="font-semibold text-blue-600">
                  {formatNumber(station.autopilotReading)} м³
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {station.reportDate}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const ComparisonDetails = ({ data, type, onTypeChange }) => (
  <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-xl font-semibold">Сравнительный анализ продаж</h3>
      <select
        value={type}
        onChange={(e) => onTypeChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        <option value="yesterday">Сравнение с предыдущим днем</option>
        <option value="last7days">Сравнение по дням недели</option>
        <option value="last30days">Сравнение по последним отчетам</option>
      </select>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full table-auto">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Станция
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
              Текущие продажи (м³)
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
              Предыдущие продажи (м³)
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
              Разница
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
              Изменение
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((station, index) => (
            <tr key={index} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">
                  {station.stationName}
                </div>
                <div className="text-xs text-gray-500">
                  {station.currentDate} vs {station.previousDate}
                </div>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-green-600">
                {formatNumber(station.currentValue)} м³
              </td>
              <td className="px-4 py-3 text-right text-gray-600">
                {formatNumber(station.previousValue)} м³
              </td>
              <td
                className={`px-4 py-3 text-right font-semibold ${
                  station.difference >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                {station.difference >= 0 ? "+" : ""}
                {formatNumber(station.difference)} м³
              </td>
              <td
                className={`px-4 py-3 text-right font-semibold ${
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

const NegativeDifferenceDetails = ({ data }) => (
  <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-xl font-semibold">
        Станции с отрицательной разницей
      </h3>
      <div className="text-sm text-gray-500">
        Всего проблемных: {data.length} станций
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full table-auto">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Станция
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
              AutoPilot (м³)
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
              Шланги (м³)
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
              Разница
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Дата
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((station, index) => (
            <tr
              key={station.stationId}
              className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">
                  {station.stationName}
                </div>
              </td>
              <td className="px-4 py-3 text-right text-blue-600">
                {formatNumber(station.autopilotReading)} м³
              </td>
              <td className="px-4 py-3 text-right text-green-600">
                {formatNumber(station.hoseTotalGas)} м³
              </td>
              <td className="px-4 py-3 text-right font-semibold text-red-600">
                {formatNumber(station.difference)} м³
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {station.reportDate}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const MissingReportsDetails = ({ data }) => (
  <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-xl font-semibold">Отсутствующие отчеты</h3>
      <div className="text-sm text-red-600 font-semibold">
        {data.length} станций не сдали отчет
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full table-auto">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Станция
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Отсутствует отчет за
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Статус
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((station, index) => (
            <tr
              key={station.stationId}
              className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">
                  {station.stationName}
                </div>
              </td>
              <td className="px-4 py-3 font-semibold text-red-600">
                {station.missingDate}
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
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

const ControlDifferenceDetails = ({ data }) => (
  <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-xl font-semibold">Разница контрольных сумм</h3>
      <div className="text-sm text-red-600 font-semibold">
        {data.length} проблемных отчетов
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full table-auto">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Станция
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Дата отчета
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
              Касса
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
              Хумо
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
              Узкард
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
              Электронные
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((station, index) => (
            <tr key={index} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">
                  {station.stationName}
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600">{station.reportDate}</td>
              <td
                className={`px-4 py-3 text-right font-semibold ${
                  station.differences.cash < 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}>
                {formatCurrency(station.differences.cash)}
              </td>
              <td
                className={`px-4 py-3 text-right font-semibold ${
                  station.differences.humo < 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}>
                {formatCurrency(station.differences.humo)}
              </td>
              <td
                className={`px-4 py-3 text-right font-semibold ${
                  station.differences.uzcard < 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}>
                {formatCurrency(station.differences.uzcard)}
              </td>
              <td
                className={`px-4 py-3 text-right font-semibold ${
                  station.differences.electronic < 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}>
                {formatCurrency(station.differences.electronic)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const ExpiredDocumentsDetails = ({ data }) => (
  <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-xl font-semibold">Просроченные документы</h3>
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
                className="flex justify-between items-center bg-white p-3 rounded-lg border border-red-100">
                <div>
                  <span className="font-medium text-gray-900">
                    {doc.docType}
                  </span>
                  <span className="text-gray-600 ml-2">№{doc.docNumber}</span>
                  {doc.issueDate && (
                    <div className="text-sm text-gray-500">
                      Выдан: {doc.issueDate}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-red-600 font-semibold">
                    Просрочено на {doc.daysOverdue} дней
                  </div>
                  <div className="text-sm text-gray-600">
                    Истек: {doc.expiryDate}
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

const formatNumber = (num) => {
  return new Intl.NumberFormat("ru-RU").format(num);
};

const formatCurrency = (num) => {
  return new Intl.NumberFormat("ru-RU").format(num) + " ₽";
};

export default HomeTasischi;
