import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getStatusColor } from "../utils/dateUtils";

const StationDocs = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [docs, setDocs] = useState([]);
  const [filteredDocs, setFilteredDocs] = useState([]);
  const [stationName, setStationName] = useState("");
  const [typesMap, setTypesMap] = useState({});
  const [loading, setLoading] = useState(true);

  const [showLatestOnly, setShowLatestOnly] = useState(false);
  const [selectedType, setSelectedType] = useState("Все");
  const [expiryFilter, setExpiryFilter] = useState("Все");

  useEffect(() => {
    fetchDocs();
  }, [id]);

  useEffect(() => {
    applyFilters();
  }, [docs, showLatestOnly, selectedType, expiryFilter]);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const typeSnap = await getDocs(collection(db, "document_types"));
      const types = {};
      typeSnap.forEach((doc) => {
        const data = doc.data();
        types[data.id] = data.name;
      });
      setTypesMap(types);

      const stationSnap = await getDocs(
        query(collection(db, "stations"), where("__name__", "==", id))
      );
      if (!stationSnap.empty) setStationName(stationSnap.docs[0].data().name);

      const docsSnap = await getDocs(
        query(collection(db, "documents"), where("stationId", "==", id))
      );

      const docsData = docsSnap.docs.map((doc, index) => {
        const data = doc.data();
        const expiry = new Date(data.expiryDate);
        const issue = new Date(data.issueDate);
        const now = new Date();
        const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

        return {
          id: doc.id,
          index: index + 1,
          typeId: data.docType,
          name: types[data.docType] || data.docType,
          issueDate: issue.toLocaleDateString(),
          expiryDate: expiry.toLocaleDateString(),
          expiryRaw: expiry,
          diffDays,
          daysLeft:
            diffDays < 0
              ? `Просрочено на ${Math.abs(diffDays)} дн.`
              : `Осталось ${diffDays} дн.`,
          color: getStatusColor(expiry),
          fileUrl: data.fileUrl || null,
        };
      });

      setDocs(docsData);
    } catch (err) {
      console.error("Ошибка загрузки документов:", err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...docs];
    if (selectedType !== "Все") {
      filtered = filtered.filter((d) => d.name === selectedType);
    }

    if (expiryFilter !== "Все") {
      filtered = filtered.filter((d) => {
        const days = d.diffDays;
        if (expiryFilter === "30 дней") return days <= 30 && days > 15;
        if (expiryFilter === "15 дней") return days <= 15 && days > 5;
        if (expiryFilter === "5 дней") return days <= 5 && days >= 0;
        if (expiryFilter === "Просрочено") return days < 0;
        return true;
      });
    }

    if (showLatestOnly) {
      const latestDocs = {};
      filtered.forEach((d) => {
        if (!latestDocs[d.name] || d.expiryRaw > latestDocs[d.name].expiryRaw) {
          latestDocs[d.name] = d;
        }
      });
      filtered = Object.values(latestDocs);
    }

    setFilteredDocs(filtered);
  };

  const exportToExcel = () => {
    const dataForExcel = filteredDocs.map((d) => ({
      "№": d.index,
      "Название документа": d.name,
      "Дата выдачи": d.issueDate,
      "Дата окончания": d.expiryDate,
      Статус: d.daysLeft,
      "Ссылка на файл": d.fileUrl || "—",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    worksheet["!cols"] = Object.keys(dataForExcel[0]).map((key) => ({
      wch: Math.max(key.length + 2, 20),
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Документы");
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    saveAs(
      new Blob([excelBuffer], { type: "application/octet-stream" }),
      `${stationName || "Станция"}_Документы.xlsx`
    );
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="h-20 w-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-10 px-6">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        {/* Заголовок */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-800">
            Документы станции: {stationName}
          </h1>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Экспорт в Excel
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500">
              Назад
            </button>
          </div>
        </div>

        {/* Фильтры */}
        <div className="flex flex-wrap gap-4 mb-6">
          <select
            value={showLatestOnly ? "latest" : "all"}
            onChange={(e) => setShowLatestOnly(e.target.value === "latest")}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700">
            <option value="latest">Только последние документы</option>
            <option value="all">Все документы</option>
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700">
            <option value="Все">Все типы документов</option>
            {Object.values(typesMap).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={expiryFilter}
            onChange={(e) => setExpiryFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700">
            <option value="Все">Все по сроку</option>
            <option value="30 дней">До 30 дней</option>
            <option value="15 дней">До 15 дней</option>
            <option value="5 дней">До 5 дней</option>
            <option value="Просрочено">Просрочено</option>
          </select>
        </div>

        {/* Таблица */}
        <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2 text-left">Название документа</th>
              <th className="px-3 py-2">Дата выдачи</th>
              <th className="px-3 py-2">Дата окончания</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2">Файл</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.map((d, i) => (
              <tr
                key={d.id}
                className={`${d.color} text-center border-b hover:bg-gray-100`}>
                <td className="py-2">{i + 1}</td>
                <td className="text-left px-3">{d.name}</td>
                <td>{d.issueDate}</td>
                <td>{d.expiryDate}</td>
                <td>{d.daysLeft}</td>
                <td>
                  {d.fileUrl ? (
                    <a
                      href={d.fileUrl}
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
            ))}
          </tbody>
        </table>

        {filteredDocs.length === 0 && (
          <p className="text-center text-gray-500 mt-6">
            Документы не найдены.
          </p>
        )}

        {/* 🟩 Легенда цветов */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-3 text-gray-700">Легенда:</h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-red-200 border rounded"></div>
              <span>Просрочено</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-yellow-200 border rounded"></div>
              <span>Осталось ≤ 5 дней</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-orange-200 border rounded"></div>
              <span>Осталось ≤ 15 дней</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-200 border rounded"></div>
              <span>Осталось ≤ 30 дней</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-white border rounded"></div>
              <span>Более 30 дней</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StationDocs;
