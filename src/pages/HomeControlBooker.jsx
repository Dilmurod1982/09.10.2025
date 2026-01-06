// pages/HomeTasischi.jsx
import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import {
  useStationAnalytics,
  getPeriodDisplayName,
} from "../hooks/useStationAnalytics";
import { AnalysisCard, AnalysisDetails } from "../hooks/AnalysisComponents";

const HomeControlBooker = () => {
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [comparisonType, setComparisonType] = useState("yesterday");
  const [negativeDiffPeriod, setNegativeDiffPeriod] = useState("30days");
  const [missingReportsPeriod, setMissingReportsPeriod] = useState("30days");
  const [controlDiffPeriod, setControlDiffPeriod] = useState("30days");
  const [autopilotPeriod, setAutopilotPeriod] = useState("30days");
  const [gasPaymentsPeriod, setGasPaymentsPeriod] = useState("30days");
  const [gasPaymentsDateRange, setGasPaymentsDateRange] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [allStations, setAllStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Мемоизируем ID станций
  const stationIds = useMemo(
    () => allStations.map((station) => station.id),
    [allStations]
  );

  // Хук аналитики - передаем stationIds только когда они есть
  const { analysisData, loading, error, loadAnalysisData, debugInfo } =
    useStationAnalytics(stationIds.length > 0 ? stationIds : []);

  // Функция для загрузки всех станций
  const loadAllStations = async () => {
    try {
      if (hasLoaded) return; // Уже загружены

      // console.log("🚀 Загрузка всех станций...");
      setLoadingStations(true);

      const stationsRef = collection(db, "stations");
      const snapshot = await getDocs(stationsRef);
      const stations = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // console.log("✅ Загружено станций:", stations.length);
      if (stations.length > 0) {
        // console.log("📋 Первая станция:", stations[0]);
      }

      setAllStations(stations);
      setLoadingStations(false);
      setHasLoaded(true);

      return stations;
    } catch (error) {
      console.error("❌ Ошибка загрузки станций:", error);
      setLoadingStations(false);
      return [];
    }
  };

  // Функция для применения фильтров
  const applyFilters = () => {
    if (stationIds.length === 0) {
      // console.log("⚠️ Нет станций для загрузки данных");
      return;
    }

    // console.log("🎯 Применение фильтров для", stationIds.length, "станций");

    loadAnalysisData({
      negativeDiffPeriod,
      missingReportsPeriod,
      controlDiffPeriod,
      comparisonType,
      autopilotPeriod,
      gasPaymentsPeriod,
      gasPaymentsDateRange,
    });

    setLastRefresh(new Date().toLocaleTimeString());
  };

  // Загружаем станции при первом монтировании
  useEffect(() => {
    // console.log("🔄 Первоначальная загрузка станций");
    loadAllStations();
  }, []); // Пустой массив зависимостей - только при монтировании

  // Загружаем данные после загрузки станций
  useEffect(() => {
    if (stationIds.length > 0 && !loading && !hasLoaded) {
      // console.log("🏁 Станции загружены, запуск анализа...");

      // Небольшая задержка перед первым запуском
      const timer = setTimeout(() => {
        applyFilters();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [stationIds, loading]); // Зависимость от stationIds и loading

  // Обработка изменения фильтров
  useEffect(() => {
    if (stationIds.length === 0) return;

    // Дебаунс - ждем 500мс после последнего изменения
    const timer = setTimeout(() => {
      applyFilters();
    }, 500);

    return () => clearTimeout(timer);
  }, [
    comparisonType,
    negativeDiffPeriod,
    missingReportsPeriod,
    controlDiffPeriod,
    autopilotPeriod,
    gasPaymentsPeriod,
    gasPaymentsDateRange,
    stationIds.length, // Добавляем длину массива как зависимость
  ]);

  // Функция для принудительного обновления
  const handleForceRefresh = () => {
    // console.log("🔄 Принудительное обновление данных");
    applyFilters();
  };

  // Функция для перезагрузки станций
  const handleReloadStations = async () => {
    // console.log("🔄 Перезагрузка станций");
    setHasLoaded(false);
    await loadAllStations();
  };

  const isLoading = loading || loadingStations;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <div className="text-lg text-gray-600 mb-3">
            {loadingStations
              ? "Заправкалар юкланмоқда..."
              : "Таҳлиллар юкланмоқда..."}
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <div>Юкланган заправкалар: {allStations.length}</div>
            <div>Ҳисоботлар: {debugInfo.reportsCount || 0}</div>
            <div>Статус: {hasLoaded ? "Загружено" : "Загрузка..."}</div>
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
          <div className="text-xs text-gray-500 mb-3">
            Заправкалар сони: {allStations.length}
          </div>
          <button
            onClick={handleForceRefresh}
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm mr-2 mb-2"
          >
            Қайта уриниш
          </button>
          <button
            onClick={handleReloadStations}
            className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
          >
            Заправкаларни янгилаш
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
            <p className="text-xs text-gray-600">Назорат бухгалтери</p>
            <div className="text-xs text-gray-500 mt-1">
              {allStations.length} заправка, {debugInfo.reportsCount} ҳисобот
              {lastRefresh && ` • Янгиланган: ${lastRefresh}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500 text-right">
              {debugInfo.loadedCollections?.length || 0} коллекция
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Отладочная информация */}
        {/* <div className="mb-3 p-2 bg-gray-100 rounded-lg border border-gray-300 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              Заправкалар:{" "}
              <span className="font-semibold">{allStations.length}</span>
            </div>
            <div>
              ID:{" "}
              <span className="font-semibold">
                {stationIds[0]?.substring(0, 8)}...
              </span>
            </div>
            <div>
              Ҳисоботлар:{" "}
              <span className="font-semibold">{debugInfo.reportsCount}</span>
            </div>
            <div>
              Хужжатлар:{" "}
              <span className="font-semibold">{debugInfo.documentsCount}</span>
            </div>
          </div>
        </div> */}

        {/* Мобильное меню анализов */}
        {mobileMenuOpen && (
          <div className="mb-4 bg-white rounded-xl shadow-lg p-3 border border-gray-200">
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
                title="Минуслар"
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
                    : analysisData.gasAndPaymentsData.length || 0
                }
                onClick={() => {
                  setSelectedAnalysis({ type: "gasAndPayments" });
                  setMobileMenuOpen(false);
                }}
                color="teal"
                icon="⛽"
                isActive={selectedAnalysis?.type === "gasAndPayments"}
              />

              <div
                className="p-2 rounded-lg border cursor-pointer transition-all duration-200 bg-gray-50 border-gray-200 hover:bg-gray-100 flex flex-col items-center justify-center text-center min-h-[60px]"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSelectedAnalysis(null);
                }}
              >
                <div className="text-lg mb-1">🏠</div>
                <div className="text-xs font-semibold text-gray-900 mb-1">
                  Асосий
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Основной контент */}
        <div className="space-y-3">
          {/* Детали анализа */}
          {selectedAnalysis && (
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
              onRefresh={handleForceRefresh}
            />
          )}

          {/* Статистика по данным (только если не выбран конкретный анализ) */}
          {!selectedAnalysis && (
            <>
              {/* Краткая статистика */}
              <div className="p-3 bg-white rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-base font-semibold mb-3">
                  Умумий статистика ({debugInfo.reportsCount} ҳисобот)
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-center p-2 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="font-semibold text-blue-600 text-sm">
                      {analysisData.autopilotData.length}
                    </div>
                    <div className="text-gray-600">AutoPilot</div>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded-lg border border-green-200">
                    <div className="font-semibold text-green-600 text-sm">
                      {analysisData.comparisonData.length}
                    </div>
                    <div className="text-gray-600">Солиштириш</div>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded-lg border border-red-200">
                    <div className="font-semibold text-red-600 text-sm">
                      {analysisData.negativeDifferenceData.length}
                    </div>
                    <div className="text-gray-600">Муаммолар</div>
                  </div>
                  <div className="text-center p-2 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="font-semibold text-purple-600 text-sm">
                      {analysisData.controlDifferenceData.length}
                    </div>
                    <div className="text-gray-600">Молия</div>
                  </div>
                  <div className="text-center p-2 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="font-semibold text-orange-600 text-sm">
                      {analysisData.missingReportsData.length}
                    </div>
                    <div className="text-gray-600">Ҳисобот йук</div>
                  </div>
                  <div className="text-center p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="font-semibold text-yellow-600 text-sm">
                      {analysisData.expiredDocumentsData.length}
                    </div>
                    <div className="text-gray-600">Хужжатлар</div>
                  </div>
                </div>
              </div>

              {/* Информация о последних отчетах */}
              {/* <div className="p-3 bg-white rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-base font-semibold mb-3">
                  Соңги маълумотлар
                </h3>
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Заправкалар:</span>
                    <span className="font-semibold">{allStations.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Жами ҳисоботлар:</span>
                    <span className="font-semibold">
                      {debugInfo.reportsCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Хужжатлар:</span>
                    <span className="font-semibold">
                      {debugInfo.documentsCount}
                    </span>
                  </div>
                  {debugInfo.lastLoadTime && (
                    <div className="flex justify-between">
                      <span>Охирги янгиланиш:</span>
                      <span className="font-semibold">
                        {new Date(debugInfo.lastLoadTime).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Кнопка принудительного обновления */}
              {/* <div className="mt-3 pt-3 border-t border-gray-200">
                  <button
                    onClick={handleForceRefresh}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Маълумотларни янгилаш
                  </button>
                </div> */}
              {/* </div> */}
            </>
          )}
        </div>

        {/* Плавающая кнопка меню когда ничего не выбрано */}
        {!selectedAnalysis && !mobileMenuOpen && (
          <div className="fixed bottom-4 right-4 z-50">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 hover:scale-110"
            >
              <span className="text-lg">☰</span>
            </button>
          </div>
        )}

        {/* Плавающая кнопка возврата к основному экрану */}
        {selectedAnalysis && (
          <div className="fixed bottom-4 right-4 z-50">
            <button
              onClick={() => setSelectedAnalysis(null)}
              className="p-3 bg-gray-600 text-white rounded-full shadow-lg hover:bg-gray-700 transition-all duration-200 hover:scale-110"
            >
              <span className="text-lg">🏠</span>
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
      onClick={onClick}
    >
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-xs font-semibold text-gray-900 mb-1">{title}</div>
      <div className="text-xs text-gray-600">{value || 0}</div>
    </div>
  );
};

export default HomeControlBooker;
