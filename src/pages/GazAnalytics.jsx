import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  Award,
  RefreshCw,
  Filter,
  Printer,
  FileSpreadsheet,
  ArrowLeftRight,
  Loader,
  Download,
} from "lucide-react";
import { db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  ComposedChart,
  Bar,
  Legend,
  BarChart,
} from "recharts";
import * as XLSX from "xlsx";

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#06b6d4",
  "#f472b6",
  "#6366f1",
  "#14b8a6",
];

const GasAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [stationsData, setStationsData] = useState([]);
  const [selectedStation, setSelectedStation] = useState("all");
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [uniquePeriods, setUniquePeriods] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [exportLoading, setExportLoading] = useState(false);
  const [comparisonPeriod, setComparisonPeriod] = useState("");

  // Функция расчета стабильности
  const calculateStability = (monthlyData) => {
    const values = Object.values(monthlyData).filter((v) => v > 0);
    if (values.length < 2) return 100;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean !== 0 ? (stdDev / mean) * 100 : 0;
    return Math.max(0, 100 - cv);
  };

  // Функция определения статуса станции
  const getStationStatus = (station, stationStatsList) => {
    const { totalGas, recentGrowth, stability, count } = station;
    const avgTotal =
      stationStatsList.length > 0
        ? stationStatsList.reduce((sum, s) => sum + s.totalGas, 0) /
          stationStatsList.length
        : 0;
    const isHighVolume = totalGas > avgTotal * 1.2;

    if (count < 2) return "stable";

    if (isHighVolume && recentGrowth > 5) return "leader";
    if (stability > 70 && recentGrowth > -5 && recentGrowth < 5)
      return "stable";
    if (recentGrowth < -30) return "critical";
    if (recentGrowth < -10) return "problem";

    return "stable";
  };

  // Получение предыдущего месяца
  const getPreviousMonth = (period) => {
    if (!period) return null;
    const [year, month] = period.split("-").map(Number);
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  };

  // Загрузка данных
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const mainDocRef = doc(db, "gasSettlements", "main");

        const mainSnap = await getDoc(mainDocRef);

        if (mainSnap.exists()) {
          const mainData = mainSnap.data();

          const gasData = mainData.data || [];
          const stations = mainData.mainData || [];

          console.log("📊 Всего записей газа:", gasData.length);
          console.log("🏪 Количество станций:", stations.length);

          setData(gasData);
          setStationsData(stations);

          const periods = [
            ...new Set(gasData.map((item) => item.period)),
          ].sort();
          setUniquePeriods(periods);

          if (periods.length > 0) {
            setSelectedPeriod(periods[periods.length - 1]);
            const prev = getPreviousMonth(periods[periods.length - 1]);
            if (prev && periods.includes(prev)) {
              setComparisonPeriod(prev);
            }
          }
        }

        setLoading(false);
      } catch (error) {
        console.error("❌ Ошибка загрузки данных:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Фильтрация данных
  const filteredData = useMemo(() => {
    let filtered = [...data];

    if (selectedStation !== "all") {
      filtered = filtered.filter(
        (item) => String(item.stationId) === String(selectedStation)
      );
    }

    if (selectedPeriod !== "all") {
      filtered = filtered.filter((item) => item.period === selectedPeriod);
    }

    return filtered;
  }, [data, selectedStation, selectedPeriod]);

  // Данные для сравнения (предыдущий месяц)
  const comparisonData = useMemo(() => {
    if (!comparisonPeriod || comparisonPeriod === "all") return [];
    return data.filter((item) => item.period === comparisonPeriod);
  }, [data, comparisonPeriod]);

  // Получение названия станции
  const getStationName = (stationId) => {
    if (!stationId) return "Неизвестная станция";
    const stationIdStr = String(stationId);
    const station = stationsData.find((s) => String(s.id) === stationIdStr);
    if (station) {
      return station.landmark || station.name || `Станция ${stationId}`;
    }
    return `Станция ${stationId}`;
  };

  // Получение полного названия (landmark + name)
  const getStationFullDisplay = (stationId) => {
    if (!stationId) return "Неизвестная станция";
    const stationIdStr = String(stationId);
    const station = stationsData.find((s) => String(s.id) === stationIdStr);
    if (station) {
      const landmark = station.landmark || "";
      const name = station.name || "";
      if (landmark && name) {
        return `${landmark} (${name})`;
      }
      return landmark || name || `Станция ${stationId}`;
    }
    return `Станция ${stationId}`;
  };

  const getStationInfo = (stationId) => {
    if (!stationId) return null;
    const stationIdStr = String(stationId);
    return stationsData.find((s) => String(s.id) === stationIdStr) || null;
  };

  // Статистика по периодам
  const periodStats = useMemo(() => {
    const stats = {};
    filteredData.forEach((item) => {
      if (!stats[item.period]) {
        stats[item.period] = {
          period: item.period,
          totalGas: 0,
          count: 0,
          stations: new Set(),
        };
      }
      stats[item.period].totalGas += item.totalGas || 0;
      stats[item.period].count += 1;
      if (item.stationId) stats[item.period].stations.add(item.stationId);
    });

    return Object.values(stats)
      .map((s) => ({
        ...s,
        stations: s.stations.size,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [filteredData]);

  // Общая статистика
  const overallStats = useMemo(() => {
    const totalGas = filteredData.reduce(
      (sum, item) => sum + (item.totalGas || 0),
      0
    );
    const avgMonthly =
      periodStats.length > 0 ? totalGas / periodStats.length : 0;

    let growth = 0;
    if (periodStats.length >= 2) {
      const last = periodStats[periodStats.length - 1].totalGas;
      const prev = periodStats[periodStats.length - 2].totalGas;
      growth = prev !== 0 ? ((last - prev) / prev) * 100 : 0;
    }

    return {
      totalGas,
      avgMonthly,
      growth,
      periodsCount: periodStats.length,
      stationsCount: new Set(filteredData.map((item) => item.stationId)).size,
    };
  }, [filteredData, periodStats]);

  // Данные по станциям
  const stationStats = useMemo(() => {
    const stats = {};

    filteredData.forEach((item) => {
      const id = String(item.stationId);

      if (!stats[id]) {
        const stationInfo = getStationInfo(id);
        const stationName = getStationFullDisplay(id);

        stats[id] = {
          stationId: id,
          name: stationName,
          landmark: stationInfo?.landmark || "",
          fullName: stationInfo?.name || "",
          displayName: getStationFullDisplay(id),
          totalGas: 0,
          totalAmount: 0,
          count: 0,
          periods: [],
          monthlyData: {},
        };
      }
      stats[id].totalGas += item.totalGas || 0;
      stats[id].totalAmount += item.amountOfGas || 0;
      stats[id].count += 1;
      stats[id].periods.push(item.period);
      stats[id].monthlyData[item.period] = item.totalGas || 0;
    });

    const result = Object.values(stats).map((s) => {
      const sortedPeriods = Object.keys(s.monthlyData).sort();
      s.periods = sortedPeriods;
      s.avgMonthly = s.totalGas / Math.max(s.count, 1);
      s.stability = s.count > 1 ? calculateStability(s.monthlyData) : 0;

      const lastMonths = sortedPeriods.slice(-3);
      const values = lastMonths.map((p) => s.monthlyData[p] || 0);
      s.recentGrowth =
        values.length >= 2
          ? ((values[values.length - 1] - values[0]) / Math.max(values[0], 1)) *
            100
          : 0;

      return s;
    });

    const sortedResult = result.sort((a, b) => b.totalGas - a.totalGas);

    return sortedResult.map((s, index, arr) => ({
      ...s,
      status: getStationStatus(s, arr),
    }));
  }, [filteredData, stationsData]);

  // Данные для сравнения по станциям
  const comparisonResult = useMemo(() => {
    const result = [];
    const currentPeriod = selectedPeriod;
    const prevPeriod = comparisonPeriod;

    if (
      !currentPeriod ||
      !prevPeriod ||
      currentPeriod === "all" ||
      prevPeriod === "all"
    ) {
      return [];
    }

    const currentStationIds = new Set();
    filteredData.forEach((item) =>
      currentStationIds.add(String(item.stationId))
    );
    comparisonData.forEach((item) =>
      currentStationIds.add(String(item.stationId))
    );

    currentStationIds.forEach((id) => {
      const stationInfo = getStationInfo(id);
      const name = getStationFullDisplay(id);

      const current = filteredData.find(
        (item) => String(item.stationId) === id
      );
      const prev = comparisonData.find((item) => String(item.stationId) === id);

      const currentGas = current?.totalGas || 0;
      const prevGas = prev?.totalGas || 0;
      const diff = currentGas - prevGas;
      const percentChange =
        prevGas !== 0 ? (diff / prevGas) * 100 : currentGas > 0 ? 100 : 0;

      result.push({
        stationId: id,
        name: name,
        currentGas: currentGas,
        prevGas: prevGas,
        diff: diff,
        percentChange: percentChange,
        status: diff > 0 ? "up" : diff < 0 ? "down" : "same",
        hasCurrent: !!current,
        hasPrev: !!prev,
      });
    });

    result.sort((a, b) => b.percentChange - a.percentChange);

    return result;
  }, [
    filteredData,
    comparisonData,
    selectedPeriod,
    comparisonPeriod,
    stationsData,
  ]);

  // Данные для графика
  const chartData = useMemo(() => {
    return periodStats.map((p) => ({
      period: p.period,
      totalGas: Math.round(p.totalGas),
      count: p.count,
    }));
  }, [periodStats]);

  // Данные для круговой диаграммы
  const pieData = useMemo(() => {
    const total = stationStats.reduce((sum, s) => sum + s.totalGas, 0);
    return stationStats
      .map((s) => ({
        name: s.displayName || s.landmark || s.name,
        value: Math.round(s.totalGas),
        percent: total > 0 ? (s.totalGas / total) * 100 : 0,
        status: s.status,
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [stationStats]);

  // Топ станций
  const topStations = stationStats.slice(0, 10);

  // График сравнения
  const comparisonChartData = useMemo(() => {
    return comparisonResult.map((item) => ({
      name:
        item.name.length > 20 ? item.name.substring(0, 20) + "..." : item.name,
      Текущий: Math.round(item.currentGas),
      Прошлый: Math.round(item.prevGas),
      diff: Math.round(item.diff),
    }));
  }, [comparisonResult]);

  // ===================== ЭКСПОРТ В EXCEL =====================

  // 1. Общий обзор
  const getOverviewExcelData = () => {
    return periodStats.map((p) => ({
      Период: p.period,
      "Объем газа (м³)": Math.round(p.totalGas),
      "Количество станций": p.stations,
      "Количество записей": p.count,
    }));
  };

  // 2. Станции (доли)
  const getStationsExcelData = () => {
    return pieData.map((s) => ({
      Станция: s.name,
      "Объем газа (м³)": s.value,
      "Доля (%)": s.percent.toFixed(2),
      Статус:
        s.status === "leader"
          ? "Лидер"
          : s.status === "stable"
          ? "Стабильный"
          : s.status === "problem"
          ? "Проблемный"
          : "Критический",
    }));
  };

  // 3. Рейтинг станций
  const getRankingExcelData = () => {
    return stationStats.map((s, index) => ({
      Место: index + 1,
      Станция: s.displayName || s.landmark || s.name,
      "Полное название": s.fullName || "",
      "Объем газа (м³)": Math.round(s.totalGas),
      "Средний объем (м³)": Math.round(s.avgMonthly),
      "Динамика (%)": s.recentGrowth.toFixed(1),
      "Стабильность (%)": s.stability.toFixed(0),
      "Количество месяцев": s.count,
      Статус:
        s.status === "leader"
          ? "Лидер"
          : s.status === "stable"
          ? "Стабильный"
          : s.status === "problem"
          ? "Проблемный"
          : "Критический",
    }));
  };

  // 4. Динамика станций
  const getDynamicsExcelData = () => {
    return stationStats.map((s) => ({
      Станция: s.displayName || s.landmark || s.name,
      "Всего (м³)": Math.round(s.totalGas),
      "Средний (м³)": Math.round(s.avgMonthly),
      "Динамика (%)": s.recentGrowth.toFixed(1),
      "Стабильность (%)": s.stability.toFixed(0),
      Статус:
        s.status === "leader"
          ? "Лидер"
          : s.status === "stable"
          ? "Стабильный"
          : s.status === "problem"
          ? "Проблемный"
          : "Критический",
    }));
  };

  // 5. Сравнение с прошлым месяцем - ИСПРАВЛЕНО
  const getComparisonExcelData = () => {
    return comparisonResult.map((item) => ({
      Номи: item.name,
      [`${selectedPeriod} (м³)`]: Math.round(item.currentGas),
      [`${comparisonPeriod} (м³)`]: Math.round(item.prevGas),
      "Ўзгариш (м³)": Math.round(item.diff),
      "Ўзгариш (%)": item.percentChange.toFixed(1),
      Статус:
        item.status === "up"
          ? "Ўсиш"
          : item.status === "down"
          ? "Пасайиш"
          : "Ўзгаришсиз",
    }));
  };

  // Полный экспорт всех анализов
  const exportFullAnalytics = () => {
    try {
      setExportLoading(true);

      const wb = XLSX.utils.book_new();

      // 1. Лист "Общий обзор"
      const overviewData = getOverviewExcelData();
      const ws1 = XLSX.utils.json_to_sheet(overviewData);
      XLSX.utils.book_append_sheet(wb, ws1, "Общий обзор");

      // 2. Лист "Станции"
      const stationsDataExport = getStationsExcelData();
      const ws2 = XLSX.utils.json_to_sheet(stationsDataExport);
      XLSX.utils.book_append_sheet(wb, ws2, "Станции");

      // 3. Лист "Рейтинг"
      const rankingData = getRankingExcelData();
      const ws3 = XLSX.utils.json_to_sheet(rankingData);
      XLSX.utils.book_append_sheet(wb, ws3, "Рейтинг");

      // 4. Лист "Динамика"
      const dynamicsData = getDynamicsExcelData();
      const ws4 = XLSX.utils.json_to_sheet(dynamicsData);
      XLSX.utils.book_append_sheet(wb, ws4, "Динамика");

      // 5. Лист "Сравнение"
      const comparisonDataExport = getComparisonExcelData();
      const ws5 = XLSX.utils.json_to_sheet(comparisonDataExport);
      XLSX.utils.book_append_sheet(wb, ws5, "Сравнение");

      // 6. Лист "Сводка"
      const summaryData = [
        {
          Показатель: "Общий объем газа",
          Значение: `${Math.round(overallStats.totalGas).toLocaleString()} м³`,
        },
        {
          Показатель: "Средний месячный объем",
          Значение: `${Math.round(
            overallStats.avgMonthly
          ).toLocaleString()} м³`,
        },
        {
          Показатель: "Рост/падение",
          Значение:
            overallStats.growth >= 0
              ? `+${overallStats.growth.toFixed(1)}%`
              : `${overallStats.growth.toFixed(1)}%`,
        },
        {
          Показатель: "Количество периодов",
          Значение: overallStats.periodsCount,
        },
        {
          Показатель: "Активных станций",
          Значение: overallStats.stationsCount,
        },
        {
          Показатель: "Лидеры",
          Значение: stationStats.filter((s) => s.status === "leader").length,
        },
        {
          Показатель: "Стабильные",
          Значение: stationStats.filter((s) => s.status === "stable").length,
        },
        {
          Показатель: "Проблемные",
          Значение: stationStats.filter((s) => s.status === "problem").length,
        },
        {
          Показатель: "Критические",
          Значение: stationStats.filter((s) => s.status === "critical").length,
        },
      ];
      const ws6 = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws6, "Сводка");

      // Сохраняем файл
      XLSX.writeFile(
        wb,
        `Газ_аналитика_полная_${new Date().toISOString().split("T")[0]}.xlsx`
      );

      setExportLoading(false);
    } catch (error) {
      console.error("Ошибка экспорта:", error);
      setExportLoading(false);
    }
  };

  // Экспорт текущей вкладки
  const exportCurrentTab = () => {
    try {
      setExportLoading(true);

      const wb = XLSX.utils.book_new();
      let data = [];
      let sheetName = "";

      switch (activeTab) {
        case "overview":
          data = getOverviewExcelData();
          sheetName = "Общий обзор";
          break;
        case "stations":
          data = getStationsExcelData();
          sheetName = "Станции";
          break;
        case "ranking":
          data = getRankingExcelData();
          sheetName = "Рейтинг";
          break;
        case "dynamics":
          data = getDynamicsExcelData();
          sheetName = "Динамика";
          break;
        case "comparison":
          data = getComparisonExcelData();
          sheetName = "Сравнение";
          break;
        default:
          data = getOverviewExcelData();
          sheetName = "Данные";
      }

      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      XLSX.writeFile(
        wb,
        `${sheetName}_${new Date().toISOString().split("T")[0]}.xlsx`
      );

      setExportLoading(false);
    } catch (error) {
      console.error("Ошибка экспорта:", error);
      setExportLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatNumber = (num) => {
    if (num === undefined || num === null) return "0";
    return Math.round(num).toLocaleString("ru-RU");
  };

  const formatPercent = (num) => {
    if (num === undefined || num === null) return "0%";
    return `${num > 0 ? "+" : ""}${num.toFixed(1)}%`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "leader":
        return <Award className="w-5 h-5 text-emerald-600" />;
      case "stable":
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case "problem":
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case "critical":
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Minus className="w-5 h-5 text-gray-400" />;
    }
  };

  const getComparisonStatusColor = (percentChange) => {
    if (percentChange > 10) return "text-emerald-600 bg-emerald-50";
    if (percentChange > 0) return "text-green-500 bg-green-50";
    if (percentChange === 0) return "text-gray-500 bg-gray-50";
    if (percentChange > -10) return "text-orange-500 bg-orange-50";
    return "text-red-600 bg-red-50";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Загрузка данных аналитики...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 p-4 md:p-6 print:p-4">
      {/* Заголовок */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              📊 Газ бўйича тахлиллар
            </h1>
            <p className="text-gray-500 mt-1">
              Общий объем газа: {formatNumber(overallStats.totalGas)} м³ •
              Периодов: {overallStats.periodsCount} • Станций:{" "}
              {overallStats.stationsCount}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportCurrentTab}
              disabled={exportLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Download className="w-4 h-4" />
              {exportLoading ? "Экспорт..." : "Экспорт вкладки"}
            </button>
            <button
              onClick={exportFullAnalytics}
              disabled={exportLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {exportLoading ? "Экспорт..." : "Все анализы"}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-all shadow-md hover:shadow-lg"
            >
              <Printer className="w-4 h-4" />
              Печать
            </button>
          </div>
        </div>
      </motion.div>

      {/* Фильтры */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100"
      >
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Filter className="w-4 h-4 inline mr-1" />
              Станция
            </label>
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="all">Все станции</option>
              {stationStats.map((s) => (
                <option key={s.stationId} value={s.stationId}>
                  {s.displayName || s.landmark || s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Период
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                const prev = getPreviousMonth(e.target.value);
                if (prev && uniquePeriods.includes(prev)) {
                  setComparisonPeriod(prev);
                } else {
                  setComparisonPeriod("");
                }
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {uniquePeriods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {comparisonPeriod && (
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <ArrowLeftRight className="w-4 h-4 inline mr-1" />
                Сравнение с
              </label>
              <select
                value={comparisonPeriod}
                onChange={(e) => setComparisonPeriod(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {uniquePeriods
                  .filter((p) => p !== selectedPeriod)
                  .map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <button
            onClick={() => {
              setSelectedStation("all");
              if (uniquePeriods.length > 0) {
                setSelectedPeriod(uniquePeriods[uniquePeriods.length - 1]);
                const prev = getPreviousMonth(
                  uniquePeriods[uniquePeriods.length - 1]
                );
                if (prev && uniquePeriods.includes(prev)) {
                  setComparisonPeriod(prev);
                }
              }
            }}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Общая статистика */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      >
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Общий объем газа</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatNumber(overallStats.totalGas)} м³
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Средний месячный объем</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatNumber(overallStats.avgMonthly)} м³
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Рост/падение</p>
              <p
                className={`text-2xl font-bold ${
                  overallStats.growth >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatPercent(overallStats.growth)}
              </p>
            </div>
            <div
              className={`w-12 h-12 ${
                overallStats.growth >= 0 ? "bg-green-100" : "bg-red-100"
              } rounded-xl flex items-center justify-center`}
            >
              {overallStats.growth >= 0 ? (
                <TrendingUp className="w-6 h-6 text-green-600" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Активных станций</p>
              <p className="text-2xl font-bold text-emerald-600">
                {overallStats.stationsCount}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Вкладки */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 mb-6"
      >
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {[
            { id: "overview", label: "📊 Общий обзор" },
            { id: "stations", label: "🏪 Станции" },
            { id: "ranking", label: "🏆 Рейтинг" },
            { id: "dynamics", label: "📈 Динамика" },
            { id: "comparison", label: "📊 Сравнение" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Общий обзор */}
          {activeTab === "overview" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Объем газа по месяцам
                </h3>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <defs>
                        <linearGradient
                          id="colorGas"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={0.1}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="period" stroke="#888" fontSize={12} />
                      <YAxis
                        yAxisId="left"
                        stroke="#888"
                        fontSize={12}
                        tickFormatter={(v) => formatNumber(v)}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#888"
                        fontSize={12}
                        tickFormatter={(v) => formatNumber(v)}
                      />
                      <Tooltip
                        formatter={(value) => formatNumber(value) + " м³"}
                        contentStyle={{
                          backgroundColor: "white",
                          borderRadius: "12px",
                          border: "1px solid #e5e7eb",
                        }}
                      />
                      <Legend />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="totalGas"
                        name="Объем газа (м³)"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fill="url(#colorGas)"
                        dot={{ fill: "#3b82f6", r: 4 }}
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="count"
                        name="Количество записей"
                        fill="#8b5cf6"
                        opacity={0.4}
                        barSize={20}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Статистика по месяцам
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Период
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Объем (м³)
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Станций
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Записей
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Изменение
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {periodStats.map((p, index) => {
                        const prev =
                          index > 0 ? periodStats[index - 1].totalGas : null;
                        const change =
                          prev !== null
                            ? ((p.totalGas - prev) / prev) * 100
                            : null;
                        return (
                          <tr
                            key={p.period}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3 font-medium">
                              {p.period}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {formatNumber(p.totalGas)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {p.stations}
                            </td>
                            <td className="px-4 py-3 text-right">{p.count}</td>
                            <td className="px-4 py-3 text-right">
                              {change !== null ? (
                                <span
                                  className={`inline-flex items-center gap-1 ${
                                    change >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {change >= 0 ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )}
                                  {formatPercent(change)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* Станции - круговая диаграмма */}
          {activeTab === "stations" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Доля станций в общем объеме
                  </h3>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={120}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name.substring(0, 20)}${
                              name.length > 20 ? "..." : ""
                            } ${(percent * 100).toFixed(1)}%`
                          }
                        >
                          {pieData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [
                            `${formatNumber(value)} м³`,
                            name,
                          ]}
                          contentStyle={{
                            backgroundColor: "white",
                            borderRadius: "12px",
                            border: "1px solid #e5e7eb",
                          }}
                        />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Список станций
                  </h3>
                  <div className="overflow-y-auto max-h-[400px] space-y-2">
                    {pieData.map((s, index) => (
                      <div
                        key={s.name}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          />
                          <div>
                            <p className="font-medium text-sm">{s.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatNumber(s.value)} м³
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${s.percent}%`,
                                backgroundColor: COLORS[index % COLORS.length],
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 min-w-[50px] text-right">
                            {s.percent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Рейтинг */}
          {activeTab === "ranking" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    🏆 Рейтинг станций
                  </h3>
                  <div className="space-y-3">
                    {topStations.map((s, index) => (
                      <div
                        key={s.stationId}
                        className={`flex items-center gap-4 p-4 rounded-xl border ${
                          index === 0
                            ? "bg-gradient-to-r from-amber-50 to-amber-100/50 border-amber-200"
                            : index === 1
                            ? "bg-gradient-to-r from-gray-50 to-gray-100/50 border-gray-200"
                            : index === 2
                            ? "bg-gradient-to-r from-orange-50 to-orange-100/50 border-orange-200"
                            : "bg-white border-gray-100 hover:shadow-md"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                            index === 0
                              ? "bg-amber-500 text-white"
                              : index === 1
                              ? "bg-gray-400 text-white"
                              : index === 2
                              ? "bg-orange-500 text-white"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-800">
                              {s.displayName || s.landmark || s.name}
                            </p>
                            {getStatusIcon(s.status)}
                          </div>
                          <p className="text-sm text-gray-500">{s.fullName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-600">
                            {formatNumber(s.totalGas)} м³
                          </p>
                          <p className="text-xs text-gray-500">
                            {s.count} мес. • {s.recentGrowth > 0 ? "+" : ""}
                            {s.recentGrowth.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    📊 Статусы станций
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🌟</span>
                          <div>
                            <p className="font-semibold text-emerald-800">
                              Лидеры
                            </p>
                            <p className="text-sm text-emerald-600">
                              {
                                stationStats.filter(
                                  (s) => s.status === "leader"
                                ).length
                              }{" "}
                              станций
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📊</span>
                          <div>
                            <p className="font-semibold text-blue-800">
                              Стабильные
                            </p>
                            <p className="text-sm text-blue-600">
                              {
                                stationStats.filter(
                                  (s) => s.status === "stable"
                                ).length
                              }{" "}
                              станций
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">⚠️</span>
                          <div>
                            <p className="font-semibold text-amber-800">
                              Проблемные
                            </p>
                            <p className="text-sm text-amber-600">
                              {
                                stationStats.filter(
                                  (s) => s.status === "problem"
                                ).length
                              }{" "}
                              станций
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🚨</span>
                          <div>
                            <p className="font-semibold text-red-800">
                              Критические
                            </p>
                            <p className="text-sm text-red-600">
                              {
                                stationStats.filter(
                                  (s) => s.status === "critical"
                                ).length
                              }{" "}
                              станций
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Детальный анализ:
                      </p>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {stationStats.map((s) => (
                          <div
                            key={s.stationId}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                          >
                            <div className="flex items-center gap-2">
                              {getStatusIcon(s.status)}
                              <span className="text-sm font-medium">
                                {s.displayName || s.landmark || s.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span
                                className={`text-sm ${
                                  s.recentGrowth > 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {s.recentGrowth > 0 ? "+" : ""}
                                {s.recentGrowth.toFixed(1)}%
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatNumber(s.totalGas)} м³
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  s.status === "leader"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : s.status === "stable"
                                    ? "bg-blue-100 text-blue-700"
                                    : s.status === "problem"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {s.status === "leader"
                                  ? "Лидер"
                                  : s.status === "stable"
                                  ? "Стабильный"
                                  : s.status === "problem"
                                  ? "Проблемный"
                                  : "Критический"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Динамика */}
          {activeTab === "dynamics" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Динамика продаж
                </h3>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient
                          id="gradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#8b5cf6"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#8b5cf6"
                            stopOpacity={0.1}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="period" stroke="#888" fontSize={12} />
                      <YAxis
                        stroke="#888"
                        fontSize={12}
                        tickFormatter={(v) => formatNumber(v)}
                      />
                      <Tooltip
                        formatter={(value) => formatNumber(value) + " м³"}
                        contentStyle={{
                          backgroundColor: "white",
                          borderRadius: "12px",
                          border: "1px solid #e5e7eb",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="totalGas"
                        name="Объем газа (м³)"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        fill="url(#gradient)"
                        dot={{ fill: "#8b5cf6", r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Динамика станций за последние 3 месяца
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Станция
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Всего (м³)
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Средний (м³)
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Динамика
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Стабильность
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Статус
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stationStats.map((s) => (
                        <tr
                          key={s.stationId}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium">
                            {s.displayName || s.landmark || s.name}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {formatNumber(s.totalGas)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {formatNumber(s.avgMonthly)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`font-medium ${
                                s.recentGrowth >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {s.recentGrowth > 0 ? "+" : ""}
                              {s.recentGrowth.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 bg-gray-200 rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full"
                                  style={{
                                    width: `${Math.min(s.stability, 100)}%`,
                                    backgroundColor:
                                      s.stability > 70
                                        ? "#10b981"
                                        : s.stability > 40
                                        ? "#f59e0b"
                                        : "#ef4444",
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">
                                {s.stability.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {getStatusIcon(s.status)}
                              <span
                                className={`text-xs font-medium ${
                                  s.status === "leader"
                                    ? "text-emerald-700"
                                    : s.status === "stable"
                                    ? "text-blue-700"
                                    : s.status === "problem"
                                    ? "text-amber-700"
                                    : "text-red-700"
                                }`}
                              >
                                {s.status === "leader"
                                  ? "Лидер"
                                  : s.status === "stable"
                                  ? "Стабильный"
                                  : s.status === "problem"
                                  ? "Проблемный"
                                  : "Критический"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* Сравнение с прошлым месяцем */}
          {activeTab === "comparison" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {comparisonPeriod && selectedPeriod !== "all" ? (
                <>
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-sm text-gray-500">
                            Текущий период
                          </p>
                          <p className="text-xl font-bold text-blue-600">
                            {selectedPeriod}
                          </p>
                        </div>
                        <ArrowLeftRight className="w-6 h-6 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">
                            Период сравнения
                          </p>
                          <p className="text-xl font-bold text-purple-600">
                            {comparisonPeriod}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-lg shadow-sm">
                        <div>
                          <p className="text-sm text-gray-500">Изменение</p>
                          <p
                            className={`text-xl font-bold ${
                              comparisonResult.reduce(
                                (sum, item) => sum + item.diff,
                                0
                              ) >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {comparisonResult.reduce(
                              (sum, item) => sum + item.diff,
                              0
                            ) >= 0
                              ? "+"
                              : ""}
                            {formatNumber(
                              comparisonResult.reduce(
                                (sum, item) => sum + item.diff,
                                0
                              )
                            )}{" "}
                            м³
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Сравнение объемов по станциям
                    </h3>
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparisonChartData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f0f0f0"
                          />
                          <XAxis
                            dataKey="name"
                            fontSize={10}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis tickFormatter={(v) => formatNumber(v)} />
                          <Tooltip
                            formatter={(value) => formatNumber(value) + " м³"}
                            contentStyle={{
                              backgroundColor: "white",
                              borderRadius: "12px",
                              border: "1px solid #e5e7eb",
                            }}
                          />
                          <Legend />
                          <Bar
                            dataKey="Текущий"
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="Прошлый"
                            fill="#8b5cf6"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Детальное сравнение по станциям
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Станция
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              {selectedPeriod}
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              {comparisonPeriod}
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              Изменение
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              %
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                              Статус
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {comparisonResult.map((item) => (
                            <tr
                              key={item.stationId}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-4 py-3 font-medium">
                                {item.name}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                {item.hasCurrent
                                  ? formatNumber(item.currentGas)
                                  : "-"}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                {item.hasPrev
                                  ? formatNumber(item.prevGas)
                                  : "-"}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                <span
                                  className={
                                    item.diff >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }
                                >
                                  {item.diff >= 0 ? "+" : ""}
                                  {formatNumber(item.diff)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span
                                  className={`px-3 py-1 rounded-full text-sm font-medium ${getComparisonStatusColor(
                                    item.percentChange
                                  )}`}
                                >
                                  {item.percentChange > 0 ? "+" : ""}
                                  {item.percentChange.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {item.status === "up" && (
                                  <span className="inline-flex items-center gap-1 text-emerald-600">
                                    <TrendingUp className="w-4 h-4" /> Рост
                                  </span>
                                )}
                                {item.status === "down" && (
                                  <span className="inline-flex items-center gap-1 text-red-600">
                                    <TrendingDown className="w-4 h-4" /> Падение
                                  </span>
                                )}
                                {item.status === "same" && (
                                  <span className="inline-flex items-center gap-1 text-gray-500">
                                    <Minus className="w-4 h-4" /> Без изменений
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <p className="text-sm text-gray-600">Станции с ростом</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {
                          comparisonResult.filter(
                            (item) => item.percentChange > 0
                          ).length
                        }
                      </p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-sm text-gray-600">
                        Станции с падением
                      </p>
                      <p className="text-2xl font-bold text-red-600">
                        {
                          comparisonResult.filter(
                            (item) => item.percentChange < 0
                          ).length
                        }
                      </p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <p className="text-sm text-gray-600">Без изменений</p>
                      <p className="text-2xl font-bold text-gray-600">
                        {
                          comparisonResult.filter(
                            (item) => item.percentChange === 0
                          ).length
                        }
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <ArrowLeftRight className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">
                    Выберите период для сравнения
                  </h3>
                  <p className="text-gray-400">
                    Выберите период в фильтрах выше, и автоматически будет
                    выбран предыдущий месяц для сравнения
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default GasAnalytics;
