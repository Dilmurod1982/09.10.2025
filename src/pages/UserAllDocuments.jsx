import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getStatusColor } from "../utils/dateUtils";
import { useAppStore } from "../lib/zustand";

const UserAllDocuments = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const currentUserData = useAppStore((state) => state.userData);

  const [docs, setDocs] = useState([]);
  const [filteredDocs, setFilteredDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stationsMap, setStationsMap] = useState({});
  const [typesMap, setTypesMap] = useState({});
  const [error, setError] = useState(null);

  const [showLatestOnly, setShowLatestOnly] = useState(true);
  const [selectedType, setSelectedType] = useState("Все");
  const [expiryFilter, setExpiryFilter] = useState("Все");
  const [selectedStation, setSelectedStation] = useState("Все");

  useEffect(() => {
    if (userId && currentUserData) {
      fetchAllDocuments();
    }
  }, [userId, currentUserData]);

  useEffect(() => {
    applyFilters();
  }, [docs, showLatestOnly, selectedType, expiryFilter, selectedStation]);

  const fetchAllDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      // Проверяем, что пользователь смотрит свои документы
      if (!currentUserData || currentUserData.uid !== userId) {
        setError("Рухсат етишмайди! Фақат ўз хужжатларингизни кўра оласиз.");
        setLoading(false);
        return;
      }

      // Если у пользователя нет станций
      if (!currentUserData.stations || currentUserData.stations.length === 0) {
        setDocs([]);
        setStationsMap({});
        setTypesMap({});
        setLoading(false);
        return;
      }

      // 1. Получаем типы документов
      const typeSnap = await getDocs(collection(db, "document_types"));
      const types = {};
      const validIds = [];
      const typesArray = [];

      typeSnap.forEach((doc) => {
        const data = doc.data();
        typesArray.push({
          id: data.id,
          name: data.name,
          number: data.number ?? 9999,
          validity: data.validity,
        });
      });

      typesArray.sort((a, b) => a.number - b.number);

      typesArray.forEach((t) => {
        if (t.validity === "expiration") {
          types[t.id] = t.name;
          validIds.push(t.id);
        }
      });

      setTypesMap(types);

      // 2. Получаем названия станций
      const stationsSnap = await getDocs(
        query(
          collection(db, "stations"),
          where("__name__", "in", currentUserData.stations),
        ),
      );

      const stations = {};
      stationsSnap.forEach((doc) => {
        stations[doc.id] = doc.data().stationName;
      });
      setStationsMap(stations);

      // 3. Получаем документы для станций пользователя
      let allDocs = [];

      // Разбиваем на группы по 30 (ограничение Firestore для оператора "in")
      const stationChunks = [];
      for (let i = 0; i < currentUserData.stations.length; i += 30) {
        stationChunks.push(currentUserData.stations.slice(i, i + 30));
      }

      for (const chunk of stationChunks) {
        const docsQuery = query(
          collection(db, "documents"),
          where("stationId", "in", chunk),
        );
        const docsSnap = await getDocs(docsQuery);

        docsSnap.forEach((doc) => {
          allDocs.push({ id: doc.id, ...doc.data() });
        });
      }

      // 4. Обрабатываем документы
      const processedDocs = allDocs
        .map((data) => {
          // Пропускаем документы с неправильным типом
          if (!validIds.includes(data.docType)) return null;

          const expiry = data.expiryDate ? new Date(data.expiryDate) : null;
          const issue = data.issueDate ? new Date(data.issueDate) : null;

          if (!expiry || !issue) return null;

          const now = new Date();
          const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

          return {
            id: data.id,
            stationId: data.stationId,
            stationName: stations[data.stationId] || data.stationId,
            typeId: data.docType,
            name: types[data.docType] || data.docType,
            issueDate: issue.toLocaleDateString(),
            expiryDate: expiry.toLocaleDateString(),
            expiryRaw: expiry,
            diffDays,
            daysLeft:
              diffDays < 0
                ? `${Math.abs(diffDays)} кунга муддати ўтган.`
                : `Тугашига ${diffDays} кун қолди.`,
            color: getStatusColor(expiry),
            fileUrl: data.fileUrl || null,
          };
        })
        .filter(Boolean); // Убираем null

      // 5. Сортировка
      const sortedDocs = processedDocs.sort((a, b) => {
        const numA =
          typesArray.find((t) => t.id === a.typeId)?.number ?? Infinity;
        const numB =
          typesArray.find((t) => t.id === b.typeId)?.number ?? Infinity;

        if (numA !== numB) return numA - numB;
        return b.expiryRaw - a.expiryRaw;
      });

      setDocs(sortedDocs);
    } catch (err) {
      console.error("Ошибка загрузки документов:", err);
      setError(`Хатолик юз берди: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Функция для получения отфильтрованных данных для статистики
  const getFilteredDocsForStats = () => {
    let filtered = [...docs];

    if (selectedType !== "Все") {
      filtered = filtered.filter((d) => d.name === selectedType);
    }

    if (selectedStation !== "Все") {
      filtered = filtered.filter((d) => d.stationId === selectedStation);
    }

    if (expiryFilter !== "Все") {
      filtered = filtered.filter((d) => {
        const days = d.diffDays;
        if (expiryFilter === "30 кун") return days <= 30 && days > 15;
        if (expiryFilter === "15 кун") return days <= 15 && days > 5;
        if (expiryFilter === "5 кун") return days <= 5 && days >= 0;
        if (expiryFilter === "Муддати ўтган") return days < 0;
        return true;
      });
    }

    if (showLatestOnly) {
      const latestDocs = {};
      filtered.forEach((d) => {
        const key = `${d.typeId}_${d.stationId}`;
        if (!latestDocs[key] || d.expiryRaw > latestDocs[key].expiryRaw) {
          latestDocs[key] = d;
        }
      });
      filtered = Object.values(latestDocs);
    }

    return filtered;
  };

  const applyFilters = () => {
    const filtered = getFilteredDocsForStats();
    setFilteredDocs(filtered);
  };

  // Получаем статистику для отображения (учитывает фильтры)
  const getStatsData = () => {
    const docsForStats = getFilteredDocsForStats();

    return {
      total: docsForStats.length,
      expired: docsForStats.filter((d) => d.diffDays < 0).length,
      less30: docsForStats.filter((d) => d.diffDays <= 30 && d.diffDays > 15)
        .length,
      less15: docsForStats.filter((d) => d.diffDays <= 15 && d.diffDays > 5)
        .length,
      less5: docsForStats.filter((d) => d.diffDays <= 5 && d.diffDays >= 0)
        .length,
      longTerm: docsForStats.filter((d) => d.diffDays > 30).length,
      expiringSoon: docsForStats.filter(
        (d) => d.diffDays >= 0 && d.diffDays <= 30,
      ).length,
    };
  };

  const exportToExcel = () => {
    if (filteredDocs.length === 0) {
      alert("Экспорт учун хужжатлар мавжуд эмас!");
      return;
    }

    const dataForExcel = filteredDocs.map((d, index) => ({
      "№": index + 1,
      Заправка: d.stationName,
      "Хужжат номи": d.name,
      "Берилган сана": d.issueDate,
      "Тугаш санаси": d.expiryDate,
      "Қолган муддат": d.diffDays,
      Статус: d.daysLeft,
      "Файлга хавола": d.fileUrl || "—",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Барча хужжатлар");
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    saveAs(
      new Blob([excelBuffer], { type: "application/octet-stream" }),
      `Барча_бириктирилган_хужжатлар_${new Date().toLocaleDateString()}.xlsx`,
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
        <div className="h-14 w-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Хужжатлар юкланмоқда...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Хатолик</h3>
          <p className="text-red-600">{error}</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition"
        >
          Орқага
        </button>
      </div>
    );
  }

  const stats = getStatsData();

  return (
    <div className="p-6">
      {/* Заголовок */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            Барча бириктирилган заправкалар хужжатлари
          </h1>
          <p className="text-gray-600 mt-1">
            Сизга бириктирилган {Object.keys(stationsMap).length} та заправка
            хужжатлари
            {selectedStation !== "Все" &&
              ` | Филтерланган: ${stationsMap[selectedStation]}`}
          </p>
          {/* {showLatestOnly && (
            <p className="text-blue-600 text-sm mt-1">
              ⚡ Фақат охирги хужжатлар кўрсатилмоқда (ҳар бир тип ва заправка
              учун янгиси)
            </p>
          )} */}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportToExcel}
            disabled={filteredDocs.length === 0}
            className={`px-4 py-2 rounded-lg transition ${
              filteredDocs.length === 0
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            Excel га экспорт
          </button>
          <button
            onClick={() => navigate(-1)}
            className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition"
          >
            Орқага
          </button>
        </div>
      </div>

      {/* Фильтры */}
      <div className="flex flex-wrap gap-4 mb-8">
        <select
          value={showLatestOnly ? "latest" : "all"}
          onChange={(e) => setShowLatestOnly(e.target.value === "latest")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700 bg-white"
        >
          <option value="all">Барча хужжатлар</option>
          <option value="latest">Охирги хужжатлар</option>
        </select>

        <select
          value={selectedStation}
          onChange={(e) => setSelectedStation(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700 bg-white"
          disabled={Object.keys(stationsMap).length === 0}
        >
          <option value="Все">Барча заправкалар</option>
          {Object.entries(stationsMap).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700 bg-white"
          disabled={Object.keys(typesMap).length === 0}
        >
          <option value="Все">Барча турлар</option>
          {Object.values(typesMap).map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>

        <select
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700 bg-white"
        >
          <option value="Все">Муддат бўйича</option>
          <option value="30 кун">30 кунгача</option>
          <option value="15 кун">15 кунгача</option>
          <option value="5 кун">5 кунгача</option>
          <option value="Муддати ўтган">Муддати ўтган</option>
        </select>
      </div>

      {/* Информация о количестве документов - ТЕПЕРЬ УЧИТЫВАЕТ ФИЛЬТРЫ */}
      {docs.length > 0 && (
        <div className="mb-8 p-4 bg-blue-50 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-blue-800">Умумий маълумот:</h3>
            <div className="text-sm text-blue-600">
              {showLatestOnly ? "Охирги хужжатлар" : "Барча хужжатлар"} |
              {selectedStation === "Все"
                ? " Барча заправкалар"
                : ` ${stationsMap[selectedStation]}`}{" "}
              |{selectedType === "Все" ? " Барча турлар" : ` ${selectedType}`}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-white rounded shadow">
              <div className="text-2xl font-bold text-blue-600">
                {stats.total}
              </div>
              <div className="text-sm text-gray-600">Жами хужжатлар</div>
            </div>

            <div className="text-center p-3 bg-white rounded shadow">
              <div className="text-2xl font-bold text-red-600">
                {stats.expired}
              </div>
              <div className="text-sm text-gray-600">Муддати ўтган</div>
            </div>

            <div className="text-center p-2 bg-white rounded border">
              <div className="font-bold text-lg" style={{ color: "#22c55e" }}>
                {stats.less30}
              </div>
              <div className="text-xs text-gray-600">30 кунгача</div>
            </div>
            <div className="text-center p-2 bg-white rounded border">
              <div className="font-bold text-lg" style={{ color: "#eab308" }}>
                {stats.less15}
              </div>
              <div className="text-xs text-gray-600">15 кунгача</div>
            </div>
            <div className="text-center p-2 bg-white rounded border">
              <div className="font-bold text-lg" style={{ color: "#f97316" }}>
                {stats.less5}
              </div>
              <div className="text-xs text-gray-600">5 кунгача</div>
            </div>
          </div>
        </div>
      )}

      {/* Карточки документов */}
      {filteredDocs.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-gray-400 text-5xl mb-4">📄</div>
          <p className="text-gray-500 text-lg mb-2">Хужжатлар топилмади</p>
          <p className="text-gray-400">
            {docs.length === 0
              ? "Сизга бириктирилган заправкаларда хужжатлар мавжуд эмас"
              : "Филтер боскичларига мос келувчи хужжатлар мавжуд эмас"}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 text-gray-600">
            Кўрсатилмоқда:{" "}
            <span className="font-semibold">{filteredDocs.length}</span> та
            хужжат
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredDocs.map((d) => (
              <div
                key={`${d.id}-${d.stationId}-${d.typeId}`}
                className={`rounded-lg p-4 shadow hover:shadow-md transition border ${d.color} bg-white`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h2 className="font-medium text-lg text-gray-800">
                      {d.name}
                    </h2>
                    <div className="mt-1 flex items-center">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        📍 {d.stationName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        d.diffDays < 0
                          ? "bg-red-500"
                          : d.diffDays <= 5
                            ? "bg-yellow-500"
                            : d.diffDays <= 15
                              ? "bg-orange-500"
                              : d.diffDays <= 30
                                ? "bg-green-500"
                                : "bg-gray-300"
                      }`}
                    ></div>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  <b>Берилган сана:</b> {d.issueDate}
                </p>
                <p className="text-sm text-gray-600">
                  <b>Тугаш санаси:</b> {d.expiryDate}
                </p>
                <p
                  className={`mt-2 text-sm font-medium ${
                    d.diffDays < 0
                      ? "text-red-600"
                      : d.diffDays <= 5
                        ? "text-orange-600"
                        : d.diffDays <= 15
                          ? "text-yellow-600"
                          : d.diffDays <= 30
                            ? "text-green-600"
                            : "text-gray-600"
                  }`}
                >
                  {d.daysLeft}
                </p>
                {d.fileUrl && (
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-blue-600 hover:underline text-sm"
                  >
                    📄 Файлни очиш
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default UserAllDocuments;
