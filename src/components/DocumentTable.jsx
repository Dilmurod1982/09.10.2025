import React, { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../lib/zustand";
import { getStatusColor, getStatusText } from "../utils/dateUtils";
import * as XLSX from "xlsx"; // <== обязательно установить: npm install xlsx

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
  if (typeof d === "object" && d !== null && typeof d.toDate === "function") {
    return d.toDate();
  }
  const parsed = new Date(d);
  if (!isNaN(parsed)) return parsed;
  return null;
};

const daysUntil = (expiryDate) => {
  const expiry = parseDate(expiryDate);
  if (!expiry) return Infinity;
  const now = new Date();
  return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
};

const DocumentTable = ({ docType, docTypeData, refreshTrigger = 0 }) => {
  const { documents, refreshDocuments } = useAppStore();

  const [latestOnly, setLatestOnly] = useState("all");
  const [selectedStation, setSelectedStation] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (refreshDocuments) {
      refreshDocuments();
    }
  }, [refreshTrigger, refreshDocuments]);

  const stations = useMemo(() => {
    const map = {};
    documents.forEach((d) => {
      if (d.docType !== docType) return;
      const id = d.stationId || d.station_id || "";
      const name = d.stationName || d.station_name || d.station || "";
      if (!id && !name) return;
      map[id || name] = name || id;
    });
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [documents, docType]);

  const docsOfType = useMemo(
    () => documents.filter((d) => d.docType === docType),
    [documents, docType]
  );

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
      const currentBest = perStation[sid];
      const currExpiry = parseDate(safeGetExpiryDate(d));
      if (!currentBest) {
        perStation[sid] = d;
      } else {
        const bestExpiry = parseDate(safeGetExpiryDate(currentBest));
        if (!bestExpiry && currExpiry) perStation[sid] = d;
        else if (currExpiry && bestExpiry && currExpiry > bestExpiry)
          perStation[sid] = d;
      }
    });
    return Object.values(perStation);
  }, [docsOfType, latestOnly]);

  const filtered = useMemo(() => {
    let list =
      latestOnly === "latest" ? lastPerStation || [] : docsOfType.slice();

    if (selectedStation !== "all") {
      list = list.filter((d) => {
        const sid =
          d.stationId ||
          d.station_id ||
          d.stationName ||
          d.station_name ||
          d.station ||
          "";
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

    list.sort((a, b) => {
      const ea = parseDate(safeGetExpiryDate(a));
      const eb = parseDate(safeGetExpiryDate(b));
      if (ea && eb) {
        if (ea < eb) return -1;
        if (ea > eb) return 1;
      } else if (ea && !eb) return -1;
      else if (!ea && eb) return 1;
      const ca = parseDate(
        a.createdAt || a.created_at || a.createdDate || safeGetIssueDate(a)
      );
      const cb = parseDate(
        b.createdAt || b.created_at || b.createdDate || safeGetIssueDate(b)
      );
      if (ca && cb) return cb - ca;
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

  // === 📤 Экспорт в Excel ===

  const exportToExcel = () => {
    try {
      const data = filtered.map((doc, idx) => ({
        "№": idx + 1,
        "Номер документа": safeGetNumber(doc) || "—",
        "Дата принятия": safeGetIssueDate(doc) || "—",
        "Дата окончания": safeGetExpiryDate(doc) || "—",
        Станция: doc.stationName || doc.station_name || "—",
        Статус: getStatusText(safeGetExpiryDate(doc)) || "—",
      }));

      if (data.length === 0) {
        alert("Нет данных для экспорта.");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Документы");

      XLSX.writeFile(workbook, `Документы_${docType}.xlsx`);
    } catch (error) {
      console.error("Ошибка при экспорте:", error);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      {/* Верхняя панель фильтров */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm">Показывать:</label>
            <select
              value={latestOnly}
              onChange={(e) => setLatestOnly(e.target.value)}
              className="border rounded px-2 py-1 text-sm">
              <option value="all">Все документы</option>
              <option value="latest">Только последние</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm">Станция:</label>
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="border rounded px-2 py-1 text-sm">
              <option value="all">Все станции</option>
              {stations.map((s) => (
                <option key={s.id || s.name} value={s.id || s.name}>
                  {s.name || s.id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm">Срок:</label>
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
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="p-2 border text-left">#</th>
              <th className="p-2 border text-left">Номер документа</th>
              <th className="p-2 border text-left">Дата принятия</th>
              <th className="p-2 border text-left">Дата окончания</th>
              <th className="p-2 border text-left">Станция</th>
              <th className="p-2 border text-left">Файл</th>
              <th className="p-2 border text-left">Статус</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  Документы отсутствуют
                </td>
              </tr>
            ) : (
              filtered.map((doc, idx) => {
                const number = safeGetNumber(doc);
                const issueDate = safeGetIssueDate(doc);
                const expiryDate = safeGetExpiryDate(doc);
                const fileUrl = safeGetFileUrl(doc);
                const fileName =
                  safeGetFileName(doc) ||
                  (fileUrl ? fileUrl.split("/").pop() : "");
                const stationName =
                  doc.stationName || doc.station_name || doc.station || "";

                const statusText = getStatusText(expiryDate);
                const statusColor = getStatusColor(expiryDate);

                return (
                  <tr
                    key={doc.id || `${docType}-${idx}`}
                    className="hover:bg-gray-50">
                    <td className="p-2 border w-10">{idx + 1}</td>
                    <td className="p-2 border">{number || "—"}</td>
                    <td className="p-2 border">{issueDate || "—"}</td>
                    <td className="p-2 border">{expiryDate || "—"}</td>
                    <td className="p-2 border">{stationName || "—"}</td>
                    <td className="p-2 border">
                      {fileUrl ? (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 hover:underline"
                          title={fileName}>
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 2v10l3-3 3 3V2z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 13h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8z"
                            />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-2 border text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold text-black shadow-sm ${
                          statusColor || "bg-black-400"
                        }`}
                        style={{ opacity: 1, filter: "none" }} // 💡 убирает "туманность"
                      >
                        {statusText}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DocumentTable;
