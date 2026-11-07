import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAppStore } from "../lib/zustand";
import { db } from "../firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const getQuarterFromDate = (dateString) => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  if (month >= 1 && month <= 3) return "I";
  if (month >= 4 && month <= 6) return "II";
  if (month >= 7 && month <= 9) return "III";
  return "IV";
};

const getFirstDayOfMonth = (dateStr) => {
  if (!dateStr) return "";
  const [year, month] = dateStr.split("-");
  return `${year}-${month}-01`;
};

const ElectricAnalytics = () => {
  const userData = useAppStore((state) => state.userData);
  const managedStations = userData?.stations || [];

  const [meters, setMeters] = useState([]);
  const [allReadings, setAllReadings] = useState([]);
  const [gasReports, setGasReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState(null);

  // Тип периода
  const [periodType, setPeriodType] = useState("custom");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedMeterId, setSelectedMeterId] = useState("all");

  const initializedFromLastReading = useRef(false);

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const managedUids = managedStations
          .map((s) => {
            if (typeof s === "object" && s !== null) {
              return String(s.id ?? s.uid ?? s.stationId ?? "");
            }
            return String(s);
          })
          .filter(Boolean);

        if (managedUids.length === 0) {
          setDebugInfo({ message: "Нет привязанных станций" });
          setLoading(false);
          return;
        }

        const mainSnap = await getDoc(doc(db, "gasSettlements", "main"));
        const allStations = mainSnap.exists()
          ? mainSnap.data()?.mainData || []
          : [];

        const resolvedStationIds = [];
        for (const station of allStations) {
          const candidates = [
            String(station.id ?? ""),
            String(station.uid ?? ""),
            String(station.stationId ?? ""),
            String(station.firestoreId ?? ""),
            String(station.docId ?? ""),
          ];
          if (managedUids.some((uid) => candidates.includes(uid))) {
            resolvedStationIds.push(String(station.id));
          }
        }

        if (resolvedStationIds.length === 0) {
          for (const uid of managedUids) {
            try {
              const stationDoc = await getDoc(doc(db, "stations", uid));
              if (stationDoc.exists()) {
                const data = stationDoc.data();
                const stationId = String(data.gasStationId ?? data.id ?? uid);
                resolvedStationIds.push(stationId);
              }
            } catch (e) {
              /* пропускаем */
            }
          }
        }

        const allPossibleStationIds = [
          ...resolvedStationIds,
          ...managedUids,
        ].map(String);

        // Счётчики
        const metersList = [];
        const chunks = [];
        for (let i = 0; i < resolvedStationIds.length; i += 10) {
          chunks.push(resolvedStationIds.slice(i, i + 10));
        }
        for (const chunk of chunks) {
          const metersQ = query(
            collection(db, "electricMeters"),
            where("stationId", "in", chunk)
          );
          const metersSnap = await getDocs(metersQ);
          metersSnap.forEach((d) => {
            metersList.push({ id: d.id, ...d.data() });
          });
        }
        setMeters(metersList);

        // Показания
        const allReadingsList = [];
        if (metersList.length > 0) {
          const meterIds = metersList.map((m) => m.id);
          const meterChunks = [];
          for (let i = 0; i < meterIds.length; i += 10) {
            meterChunks.push(meterIds.slice(i, i + 10));
          }
          for (const chunk of meterChunks) {
            const rq = query(
              collection(db, "electricReadings"),
              where("meterId", "in", chunk)
            );
            const rs = await getDocs(rq);
            rs.forEach((d) => {
              allReadingsList.push({ id: d.id, ...d.data() });
            });
          }
        }
        setAllReadings(allReadingsList);

        // Газовые отчёты
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        let currentQuarter;
        if (currentMonth >= 1 && currentMonth <= 3) currentQuarter = "I";
        else if (currentMonth >= 4 && currentMonth <= 6) currentQuarter = "II";
        else if (currentMonth >= 7 && currentMonth <= 9) currentQuarter = "III";
        else currentQuarter = "IV";

        const collectionsToSearch = [];
        for (let i = 0; i < 8; i++) {
          let quarter = currentQuarter;
          let year = currentYear;
          for (let j = 0; j < i; j++) {
            if (quarter === "I") {
              quarter = "IV";
              year--;
            } else if (quarter === "II") {
              quarter = "I";
            } else if (quarter === "III") {
              quarter = "II";
            } else {
              quarter = "III";
            }
          }
          const collectionName = `unifiedDailyReports_${quarter}_${year}`;
          if (!collectionsToSearch.includes(collectionName)) {
            collectionsToSearch.push(collectionName);
          }
        }

        const gasReportsList = [];
        for (const collectionName of collectionsToSearch) {
          try {
            const collectionRef = collection(db, collectionName);
            const snapshot = await getDocs(collectionRef);
            snapshot.docs.forEach((d) => {
              const data = d.data();
              const reportStationId = String(data.stationId ?? "");
              if (allPossibleStationIds.includes(reportStationId)) {
                gasReportsList.push({
                  id: d.id,
                  collectionName,
                  ...data,
                });
              }
            });
          } catch (error) {
            if (
              error.code !== "not-found" &&
              error.code !== "failed-precondition"
            ) {
              console.warn(`Ошибка в ${collectionName}:`, error.message);
            }
          }
        }

        setGasReports(gasReportsList);

        // Инициализация фильтров по последнему показанию
        if (allReadingsList.length > 0 && !initializedFromLastReading.current) {
          const sortedReadings = [...allReadingsList].sort((a, b) => {
            const da = a.readingDate || "";
            const db_ = b.readingDate || "";
            return db_.localeCompare(da);
          });

          const lastReadingDate = sortedReadings[0]?.readingDate;

          if (lastReadingDate) {
            setPeriodType("custom");
            setDateFrom(getFirstDayOfMonth(lastReadingDate));
            setDateTo(lastReadingDate);
            initializedFromLastReading.current = true;
          }
        }

        setDebugInfo({
          managedUids,
          resolvedStationIds,
          metersCount: metersList.length,
          readingsCount: allReadingsList.length,
          gasReportsCount: gasReportsList.length,
        });
      } catch (err) {
        console.error("Ошибка загрузки:", err);
        setDebugInfo({ error: err.message });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [managedStations]);

  // Границы периода
  const { startDate, endDate, periodLabel, isSingleDay } = useMemo(() => {
    if (periodType === "daily") {
      const d = new Date(selectedDate);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      return {
        startDate: selectedDate,
        endDate: next.toISOString().split("T")[0],
        periodLabel: `Кунлик (${new Date(selectedDate).toLocaleDateString(
          "ru-RU"
        )})`,
        isSingleDay: true,
      };
    }
    if (periodType === "monthly") {
      const start = new Date(selectedYear, selectedMonth - 1, 1);
      const end = new Date(selectedYear, selectedMonth, 1);
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
        periodLabel: `Ойлик (${
          MONTH_NAMES[selectedMonth - 1]
        } ${selectedYear})`,
        isSingleDay: false,
      };
    }
    return {
      startDate: dateFrom,
      endDate: dateTo,
      periodLabel: `Ихтиёрий (${dateFrom || "—"} — ${dateTo || "—"})`,
      isSingleDay: false,
    };
  }, [periodType, selectedDate, selectedYear, selectedMonth, dateFrom, dateTo]);

  // Автопилот за период
  const totalAutopilotReading = useMemo(() => {
    if (!startDate || !endDate) return 0;

    const reportsInPeriod = gasReports.filter((r) =>
      isSingleDay
        ? r.reportDate === selectedDate
        : r.reportDate >= startDate && r.reportDate <= endDate
    );

    return reportsInPeriod.reduce(
      (sum, r) => sum + (Number(r.generalData?.autopilotReading) || 0),
      0
    );
  }, [gasReports, startDate, endDate, selectedDate, isSingleDay]);

  // Расчёт показаний
  const analysisData = useMemo(() => {
    if (!startDate || !endDate) return [];

    const filteredMeters =
      selectedMeterId === "all"
        ? meters
        : meters.filter((m) => m.id === selectedMeterId);

    return filteredMeters.map((meter) => {
      const meterReadings = allReadings
        .filter((r) => r.meterId === meter.id)
        .sort((a, b) => a.readingDate.localeCompare(b.readingDate));

      const startReading = [...meterReadings]
        .reverse()
        .find((r) => r.readingDate <= startDate);

      let endReading = meterReadings.find((r) => r.readingDate >= endDate);
      if (!endReading && startReading) {
        const afterStart = meterReadings.find(
          (r) => r.readingDate > startReading.readingDate
        );
        if (afterStart) endReading = afterStart;
      }

      const coefficient = Number(meter.coefficient) || 0;

      // Актив
      const activeDiff =
        startReading && endReading
          ? Math.max(0, endReading.activeEnergy - startReading.activeEnergy)
          : 0;
      const activeResult = activeDiff * coefficient;

      // Реактив
      const reactiveDiff =
        startReading && endReading
          ? Math.max(
              0,
              (endReading.reactiveEnergy || 0) -
                (startReading.reactiveEnergy || 0)
            )
          : 0;
      const reactiveResult = reactiveDiff * coefficient;

      // ЭКО
      const ecoDiff =
        startReading && endReading
          ? Math.max(0, (endReading.eco || 0) - (startReading.eco || 0))
          : 0;
      const ecoResult = ecoDiff * coefficient;

      const activePerAutopilot =
        totalAutopilotReading > 0 && activeResult > 0
          ? activeResult / totalAutopilotReading
          : 0;

      return {
        meter,
        startReading,
        endReading,
        activeDiff,
        activeResult,
        reactiveDiff,
        reactiveResult,
        ecoDiff,
        ecoResult,
        activePerAutopilot,
      };
    });
  }, [
    meters,
    allReadings,
    startDate,
    endDate,
    selectedMeterId,
    totalAutopilotReading,
  ]);

  const totals = useMemo(() => {
    return analysisData.reduce(
      (acc, row) => ({
        active: acc.active + row.activeResult,
        reactive: acc.reactive + row.reactiveResult,
        eco: acc.eco + row.ecoResult,
        activePerAutopilot: acc.activePerAutopilot + row.activePerAutopilot,
      }),
      { active: 0, reactive: 0, eco: 0, activePerAutopilot: 0 }
    );
  }, [analysisData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">
          📊 Электр кўрсаткичлари тахлили
        </h1>
        <p className="text-sm sm:text-base text-gray-500 mt-1">
          Давр бўйича сарфланган электр энергияси
        </p>
      </div>
      {/* Диагностика
      {debugInfo && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
          <details>
            <summary className="cursor-pointer font-medium">
              🔍 Диагностика
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        </div>
      )} */}
      {/* Фильтры */}
      <div className="bg-white rounded-2xl shadow-md p-3 sm:p-6 mb-4 sm:mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Ҳисобот даври
            </label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="daily">Кунлик</option>
              <option value="monthly">Ойлик</option>
              <option value="custom">Ихтиёрий</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Ҳисоблагич
            </label>
            <select
              value={selectedMeterId}
              onChange={(e) => setSelectedMeterId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">Барча ҳисоблагичлар</option>
              {meters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {periodType === "daily" && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Сана
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          )}

          {periodType === "monthly" && (
            <>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Йил
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {[2023, 2024, 2025, 2026].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Ой
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i + 1} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {periodType === "custom" && (
            <>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  ...дан
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  ...гача
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-3 text-xs sm:text-sm text-gray-600">
          <strong>Давр:</strong> {periodLabel}
        </div>
      </div>
      {/* Итоги */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-2xl shadow-md p-3 sm:p-5 border-l-4 border-blue-500">
          <p className="text-[10px] sm:text-xs text-gray-500">Актив (жами)</p>
          <p className="text-base sm:text-xl font-bold text-blue-600 font-mono">
            {totals.active.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-md p-3 sm:p-5 border-l-4 border-orange-500">
          <p className="text-[10px] sm:text-xs text-gray-500">Реактив (жами)</p>
          <p className="text-base sm:text-xl font-bold text-orange-600 font-mono">
            {totals.reactive.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-md p-3 sm:p-5 border-l-4 border-green-500">
          <p className="text-[10px] sm:text-xs text-gray-500">ЭКО (жами)</p>
          <p className="text-base sm:text-xl font-bold text-green-600 font-mono">
            {totals.eco.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-md p-3 sm:p-5 border-l-4 border-purple-500">
          <p className="text-[10px] sm:text-xs text-gray-500">Автопилот</p>
          <p className="text-base sm:text-xl font-bold text-purple-600 font-mono">
            {totalAutopilotReading.toLocaleString("ru-RU", {
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-[10px] text-gray-400">м³</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md p-3 sm:p-5 border-l-4 border-indigo-500 col-span-2 lg:col-span-1">
          <p className="text-[10px] sm:text-xs text-gray-500">
            Актив / Автопилот
          </p>
          <p className="text-base sm:text-xl font-bold text-indigo-600 font-mono">
            {totals.activePerAutopilot.toFixed(4)}
          </p>
        </div>
      </div>
      {/* 📱 Мобильная версия — карточки */}
      <div className="sm:hidden space-y-3">
        {analysisData.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-6 text-center text-gray-500 text-sm">
            Маълумотлар топилмади
          </div>
        ) : (
          analysisData.map((row) => (
            <div
              key={row.meter.id}
              className="bg-white rounded-2xl shadow-md p-4 border border-gray-100"
            >
              <div className="flex justify-between items-start gap-2 mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-800 text-sm truncate">
                    {row.meter.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Коэф: {Number(row.meter.coefficient || 0).toFixed(5)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-gray-500">Актив / Автопилот</div>
                  <div className="font-mono font-bold text-indigo-600 text-sm">
                    {row.activePerAutopilot > 0
                      ? row.activePerAutopilot.toFixed(4)
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 p-2 rounded-lg">
                  <div className="text-gray-500 mb-0.5">Актив (нач.)</div>
                  <div className="font-mono text-gray-800">
                    {row.startReading
                      ? row.startReading.activeEnergy.toFixed(2)
                      : "—"}
                  </div>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg">
                  <div className="text-gray-500 mb-0.5">Актив (кон.)</div>
                  <div className="font-mono text-gray-800">
                    {row.endReading
                      ? row.endReading.activeEnergy.toFixed(2)
                      : "—"}
                  </div>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg">
                  <div className="text-gray-500 mb-0.5">Актив (разница)</div>
                  <div className="font-mono text-gray-800">
                    {row.activeDiff.toFixed(2)}
                  </div>
                </div>
                <div className="bg-blue-50 p-2 rounded-lg">
                  <div className="text-blue-600 mb-0.5">Актив (× коэф.)</div>
                  <div className="font-mono font-bold text-blue-700">
                    {row.activeResult.toFixed(2)}
                  </div>
                </div>
                <div className="bg-orange-50 p-2 rounded-lg">
                  <div className="text-orange-600 mb-0.5">
                    Реактив (× коэф.)
                  </div>
                  <div className="font-mono font-bold text-orange-700">
                    {row.reactiveResult !== undefined
                      ? row.reactiveResult.toFixed(2)
                      : "—"}
                  </div>
                </div>
                <div className="bg-green-50 p-2 rounded-lg">
                  <div className="text-green-600 mb-0.5">ЭКО (× коэф.)</div>
                  <div className="font-mono font-bold text-green-700">
                    {row.ecoResult !== undefined
                      ? row.ecoResult.toFixed(2)
                      : "—"}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {/* 💻 Планшет/десктоп — таблица */}
      <div className="hidden sm:block bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Ҳисоблагич</th>
                <th className="p-3 text-right">Коэф.</th>
                <th className="p-3 text-right">Актив (нач.)</th>
                <th className="p-3 text-right">Актив (кон.)</th>
                <th className="p-3 text-right">Актив (разница)</th>
                <th className="p-3 text-right">Актив (× коэф.)</th>
                <th className="p-3 text-right text-indigo-700">
                  Актив / Автопилот
                </th>
                <th className="p-3 text-right text-orange-700">
                  Реактив (× коэф.)
                </th>
                <th className="p-3 text-right text-green-700">ЭКО (× коэф.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analysisData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500">
                    Маълумотлар топилмади
                  </td>
                </tr>
              ) : (
                analysisData.map((row) => (
                  <tr key={row.meter.id} className="hover:bg-blue-50">
                    <td className="p-3 font-medium">{row.meter.name}</td>
                    <td className="p-3 text-right font-mono">
                      {Number(row.meter.coefficient || 0).toFixed(5)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {row.startReading
                        ? row.startReading.activeEnergy.toFixed(2)
                        : "—"}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {row.endReading
                        ? row.endReading.activeEnergy.toFixed(2)
                        : "—"}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {row.activeDiff.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono text-blue-600 font-semibold">
                      {row.activeResult.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono text-indigo-600 font-semibold">
                      {row.activePerAutopilot > 0
                        ? row.activePerAutopilot.toFixed(4)
                        : "—"}
                    </td>
                    <td className="p-3 text-right font-mono text-orange-600 font-semibold">
                      {row.reactiveResult !== undefined
                        ? row.reactiveResult.toFixed(2)
                        : "—"}
                    </td>
                    <td className="p-3 text-right font-mono text-green-600 font-semibold">
                      {row.ecoResult !== undefined
                        ? row.ecoResult.toFixed(2)
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {analysisData.length > 0 && (
              <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
                <tr>
                  <td colSpan={5} className="p-3 font-bold text-indigo-900">
                    ЖАМИ
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-blue-700">
                    {totals.active.toFixed(2)}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-indigo-700">
                    {totals.activePerAutopilot.toFixed(4)}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-orange-700">
                    {totals.reactive.toFixed(2)}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-green-700">
                    {totals.eco.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default ElectricAnalytics;
