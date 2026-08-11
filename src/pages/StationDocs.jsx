import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getStatusColor } from "../utils/dateUtils";
import AddDocumentModalByStation from "../components/AddDocumentModalByStation";
import { useAppStore } from "../lib/zustand";

const StationDocs = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const userData = useAppStore((state) => state.userData);
  const role = userData?.role;

  const [docs, setDocs] = useState([]);
  const [filteredDocs, setFilteredDocs] = useState([]);
  const [stationName, setStationName] = useState("");
  const [typesMap, setTypesMap] = useState({});
  const [validExpirationIds, setValidExpirationIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missingDocs, setMissingDocs] = useState([]);

  const [showLatestOnly, setShowLatestOnly] = useState(true);
  const [selectedType, setSelectedType] = useState("Все");
  const [expiryFilter, setExpiryFilter] = useState("Все");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Разрешенные типы документов для метролога
  const getFilteredTypeIds = (allTypeIds, typesMapData) => {
    if (role === "metrolog-hududgaz") {
      const allowedTypes = [
        "Газ ҳисоблаш тугунини сертификати (ИК)",
        "Газ ҳисоблагич сертификати (Автопилот)",
        "Торайтирувчи мослама сертификати (Шайба)",
      ];

      // Фильтруем ID типов документов по названиям
      const filteredIds = [];
      allTypeIds.forEach((id) => {
        const typeName = typesMapData[id];
        if (typeName && allowedTypes.includes(typeName)) {
          filteredIds.push(id);
        }
      });

      return filteredIds;
    }
    return allTypeIds;
  };

  // Проверяем, может ли пользователь добавлять документы
  const canAddDocuments =
    userData &&
    (userData.role === "admin" ||
      userData.role === "nazorat" ||
      userData.role === "rahbar") &&
    role !== "metrolog-hududgaz"; // Метролог не может добавлять

  useEffect(() => {
    fetchDocs();
  }, [id, role]);

  useEffect(() => {
    applyFilters();
  }, [docs, showLatestOnly, selectedType, expiryFilter]);

  const fetchDocs = async () => {
    try {
      setLoading(true);

      // === Получаем типы документов ===
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

      // 🔹 Применяем фильтрацию для метролога
      const filteredValidIds = getFilteredTypeIds(validIds, types);
      setValidExpirationIds(filteredValidIds);

      // === Станция ===
      const stationSnap = await getDocs(
        query(collection(db, "stations"), where("__name__", "==", id)),
      );
      if (!stationSnap.empty)
        setStationName(stationSnap.docs[0].data().stationName);

      // === Документы станции ===
      const docsSnap = await getDocs(
        query(collection(db, "documents"), where("stationId", "==", id)),
      );

      const docsData = docsSnap.docs
        .map((doc) => {
          const data = doc.data();

          // Проверяем, что тип документа входит в разрешенные
          if (!filteredValidIds.includes(data.docType)) return null;

          const expiry = new Date(data.expiryDate);
          const issue = new Date(data.issueDate);
          const now = new Date();
          const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

          return {
            id: doc.id,
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
        })
        .filter(Boolean);

      // === Сортировка по number ===
      const sortedDocs = docsData.sort((a, b) => {
        const numA =
          typesArray.find((t) => t.id === a.typeId)?.number ?? Infinity;
        const numB =
          typesArray.find((t) => t.id === b.typeId)?.number ?? Infinity;
        return numA - numB;
      });

      setDocs(sortedDocs);

      // === Вычисляем отсутствующие документы (только для разрешенных типов) ===
      const existingTypeIds = new Set(sortedDocs.map((d) => d.typeId));
      const missing = typesArray
        .filter(
          (t) =>
            t.validity === "expiration" &&
            filteredValidIds.includes(t.id) &&
            !existingTypeIds.has(t.id),
        )
        .map((t) => ({ id: t.id, name: t.name }));

      setMissingDocs(missing);
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
        if (
          !latestDocs[d.typeId] ||
          d.expiryRaw > latestDocs[d.typeId].expiryRaw
        ) {
          latestDocs[d.typeId] = d;
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Хужжатлар");
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    saveAs(
      new Blob([excelBuffer], { type: "application/octet-stream" }),
      `${stationName || "Станция"}_Хужжатлар.xlsx`,
    );
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="h-14 w-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  return (
    <div className="p-6">
      {/* Информационное сообщение для метролога */}
      {role === "metrolog-hududgaz" && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
          <span className="font-medium">ℹ️ </span>
          Фақат газ ускуналари бўйича ҳужжатлар кўрсатилмоқда. Қуйидаги ҳужжат:
          <ul className="list-disc list-inside mt-1 ml-2">
            <li>Газ ҳисоблаш тугунини сертификати (ИК)</li>
            <li>Газ ҳисоблагич сертификати (Автопилот)</li>
            <li>Торайтирувчи мослама сертификати (Шайба)</li>
          </ul>
        </div>
      )}

      {/* Заголовок */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-gray-800">
          {stationName} заправка муддатли хужжатлари
        </h1>
        <div className="flex flex-wrap gap-3">
          {/* Кнопка "Добавить документ" показывается только для определенных ролей, но не для метролога */}
          {canAddDocuments && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
              + Янги хужжат қўшиш
            </button>
          )}
          <button
            onClick={exportToExcel}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
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
          className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700"
        >
          <option value="all">Барча хужжатлар</option>
          <option value="latest">Охирги хужжатлар</option>
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700"
        >
          <option value="Все">Барчаси</option>
          {Object.values(typesMap)
            .filter((type) => {
              // Если метроолог, показываем только разрешенные типы
              if (role === "metrolog-hududgaz") {
                const allowedTypes = [
                  "Газ ҳисоблаш тугунини сертификати (ИК)",
                  "Газ ҳисоблагич сертификати (Автопилот)",
                  "Торайтирувчи мослама сертификати (Шайба)",
                ];
                return allowedTypes.includes(type);
              }
              return true;
            })
            .map((type) => (
              <option key={type}>{type}</option>
            ))}
        </select>

        <select
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700"
        >
          <option value="Все">Муддат бўйича</option>
          <option value="30 кун">30 кунгача</option>
          <option value="15 кун">15 кунгача</option>
          <option value="5 кун">5 кунгача</option>
          <option value="Муддати ўтган">Муддати ўтган</option>
        </select>
      </div>

      {/* Карточки документов */}
      {filteredDocs.length === 0 ? (
        <p className="text-center text-gray-500 mt-10">Хужжатлар топилмади</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredDocs.map((d) => (
            <div
              key={d.id}
              className={`rounded-lg p-4 shadow hover:shadow-md transition border ${d.color}`}
            >
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-medium text-lg text-gray-800">{d.name}</h2>
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
              <p className="mt-2 text-sm font-medium">{d.daysLeft}</p>
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
      )}

      {/* Отсутствующие документы */}
      {missingDocs.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Базага киритилмаган:
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {missingDocs.map((m) => (
              <li
                key={m.id}
                className="border border-dashed border-gray-400 rounded-lg p-4 text-gray-600 bg-gray-50 hover:bg-gray-100 transition"
              >
                {m.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Модальное окно добавления документа - скрываем для метролога */}
      {canAddDocuments && (
        <AddDocumentModalByStation
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          stationId={id}
          stationName={stationName}
          onDocumentAdded={fetchDocs}
        />
      )}
    </div>
  );
};

export default StationDocs;
