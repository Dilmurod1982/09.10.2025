// hooks/AnalysisComponents.jsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  formatNumber,
  formatCurrency,
  formatDate,
  getPeriodDisplayName,
} from "./useStationAnalytics";

// Карточка анализа
export const AnalysisCard = ({
  title,
  value,
  subtitle,
  description,
  onClick,
  color = "blue",
  icon = "📊",
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

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${colorClasses[color]}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-2">{value}</div>
      <div className="text-sm text-gray-600 mb-1">{subtitle}</div>
      <div className="text-xs text-gray-500">{description}</div>
    </motion.div>
  );
};

// Компонент: Детали анализа расхода газа и платежей
export const GasAndPaymentsDetails = ({
  analysisData,
  filters = {},
  onFiltersChange = {},
  onRefresh,
}) => {
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    rangeType: "custom",
  });

  const handleDateRangeChange = (field, value) => {
    const newDateRange = { ...dateRange, [field]: value };
    setDateRange(newDateRange);

    if (field === "startDate" || field === "endDate") {
      onFiltersChange.setGasPaymentsDateRange?.(newDateRange);
    }
  };

  const handleQuickRangeSelect = (rangeType) => {
    const today = new Date();
    let startDate = new Date();

    switch (rangeType) {
      case "today":
        startDate = today;
        break;
      case "yesterday":
        startDate.setDate(today.getDate() - 1);
        break;
      case "week":
        startDate.setDate(today.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(today.getMonth() - 1);
        break;
      case "year":
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      default:
        startDate = today;
    }

    const newDateRange = {
      startDate: startDate.toISOString().split("T")[0],
      endDate: today.toISOString().split("T")[0],
      rangeType: rangeType,
    };

    setDateRange(newDateRange);
    onFiltersChange.setGasPaymentsDateRange?.(newDateRange);
  };

  const renderGasAndPaymentsDetails = () => {
    const data = analysisData.gasAndPaymentsData;
    const isDateRangeData = data && data.summary;
    const summary = isDateRangeData ? data.summary : null;
    const stationsData = isDateRangeData ? data.stationsData : data;
    const dailyData = isDateRangeData ? data.dailyData : [];

    return (
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
          <h3 className="text-xl font-semibold">
            Сотилган газ ва тушум таҳлили
          </h3>
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Быстрый выбор периода */}
            <select
              value={dateRange.rangeType}
              onChange={(e) => handleQuickRangeSelect(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="custom">Даврни тангланг</option>
              <option value="today">Бугун</option>
              <option value="yesterday">Кеча</option>
              <option value="week">Хафта</option>
              <option value="month">Ой</option>
              <option value="year">Йил</option>
            </select>

            {/* Кастомный диапазон дат */}
            <div className="flex gap-2">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  handleDateRangeChange("startDate", e.target.value)
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1"
              />
              <span className="self-center text-sm">по</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  handleDateRangeChange("endDate", e.target.value)
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1"
              />
            </div>

            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm whitespace-nowrap"
            >
              Янгилаш
            </button>
          </div>
        </div>

        {/* Общая сводка */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="p-3 lg:p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-lg lg:text-2xl font-bold text-blue-600">
                {formatNumber(summary.totalGas)} м3
              </div>
              <div className="text-xs lg:text-sm text-gray-600">
                Жами сотилган газ
              </div>
            </div>
            <div className="p-3 lg:p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-lg lg:text-2xl font-bold text-green-600">
                {formatCurrency(summary.totalPayments)}
              </div>
              <div className="text-xs lg:text-sm text-gray-600">Жами тушум</div>
            </div>
            <div className="p-3 lg:p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-lg lg:text-2xl font-bold text-purple-600">
                {summary.reportsCount}
              </div>
              <div className="text-xs lg:text-sm text-gray-600">Ҳисоботлар</div>
            </div>
            <div className="p-3 lg:p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-lg lg:text-2xl font-bold text-orange-600">
                {stationsData?.length || 0}
              </div>
              <div className="text-xs lg:text-sm text-gray-600">
                Заправкалар
              </div>
            </div>
          </div>
        )}

        {/* Распределение платежей */}
        {summary && (
          <div className="p-4 bg-white rounded-lg border mb-6">
            <h4 className="font-semibold mb-3">Тўловлар тақсимоти</h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div className="text-center p-2 lg:p-3 bg-green-50 rounded">
                <div className="font-semibold text-green-600 text-sm lg:text-base">
                  {formatCurrency(summary.totalCash)}
                </div>
                <div className="text-gray-600 text-xs lg:text-sm">Нақд</div>
                <div className="text-xs text-gray-500">
                  {summary.totalPayments > 0
                    ? (
                        (summary.totalCash / summary.totalPayments) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </div>
              </div>
              <div className="text-center p-2 lg:p-3 bg-blue-50 rounded">
                <div className="font-semibold text-blue-600 text-sm lg:text-base">
                  {formatCurrency(summary.totalHumo)}
                </div>
                <div className="text-gray-600 text-xs lg:text-sm">HUMO</div>
                <div className="text-xs text-gray-500">
                  {summary.totalPayments > 0
                    ? (
                        (summary.totalHumo / summary.totalPayments) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </div>
              </div>
              <div className="text-center p-2 lg:p-3 bg-purple-50 rounded">
                <div className="font-semibold text-purple-600 text-sm lg:text-base">
                  {formatCurrency(summary.totalUzcard)}
                </div>
                <div className="text-gray-600 text-xs lg:text-sm">Uzcard</div>
                <div className="text-xs text-gray-500">
                  {summary.totalPayments > 0
                    ? (
                        (summary.totalUzcard / summary.totalPayments) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </div>
              </div>
              <div className="text-center p-2 lg:p-3 bg-orange-50 rounded">
                <div className="font-semibold text-orange-600 text-sm lg:text-base">
                  {formatCurrency(summary.totalElectronic)}
                </div>
                <div className="text-gray-600 text-xs lg:text-sm">Электрон</div>
                <div className="text-xs text-gray-500">
                  {summary.totalPayments > 0
                    ? (
                        (summary.totalElectronic / summary.totalPayments) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Данные по станциям */}
        <div>
          <h4 className="font-semibold mb-3">Заправкалар бўйича маълумот</h4>
          {!stationsData || stationsData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Танланган давр бўйича маълумот мавжуд эмас
            </div>
          ) : (
            <div className="space-y-3">
              {stationsData.map((station, index) => (
                <div
                  key={station.stationId}
                  className="p-3 lg:p-4 bg-white rounded-lg border"
                >
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-2 mb-3">
                    <h5 className="font-semibold text-sm lg:text-base">
                      {station.stationName}
                    </h5>
                    <div className="text-right">
                      <div className="text-base lg:text-lg font-bold text-blue-600">
                        {formatNumber(station.totalGas)} м3
                      </div>
                      <div className="text-xs lg:text-sm text-gray-600">
                        {formatCurrency(station.totalPayments)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs lg:text-sm">
                    <div>
                      <div className="font-semibold">Нақд</div>
                      <div>{formatCurrency(station.totalCash)}</div>
                      <div className="text-xs text-gray-500">
                        {station.paymentDistribution?.cashPercentage?.toFixed(
                          1
                        ) || 0}
                        %
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold">HUMO</div>
                      <div>{formatCurrency(station.totalHumo)}</div>
                      <div className="text-xs text-gray-500">
                        {station.paymentDistribution?.humoPercentage?.toFixed(
                          1
                        ) || 0}
                        %
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold">Uzcard</div>
                      <div>{formatCurrency(station.totalUzcard)}</div>
                      <div className="text-xs text-gray-500">
                        {station.paymentDistribution?.uzcardPercentage?.toFixed(
                          1
                        ) || 0}
                        %
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold">Электрон</div>
                      <div>{formatCurrency(station.totalElectronic)}</div>
                      <div className="text-xs text-gray-500">
                        {station.paymentDistribution?.electronicPercentage?.toFixed(
                          1
                        ) || 0}
                        %
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    {station.reportsCount} ҳисоботлар
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ежедневные данные (только для диапазона дат) */}
        {dailyData && dailyData.length > 0 && (
          <div className="mt-6">
            <h4 className="font-semibold mb-3">Кунлик статистика</h4>
            <div className="space-y-2">
              {dailyData.map((day, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded border">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <div className="font-semibold text-sm">
                      {formatDate(day.date)}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {formatNumber(day.totalGas)} м3
                      </div>
                      <div className="text-xs text-gray-600">
                        {formatCurrency(day.totalPayments)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 lg:p-6 bg-white rounded-2xl shadow-lg mb-6"
    >
      {renderGasAndPaymentsDetails()}
    </motion.div>
  );
};

// Компонент деталей анализа
export const AnalysisDetails = ({
  selectedAnalysis,
  analysisData,
  filters = {},
  onFiltersChange = {},
  onRefresh,
}) => {
  if (!selectedAnalysis) return null;

  // Проверяем, что analysisData существует
  if (!analysisData) {
    return (
      <div className="text-center py-8 text-gray-500">
        Маълумотлар юкланмаган ё хатолик юз берди
      </div>
    );
  }

  const renderAutopilotDetails = () => (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-4">
        <h3 className="text-xl font-semibold">AutoPilotPro маълумотлар</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={filters.autopilotPeriod || "30days"}
            onChange={(e) =>
              onFiltersChange.setAutopilotPeriod?.(e.target.value)
            }
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="1day">1 кунлик</option>
            <option value="7days">7 кунлик</option>
            <option value="30days">30 кунлик</option>
            <option value="1month">1 ойлик</option>
            <option value="6months">6 ойлик</option>
            <option value="1year">1 йиллик</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm whitespace-nowrap"
          >
            Янгилаш
          </button>
        </div>
      </div>

      {analysisData.autopilotData && analysisData.autopilotData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Танланган даврга маълумот мавжуд эмас
        </div>
      ) : (
        <div className="grid gap-3 lg:gap-4">
          {analysisData.autopilotData &&
            analysisData.autopilotData.map((station, index) => (
              <div
                key={station.stationId}
                className="p-3 lg:p-4 bg-white rounded-lg border"
              >
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-2">
                  <div>
                    <h4 className="font-semibold text-sm lg:text-base">
                      {station.stationName}
                    </h4>
                    <p className="text-xs lg:text-sm text-gray-600">
                      Ўртача кўрсаткич:{" "}
                      {formatNumber(station.averageAutopilot?.toFixed(2) || 0)}{" "}
                      м3
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base lg:text-lg font-bold">
                      {formatNumber(station.totalAutopilot || 0)} м3
                    </p>
                    <p className="text-xs lg:text-sm text-gray-600">
                      {station.reportsCount || 0} ҳисоботлар
                    </p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  const renderComparisonDetails = () => (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-4">
        <h3 className="text-xl font-semibold">Солиштирма таҳлил</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={filters.comparisonType || "yesterday"}
            onChange={(e) =>
              onFiltersChange.setComparisonType?.(e.target.value)
            }
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="yesterday">Кечаги кун билан</option>
            <option value="week">Ўтган хафта билан</option>
            <option value="month">Ўтган ой билан</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm whitespace-nowrap"
          >
            Янгилаш
          </button>
        </div>
      </div>

      {analysisData.comparisonData &&
      analysisData.comparisonData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Танланган даврга маълумот мавжуд эмас
        </div>
      ) : (
        <div className="grid gap-3 lg:gap-4">
          {analysisData.comparisonData &&
            analysisData.comparisonData.map((station, index) => (
              <div
                key={index}
                className="p-3 lg:p-4 bg-white rounded-lg border"
              >
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-2 mb-2">
                  <h4 className="font-semibold text-sm lg:text-base">
                    {station.stationName}
                  </h4>
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      station.difference >= 0
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {station.difference >= 0 ? "+" : ""}
                    {formatNumber(station.difference || 0)} м3
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs lg:text-sm">
                  <div>
                    <p>Жорий: {formatNumber(station.currentValue || 0)} м3</p>
                    <p className="text-gray-600">
                      {formatDate(station.currentDate)}
                    </p>
                  </div>
                  <div>
                    <p>
                      Олдинги: {formatNumber(station.previousValue || 0)} м3
                    </p>
                    <p className="text-gray-600">
                      {formatDate(station.previousDate)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  const renderNegativeDifferenceDetails = () => (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-4">
        <h3 className="text-xl font-semibold">Манфий фарқлар</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={filters.negativeDiffPeriod || "30days"}
            onChange={(e) =>
              onFiltersChange.setNegativeDiffPeriod?.(e.target.value)
            }
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="1day">1 кунлик</option>
            <option value="7days">7 кунлик</option>
            <option value="30days">30 кунлик</option>
            <option value="1month">1 ойлик</option>
            <option value="6months">6 ойлик</option>
            <option value="1year">1 йиллик</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm whitespace-nowrap"
          >
            Янгилаш
          </button>
        </div>
      </div>

      {analysisData.negativeDifferenceData &&
      analysisData.negativeDifferenceData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Манфий фарқ билан заправка мажвуд эмас
        </div>
      ) : (
        <div className="grid gap-3 lg:gap-4">
          {analysisData.negativeDifferenceData &&
            analysisData.negativeDifferenceData.map((station, index) => (
              <div
                key={station.stationId}
                className="p-3 lg:p-4 bg-white rounded-lg border border-red-200"
              >
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-2 mb-2">
                  <h4 className="font-semibold text-sm lg:text-base">
                    {station.stationName}
                  </h4>
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                    {formatNumber(station.difference || 0)} м3
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs lg:text-sm">
                  <div>
                    <p>
                      AutoPilot: {formatNumber(station.autopilotReading || 0)}{" "}
                      м3
                    </p>
                    <p>
                      Жами шланглар: {formatNumber(station.hoseTotalGas || 0)}{" "}
                      м3
                    </p>
                  </div>
                  <div className="text-right sm:text-left">
                    <p className="text-gray-600">
                      {formatDate(station.reportDate)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  const renderMissingReportsDetails = () => (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-4">
        <h3 className="text-xl font-semibold">Топиширилмаган ҳисоботлар</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={filters.missingReportsPeriod || "30days"}
            onChange={(e) =>
              onFiltersChange.setMissingReportsPeriod?.(e.target.value)
            }
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="1day">1 кун</option>
            <option value="7days">7 кун</option>
            <option value="30days">30 кун</option>
            <option value="1month">1 ой</option>
            <option value="6months">6 ой</option>
            <option value="1year">1 йил</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm whitespace-nowrap"
          >
            Янгилаш
          </button>
        </div>
      </div>

      {analysisData.missingReportsData &&
      analysisData.missingReportsData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {getPeriodDisplayName(filters.missingReportsPeriod)} Барча ҳисоботлар
          топширилган{" "}
        </div>
      ) : (
        <div className="grid gap-3 lg:gap-4">
          {analysisData.missingReportsData &&
            analysisData.missingReportsData.map((station, index) => (
              <div
                key={`${station.stationId}-${station.missingDate}`}
                className="p-3 lg:p-4 bg-white rounded-lg border border-orange-200"
              >
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-2">
                  <div>
                    <h4 className="font-semibold text-sm lg:text-base">
                      {station.stationName}
                    </h4>
                    <p className="text-xs lg:text-sm text-gray-600">
                      {formatDate(station.missingDate)} кунга ҳисобот мавжуд
                      эмас
                    </p>
                  </div>
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm mt-2 lg:mt-0">
                    Ўтиб кетган
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  const renderControlDifferenceDetails = () => {
    const [expandedStation, setExpandedStation] = useState(null);

    const toggleStation = (stationKey) => {
      setExpandedStation(expandedStation === stationKey ? null : stationKey);
    };

    // Защита от undefined данных
    if (!analysisData || !analysisData.controlDifferenceData) {
      return (
        <div className="text-center py-8 text-gray-500">
          Назорат суммаси маълумотлари мавжуд эмас
        </div>
      );
    }

    const controlData = analysisData.controlDifferenceData;

    // Проверяем, является ли controlData массивом
    if (!Array.isArray(controlData)) {
      return (
        <div className="text-center py-8 text-gray-500">
          Маълумотлар формати нотўғри
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-4">
          <h3 className="text-xl font-semibold">Назорат сумма фарқлари</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={filters.controlDiffPeriod || "yesterday"}
              onChange={(e) =>
                onFiltersChange.setControlDiffPeriod?.(e.target.value)
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="yesterday">Кеча</option>
              <option value="7days">7 кун</option>
              <option value="30days">30 кун</option>
              <option value="1month">Ой</option>
              <option value="6months">Ярим йил</option>
              <option value="1year">Йил</option>
            </select>
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm whitespace-nowrap"
            >
              Янгилаш
            </button>
          </div>
        </div>

        {controlData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Назорат сумма фарқлари аниқланмади{" "}
            {getPeriodDisplayName(filters.controlDiffPeriod)}
          </div>
        ) : (
          <div className="space-y-3">
            {controlData.map((report, index) => {
              // Защита от undefined report
              if (!report) return null;

              const stationKey = `${report.stationId || index}-${
                report.reportDate || index
              }`;

              // Получаем данные из отчета
              const cashAmount = report.cashAmount || 0;
              const humoAmount = report.humoAmount || 0;
              const uzcardAmount = report.uzcardAmount || 0;
              const electronicAmount = report.electronicAmount || 0;
              const controlSum = report.controlSum || 0;
              const totalPayments =
                report.totalPayments ||
                cashAmount + humoAmount + uzcardAmount + electronicAmount;
              const difference =
                report.difference || totalPayments - controlSum;

              return (
                <div
                  key={stationKey}
                  className="bg-white rounded-xl border border-purple-200 overflow-hidden shadow-sm"
                >
                  {/* Заголовок станции */}
                  <div
                    className="p-4 cursor-pointer hover:bg-purple-50 transition-colors"
                    onClick={() => toggleStation(stationKey)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg text-gray-900">
                          {report.stationName || `Станция ${index + 1}`}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {report.reportDate
                            ? formatDate(report.reportDate)
                            : "Номаълум сана"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Индикатор разницы */}
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            difference > 0
                              ? "bg-red-100 text-red-800"
                              : difference < 0
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {difference > 0 ? "+" : ""}
                          {formatCurrency(difference)}
                        </span>

                        <svg
                          className={`w-5 h-5 text-gray-500 transition-transform ${
                            expandedStation === stationKey ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Детали по станции */}
                  <AnimatePresence>
                    {expandedStation === stationKey && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-purple-100"
                      >
                        <div className="p-4 space-y-4 bg-gray-50">
                          {/* Общая информация */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-white rounded-lg border border-green-200">
                              <div className="font-semibold text-gray-600 text-sm">
                                Жами тушум
                              </div>
                              <div className="text-green-600 font-bold text-lg">
                                {formatCurrency(totalPayments)}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Нақд: {formatCurrency(cashAmount)}
                                <br />
                                HUMO: {formatCurrency(humoAmount)}
                                <br />
                                Uzcard: {formatCurrency(uzcardAmount)}
                                <br />
                                Электрон: {formatCurrency(electronicAmount)}
                              </div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border border-blue-200">
                              <div className="font-semibold text-gray-600 text-sm">
                                Назорат суммаси
                              </div>
                              <div className="text-blue-600 font-bold text-lg">
                                {formatCurrency(controlSum)}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Фарқ: {formatCurrency(difference)}
                                <br />
                                Фоиз:{" "}
                                {controlSum > 0
                                  ? `${(
                                      (difference / controlSum) *
                                      100
                                    ).toFixed(2)}%`
                                  : "0%"}
                              </div>
                            </div>
                          </div>

                          {/* Детали по типам платежей */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="text-center p-3 bg-white rounded-lg border border-yellow-200">
                              <div className="text-xl mb-2">💵</div>
                              <div className="font-semibold text-gray-700">
                                Нақд
                              </div>
                              <div className="text-lg font-bold text-gray-900">
                                {formatCurrency(cashAmount)}
                              </div>
                            </div>

                            <div className="text-center p-3 bg-white rounded-lg border border-blue-200">
                              <div className="text-xl mb-2">💳</div>
                              <div className="font-semibold text-gray-700">
                                HUMO
                              </div>
                              <div className="text-lg font-bold text-gray-900">
                                {formatCurrency(humoAmount)}
                              </div>
                            </div>

                            <div className="text-center p-3 bg-white rounded-lg border border-purple-200">
                              <div className="text-xl mb-2">💳</div>
                              <div className="font-semibold text-gray-700">
                                Uzcard
                              </div>
                              <div className="text-lg font-bold text-gray-900">
                                {formatCurrency(uzcardAmount)}
                              </div>
                            </div>

                            <div className="text-center p-3 bg-white rounded-lg border border-orange-200">
                              <div className="text-xl mb-2">📱</div>
                              <div className="font-semibold text-gray-700">
                                Электрон
                              </div>
                              <div className="text-lg font-bold text-gray-900">
                                {formatCurrency(electronicAmount)}
                              </div>
                            </div>
                          </div>

                          {/* Сводка */}
                          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                            <div className="text-sm font-semibold text-yellow-800 mb-2 text-center">
                              Таҳлил натижалари
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between items-center py-1 border-b border-yellow-200">
                                <span>Жами тушум:</span>
                                <span className="font-semibold text-green-600">
                                  {formatCurrency(totalPayments)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-1 border-b border-yellow-200">
                                <span>Назорат суммаси:</span>
                                <span className="font-semibold text-blue-600">
                                  {formatCurrency(controlSum)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-1 border-b border-yellow-300">
                                <span>Фарқ:</span>
                                <span
                                  className={`font-bold ${
                                    difference > 0
                                      ? "text-red-600"
                                      : "text-green-600"
                                  }`}
                                >
                                  {difference > 0 ? "+" : ""}
                                  {formatCurrency(difference)}
                                </span>
                              </div>
                              <div className="pt-2 mt-2 border-t border-yellow-300">
                                <div className="text-xs text-gray-600">
                                  Фарқ 100 сўмдан ортиқ бўлса, муаммоли ҳисобот
                                  деб қаралади
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderExpiredDocumentsDetails = () => {
    // Защита от undefined данных
    if (!analysisData || !analysisData.expiredDocumentsData) {
      return (
        <div className="text-center py-8 text-gray-500">
          Хужжатлар маълумотлари мавжуд эмас
        </div>
      );
    }

    const expiredData = analysisData.expiredDocumentsData;

    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold mb-4">Муддати ўтган хужжатлар</h3>

        {!Array.isArray(expiredData) || expiredData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Муддати ўтган хужжатлар мавжуд эмас
          </div>
        ) : (
          <div className="grid gap-3 lg:gap-4">
            {expiredData.map((station, index) => (
              <div
                key={index}
                className="p-3 lg:p-4 bg-white rounded-lg border border-yellow-200"
              >
                <h4 className="font-semibold mb-3 text-sm lg:text-base">
                  {station.stationName}
                </h4>

                <div className="space-y-2">
                  {station.documents &&
                    station.documents.map((doc, docIndex) => (
                      <div
                        key={docIndex}
                        className="p-2 lg:p-3 bg-red-50 rounded border border-red-200"
                      >
                        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-2">
                          <div>
                            <p className="font-semibold text-sm lg:text-base">
                              {doc.docType}
                            </p>
                            <p className="text-xs lg:text-sm">
                              № {doc.docNumber}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-red-600 font-semibold text-sm lg:text-base">
                              {doc.daysOverdue} кунга муддати ўтган
                            </p>
                            <p className="text-xs lg:text-sm text-gray-600">
                              Муддати ўтган сана: {formatDate(doc.expiryDate)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderGasAndPaymentsDetails = () => (
    <GasAndPaymentsDetails
      analysisData={analysisData}
      filters={filters}
      onFiltersChange={onFiltersChange}
      onRefresh={onRefresh}
    />
  );

  const renderDetails = () => {
    switch (selectedAnalysis.type) {
      case "autopilot":
        return renderAutopilotDetails();
      case "comparison":
        return renderComparisonDetails();
      case "negativeDifference":
        return renderNegativeDifferenceDetails();
      case "missingReports":
        return renderMissingReportsDetails();
      case "controlDifference":
        return renderControlDifferenceDetails();
      case "expiredDocuments":
        return renderExpiredDocumentsDetails();
      case "gasAndPayments":
        return renderGasAndPaymentsDetails();
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 lg:p-6 bg-white rounded-2xl shadow-lg mb-6"
    >
      {renderDetails()}
    </motion.div>
  );
};
