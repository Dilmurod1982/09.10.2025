// pages/HomeChief.jsx
import React, { useState } from "react";
import { useAppStore } from "../lib/zustand";
import {
  useStationAnalytics,
  getPeriodDisplayName,
} from "../hooks/useStationAnalytics";
import { AnalysisCard, AnalysisDetails } from "../hooks/AnalysisComponents";

const HomeChief = () => {
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [comparisonType, setComparisonType] = useState("yesterday");
  const [negativeDiffPeriod, setNegativeDiffPeriod] = useState("1day");
  const [missingReportsPeriod, setMissingReportsPeriod] = useState("1day");
  const [controlDiffPeriod, setControlDiffPeriod] = useState("yesterday");
  const [autopilotPeriod, setAutopilotPeriod] = useState("1day");
  const [gasPaymentsPeriod, setGasPaymentsPeriod] = useState("1day");
  const [gasPaymentsDateRange, setGasPaymentsDateRange] = useState(null);

  const userData = useAppStore((state) => state.userData);
  const managedStations = userData?.stations || [];

  const { analysisData, loading, error, loadAnalysisData, debugInfo } =
    useStationAnalytics(managedStations);

  // Функция для применения фильтров
  const applyFilters = () => {
    console.log("🔄 Применение фильтров...");
    loadAnalysisData({
      negativeDiffPeriod,
      missingReportsPeriod,
      controlDiffPeriod,
      comparisonType,
      autopilotPeriod,
      gasPaymentsPeriod,
      gasPaymentsDateRange,
    });
  };

  // Если нет управляемых станций
  if (!managedStations || managedStations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 mb-4">
            Бошқарувингизда заправка мавжуд эмас.
          </div>
          <div className="text-gray-600 mb-4">
            Заправкани бириктириш бўйича админга мурожаат этинг
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-gray-600 mb-2">
            Анализ маълумотлари юкланмоқда...
          </div>
          <div className="text-sm text-gray-500 mb-4">
            {managedStations.length} та заправка бошқармоқдасиз
          </div>
          <div className="text-sm text-gray-500">
            Ҳисоботлар: {debugInfo.reportsCount} | Хужжатлар:{" "}
            {debugInfo.documentsCount}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-xl text-red-600 mb-2">
            Маълумотлар юклашда хатолик
          </div>
          <div className="text-sm text-gray-500 mb-4">{error}</div>
          <div className="text-xs text-gray-400 mb-4">
            Ҳисоботлар: {debugInfo.reportsCount} | Хужжатлар:{" "}
            {debugInfo.documentsCount}
          </div>
          <button
            onClick={() => loadAnalysisData()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Қайта уриниб кўриш
          </button>
        </div>
      </div>
    );
  }

  // Если нет данных
  if (debugInfo.reportsCount === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-xl text-gray-600 mb-2">
            Тахлил учун маълумот мавжуд эмас
          </div>
          <div className="text-sm text-gray-500 mb-4">
            Бошқариладиган заправкаларда ҳисобот мавжуд эмас. Ҳисобот
            киритилгандан сўнг маълумотлар чиқади
          </div>
          <div className="text-xs text-gray-400 mb-4">
            Бошқариладиган заправкалар: {debugInfo.managedStationsCount}
          </div>
          <button
            onClick={() => loadAnalysisData()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Қайта уриниш
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Бошқариладиган заправкалар таҳлили
            </h1>
            <p className="text-gray-600">Бошқарувчи панели</p>
          </div>
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg">
            {managedStations.length} та заправка бошқараман
          </div>
        </div>

        {/* Карточки с анализом */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <AnalysisCard
            title="AutoPilotPro қабул қилинган газ"
            value={analysisData.autopilotData.length}
            subtitle="маълумотлари мавжуд заправкалар"
            description={`Жами кўрсаткич (${getPeriodDisplayName(
              autopilotPeriod
            )})`}
            onClick={() => setSelectedAnalysis({ type: "autopilot" })}
            color="blue"
            icon="📊"
          />

          <AnalysisCard
            title="Солиштирма таҳлил"
            value={analysisData.comparisonData.length}
            subtitle="солиштирилаётган заправкалар"
            description="Даврлар бўйича сотиш динамикаси"
            onClick={() => setSelectedAnalysis({ type: "comparison" })}
            color="green"
            icon="📈"
          />

          <AnalysisCard
            title="Манфий фарқ (минус)"
            value={analysisData.negativeDifferenceData.length}
            subtitle="муаммоли заправкалар"
            description={`hoseTotalGas - autopilotReading < 0 (${getPeriodDisplayName(
              negativeDiffPeriod
            )})`}
            onClick={() => setSelectedAnalysis({ type: "negativeDifference" })}
            color="red"
            icon="⚠️"
          />

          <AnalysisCard
            title="Топширилмаган ҳисоботлар"
            value={analysisData.missingReportsData.length}
            subtitle="ҳисоботи киритилмаган заправкалар"
            description={`Вақтида топиширилмаган ҳисоботлар (${getPeriodDisplayName(
              missingReportsPeriod
            )})`}
            onClick={() => setSelectedAnalysis({ type: "missingReports" })}
            color="orange"
            icon="⏰"
          />

          <AnalysisCard
            title="Назорат суммаси билан фарқлар"
            value={analysisData.controlDifferenceData.length}
            subtitle="Муаммоли ҳисоботлар"
            description={`Суммада фарқ бераётганлар (${getPeriodDisplayName(
              controlDiffPeriod
            )})`}
            onClick={() => setSelectedAnalysis({ type: "controlDifference" })}
            color="purple"
            icon="💰"
          />

          <AnalysisCard
            title="Муддати ўтган хужжатлар"
            value={analysisData.expiredDocumentsData.length}
            subtitle="муддат ўтган хужжатлар мавжуд заправкалар"
            description="Муддати ўтган хужжатлар"
            onClick={() => setSelectedAnalysis({ type: "expiredDocuments" })}
            color="yellow"
            icon="📄"
          />

          {/* НОВАЯ КАРТОЧКА: Расход газа и платежи */}
          <AnalysisCard
            title="Сотилган газ ва тўловлар"
            value={
              analysisData.gasAndPaymentsData?.summary
                ? "Ҳисобот"
                : analysisData.gasAndPaymentsData.length
            }
            subtitle={
              analysisData.gasAndPaymentsData?.summary
                ? "давр"
                : "маълумоти мавжуд заправкалар"
            }
            description="Сотиш ва тўловлар таҳлили"
            onClick={() => setSelectedAnalysis({ type: "gasAndPayments" })}
            color="teal"
            icon="⛽"
          />
        </div>

        {/* Детали анализа */}
        <AnalysisDetails
          selectedAnalysis={selectedAnalysis}
          analysisData={analysisData}
          filters={{
            comparisonType,
            negativeDiffPeriod,
            missingReportsPeriod,
            controlDiffPeriod,
            autopilotPeriod,
            gasPaymentsPeriod,
            gasPaymentsDateRange,
          }}
          onFiltersChange={{
            setComparisonType,
            setNegativeDiffPeriod,
            setMissingReportsPeriod,
            setControlDiffPeriod,
            setAutopilotPeriod,
            setGasPaymentsPeriod,
            setGasPaymentsDateRange,
          }}
          onRefresh={applyFilters}
        />

        {/* Статистика по данным */}
        <div className="mt-8 p-6 bg-white rounded-2xl shadow-lg">
          <h3 className="text-lg font-semibold mb-4">Умумий статистика</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="font-semibold text-blue-600">
                {analysisData.autopilotData.length}
              </div>
              <div className="text-gray-600">AutoPilot мавжуд заправкалар</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="font-semibold text-green-600">
                {analysisData.comparisonData.length}
              </div>
              <div className="text-gray-600">Солитштириш учун</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="font-semibold text-red-600">
                {analysisData.negativeDifferenceData.length}
              </div>
              <div className="text-gray-600">Муаммоли</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="font-semibold text-purple-600">
                {analysisData.controlDifferenceData.length}
              </div>
              <div className="text-gray-600">Суммаларда фарқ</div>
            </div>
          </div>

          {/* Отладочная информация */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">
              Маълумот: {debugInfo.reportsCount} , {debugInfo.documentsCount}{" "}
              хужжатлар, {debugInfo.managedStationsCount} бошқариладиган
              заправкалар
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeChief;
