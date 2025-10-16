import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";
import { getStatusColor, getStatusText } from "../utils/dateUtils";
import * as XLSX from "xlsx";

const safeGetNumber = (doc) =>
  doc.docNumber ||
  doc.doc_number ||
  doc.number ||
  doc.docNo ||
  doc.number_doc ||
  "";

const safeGetIssueDate = (doc) =>
  doc.issueDate || doc.date_of_issue || doc.startDate || doc.issued_at || "";

const safeGetExpiryDate = (doc) =>
  doc.expiryDate || doc.date_of_expiry || doc.valid_until || "";

const safeGetFileUrl = (doc) => doc.fileUrl || doc.file_url || doc.url || "";
const safeGetFileName = (doc) => doc.fileName || doc.file_name || "";

const parseDate = (d) => {
  if (!d) return null;
  if (typeof d === "object" && typeof d.toDate === "function")
    return d.toDate();
  const parsed = new Date(d);
  return isNaN(parsed) ? null : parsed;
};

const daysUntil = (expiryDate) => {
  const expiry = parseDate(expiryDate);
  if (!expiry) return Infinity;
  const now = new Date();
  return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
};

const DocumentTableInf = ({ docType, docTypeData, refreshTrigger = 0 }) => {
  const { documents, refreshDocuments } = useAppStore();
  const [stations, setStations] = useState([]);
  const [latestOnly, setLatestOnly] = useState("all");
  const [selectedStation, setSelectedStation] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [search, setSearch] = useState("");

  // 🔹 Загружаем станции из Firestore
  useEffect(() => {
    const fetchStations = async () => {
      try {
        const snap = await getDocs(collection(db, "stations"));
        const list = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setStations(list);
      } catch (err) {
        console.error("Ошибка загрузки станций:", err);
      }
    };
    fetchStations();
  }, []);

  // 🔹 Обновляем документы при добавлении
  useEffect(() => {
    if (refreshDocuments) refreshDocuments();
  }, [refreshTrigger, refreshDocuments]);

  const docsOfType = useMemo(
    () => documents.filter((d) => d.docType === docType),
    [documents, docType]
  );

  // 🔹 Последние документы по каждой станции
  const lastPerStation = useMemo(() => {
    if (latestOnly !== "latest") return null;
    const perStation = {};
    docsOfType.forEach((d) => {
      const sid =
        d.stationId ||
        d.station_id ||
        d.stationName ||
        d.station_name ||
        d.station ||
        "unknown";
      const currExpiry = parseDate(safeGetExpiryDate(d));
      const currentBest = perStation[sid];
      if (
        !currentBest ||
        (currExpiry && parseDate(safeGetExpiryDate(currentBest)) < currExpiry)
      ) {
        perStation[sid] = d;
      }
    });
    return Object.values(perStation);
  }, [docsOfType, latestOnly]);

  const filteredDocs = useMemo(() => {
    let list =
      latestOnly === "latest" ? lastPerStation || [] : docsOfType.slice();

    if (selectedStation !== "all") {
      list = list.filter((d) => {
        const sid =
          d.stationId ||
          d.station_id ||
          d.stationName ||
          d.station_name ||
          d.station;
        return sid === selectedStation;
      });
    }

    if (expiryFilter !== "all") {
      list = list.filter((d) => {
        const days = daysUntil(safeGetExpiryDate(d));
        if (expiryFilter === "expired") return days < 0;
        const n = Number(expiryFilter);
        if (isNaN(n)) return true;
        return days <= n && days >= 0;
      });
    }

    if (search.trim() !== "") {
      const q = search.trim().toLowerCase();
      list = list.filter((d) => {
        const number = (safeGetNumber(d) || "").toString().toLowerCase();
        const station = (d.stationName || d.station_name || "").toLowerCase();
        const fname = (safeGetFileName(d) || "").toLowerCase();
        return number.includes(q) || station.includes(q) || fname.includes(q);
      });
    }

    // сортировка по дате окончания
    list.sort((a, b) => {
      const ea = parseDate(safeGetExpiryDate(a));
      const eb = parseDate(safeGetExpiryDate(b));
      if (ea && eb) return ea - eb;
      if (ea && !eb) return -1;
      if (!ea && eb) return 1;
      return 0;
    });

    return list;
  }, [
    docsOfType,
    lastPerStation,
    latestOnly,
    selectedStation,
    expiryFilter,
    search,
  ]);

  // 🔹 Определяем станции, у которых НЕТ документа данного типа
  const stationsWithoutDoc = useMemo(() => {
    const docStationIds = new Set(
      docsOfType.map(
        (d) =>
          d.stationId ||
          d.station_id ||
          d.stationName ||
          d.station_name ||
          d.station
      )
    );
    return stations.filter(
      (s) => !docStationIds.has(s.id) && !docStationIds.has(s.name)
    );
  }, [stations, docsOfType]);

  // === 📤 Экспорт в Excel ===
  const exportToExcel = () => {
    const data = filteredDocs.map((doc, idx) => ({
      "№": idx + 1,
      "Номер документа": safeGetNumber(doc) || "—",
      "Дата принятия": safeGetIssueDate(doc) || "—",
      "Дата окончания": safeGetExpiryDate(doc) || "—",
      Станция: doc.stationName || doc.station_name || "—",
      Статус: getStatusText(safeGetExpiryDate(doc)) || "—",
    }));

    // Добавим станции без документа
    stationsWithoutDoc.forEach((s) => {
      data.push({
        "№": data.length + 1,
        "Номер документа": "—",
        "Дата принятия": "—",

        Станция: s.stationName || s.id,
        Статус: "Не введён",
      });
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Документы");
    XLSX.writeFile(wb, `Документы_${docType}.xlsx`);
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      {/* Панель фильтров */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">Показывать:</label>
          <select
            value={latestOnly}
            onChange={(e) => setLatestOnly(e.target.value)}
            className="border rounded px-2 py-1 text-sm">
            <option value="all">Все документы</option>
            <option value="latest">Только последние</option>
          </select>

          <label className="text-sm ml-2">Станция:</label>
          <select
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            className="border rounded px-2 py-1 text-sm">
            <option value="all">Все станции</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.stationName || s.id}
              </option>
            ))}
          </select>

          <label className="text-sm ml-2">Срок:</label>
          <select
            value={expiryFilter}
            onChange={(e) => setExpiryFilter(e.target.value)}
            className="border rounded px-2 py-1 text-sm">
            <option value="all">Все</option>
            <option value="30">Осталось 30 дней</option>
            <option value="15">Осталось 15 дней</option>
            <option value="5">Осталось 5 дней</option>
            <option value="expired">Просрочено</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="border rounded px-3 py-1 text-sm w-48"
          />
          <button
            onClick={exportToExcel}
            className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-1 rounded">
            Экспорт в Excel
          </button>
        </div>
      </div>

      {/* Таблица */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border text-left">#</th>
              <th className="p-2 border text-left">Станция</th>
              <th className="p-2 border text-left">Номер документа</th>
              <th className="p-2 border text-left">Дата принятия</th>
              <th className="p-2 border text-left">Статус</th>
              <th className="p-2 border text-left">Файл</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.map((doc, idx) => {
              const number = safeGetNumber(doc);
              const issueDate = safeGetIssueDate(doc);
              const expiryDate = safeGetExpiryDate(doc);
              const fileUrl = safeGetFileUrl(doc);
              const stationName =
                doc.stationName || doc.station_name || doc.station || "";

              const statusText = getStatusText(expiryDate);
              const statusColor = getStatusColor(expiryDate);

              return (
                <tr key={doc.id || idx} className="hover:bg-gray-50">
                  <td className="p-2 border">{idx + 1}</td>
                  <td className="p-2 border">{stationName}</td>
                  <td className="p-2 border">{number || "—"}</td>
                  <td className="p-2 border">{issueDate || "—"}</td>

                  <td className="p-2 border text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold text-black ${statusColor}`}>
                      введён
                    </span>
                  </td>
                  <td className="p-2 border text-center">
                    {fileUrl ? (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline">
                        📄
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}

            {/* 🔴 Добавляем станции без документов */}
            {stationsWithoutDoc.map((s, idx) => (
              <tr key={`missing-${s.id}`} className="bg-red-50">
                <td className="p-2 border">{filteredDocs.length + idx + 1}</td>
                <td className="p-2 border">{s.stationName || s.id}</td>
                <td className="p-2 border text-gray-400">—</td>
                <td className="p-2 border text-gray-400">—</td>

                <td className="p-2 border text-center">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-300 text-black">
                    Не введён
                  </span>
                </td>
                <td className="p-2 border text-center text-gray-400">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DocumentTableInf;
