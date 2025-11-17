// pages/HomeTasischi.jsx
import React, { useState } from "react";
import {
  useStationAnalytics,
  getPeriodDisplayName,
} from "../hooks/useStationAnalytics";
import { AnalysisCard, AnalysisDetails } from "../hooks/AnalysisComponents";

const HomeTasischi = () => {
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [comparisonType, setComparisonType] = useState("yesterday");
  const [negativeDiffPeriod, setNegativeDiffPeriod] = useState("1day");
  const [missingReportsPeriod, setMissingReportsPeriod] = useState("1day");
  const [controlDiffPeriod, setControlDiffPeriod] = useState("yesterday");
  const [autopilotPeriod, setAutopilotPeriod] = useState("1day");
  const [gasPaymentsPeriod, setGasPaymentsPeriod] = useState("1day");
  const [gasPaymentsDateRange, setGasPaymentsDateRange] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Для учредителя - все станции (передаем пустой массив)
  const { analysisData, loading, error, loadAnalysisData, debugInfo } =
    useStationAnalytics([]);

  // Функция для применения фильтров
  const applyFilters = () => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-lg text-gray-600 mb-3">
            Таҳлиллар юкланмоқда...
          </div>
          <div className="text-xs text-gray-500">
            Ҳисоботлар: {debugInfo.reportsCount} | Хужжатлар:{" "}
            {debugInfo.documentsCount}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-xs">
          <div className="text-lg text-red-600 mb-2">
            Маълумотлар юклашда хатолик
          </div>
          <div className="text-xs text-gray-500 mb-3">{error}</div>
          <button
            onClick={() => loadAnalysisData()}
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
            Қайта уриниш
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="max-w-7xl mx-auto">
        {/* Мобильный хедер */}
        <div className="flex justify-between items-center mb-4 p-2">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 mb-1">
              Заправкалар таҳлили
            </h1>
            <p className="text-xs text-gray-600">Таъсисчи</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500 text-right">
              {debugInfo.reportsCount} ҳисоботлар
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 bg-blue-600 text-white rounded-lg text-sm">
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Мобильное меню анализов */}
        {mobileMenuOpen && (
          <div className="mb-4 bg-white rounded-xl shadow-lg p-3">
            <div className="grid grid-cols-2 gap-2">
              <MobileAnalysisTab
                title="AutoPilot"
                value={analysisData.autopilotData.length}
                onClick={() => {
                  setSelectedAnalysis({ type: "autopilot" });
                  setMobileMenuOpen(false);
                }}
                color="blue"
                icon="📊"
                isActive={selectedAnalysis?.type === "autopilot"}
              />

              <MobileAnalysisTab
                title="Солиштириш"
                value={analysisData.comparisonData.length}
                onClick={() => {
                  setSelectedAnalysis({ type: "comparison" });
                  setMobileMenuOpen(false);
                }}
                color="green"
                icon="📈"
                isActive={selectedAnalysis?.type === "comparison"}
              />

              <MobileAnalysisTab
                title="Отрицательная"
                value={analysisData.negativeDifferenceData.length}
                onClick={() => {
                  setSelectedAnalysis({ type: "negativeDifference" });
                  setMobileMenuOpen(false);
                }}
                color="red"
                icon="⚠️"
                isActive={selectedAnalysis?.type === "negativeDifference"}
              />

              <MobileAnalysisTab
                title="Ҳисоботлар"
                value={analysisData.missingReportsData.length}
                onClick={() => {
                  setSelectedAnalysis({ type: "missingReports" });
                  setMobileMenuOpen(false);
                }}
                color="orange"
                icon="⏰"
                isActive={selectedAnalysis?.type === "missingReports"}
              />

              <MobileAnalysisTab
                title="Назорат"
                value={analysisData.controlDifferenceData.length}
                onClick={() => {
                  setSelectedAnalysis({ type: "controlDifference" });
                  setMobileMenuOpen(false);
                }}
                color="purple"
                icon="💰"
                isActive={selectedAnalysis?.type === "controlDifference"}
              />

              <MobileAnalysisTab
                title="Хужжатлар"
                value={analysisData.expiredDocumentsData.length}
                onClick={() => {
                  setSelectedAnalysis({ type: "expiredDocuments" });
                  setMobileMenuOpen(false);
                }}
                color="yellow"
                icon="📄"
                isActive={selectedAnalysis?.type === "expiredDocuments"}
              />

              <MobileAnalysisTab
                title="Газ/Тўловлар"
                value={
                  analysisData.gasAndPaymentsData?.summary
                    ? "Ҳисобот"
                    : analysisData.gasAndPaymentsData.length
                }
                onClick={() => {
                  setSelectedAnalysis({ type: "gasAndPayments" });
                  setMobileMenuOpen(false);
                }}
                color="teal"
                icon="⛽"
                isActive={selectedAnalysis?.type === "gasAndPayments"}
              />
            </div>

            {/* Кнопка обновления в мобильном меню */}
            <button
              onClick={() => {
                applyFilters();
                setMobileMenuOpen(false);
              }}
              className="w-full mt-3 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm">
              Маълумотларни янгилаш
            </button>
          </div>
        )}

        {/* Основной контент */}
        <div className="space-y-3">
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
          {!selectedAnalysis && (
            <div className="p-3 bg-white rounded-xl shadow-lg">
              <h3 className="text-base font-semibold mb-3">
                Умумий статистика
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                  <div className="font-semibold text-blue-600 text-sm">
                    {analysisData.autopilotData.length}
                  </div>
                  <div className="text-gray-600">AutoPilot</div>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <div className="font-semibold text-green-600 text-sm">
                    {analysisData.comparisonData.length}
                  </div>
                  <div className="text-gray-600">Солиштириш</div>
                </div>
                <div className="text-center p-2 bg-red-50 rounded-lg">
                  <div className="font-semibold text-red-600 text-sm">
                    {analysisData.negativeDifferenceData.length}
                  </div>
                  <div className="text-gray-600">Муаммолар</div>
                </div>
                <div className="text-center p-2 bg-purple-50 rounded-lg">
                  <div className="font-semibold text-purple-600 text-sm">
                    {analysisData.controlDifferenceData.length}
                  </div>
                  <div className="text-gray-600">Молия</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Плавающая кнопка меню когда ничего не выбрано */}
        {!selectedAnalysis && !mobileMenuOpen && (
          <div className="fixed bottom-4 right-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700">
              <span className="text-lg">☰</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Компонент мобильной вкладки
const MobileAnalysisTab = ({
  title,
  value,
  onClick,
  color = "blue",
  icon = "📊",
  isActive = false,
}) => {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    green: "bg-green-50 border-green-200 hover:bg-green-100",
    red: "bg-red-50 border-red-200 hover:bg-red-100",
    orange: "bg-orange-50 border-orange-200 hover:bg-orange-100",
    purple: "bg-purple-50 border-purple-200 hover:bg-purple-100",
    yellow: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100",
    teal: "bg-teal-50 border-teal-200 hover:bg-teal-100",
  };

  const activeClasses = isActive ? "ring-2 ring-blue-500" : "";

  return (
    <div
      className={`
        p-2 rounded-lg border cursor-pointer transition-all duration-200
        ${colorClasses[color]} ${activeClasses}
        flex flex-col items-center justify-center text-center
        min-h-[60px]
      `}
      onClick={onClick}>
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-xs font-semibold text-gray-900 mb-1">{title}</div>
      <div className="text-xs text-gray-600">{value}</div>
    </div>
  );
};

export default HomeTasischi;
