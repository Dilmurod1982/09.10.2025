import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";
import { getStatusColor, getStatusText } from "../utils/dateUtils";
import AddDocumentModal from "./AddDocumentModal";
import DocumentDetailModal from "./DocumentDetailModal";

const DocumentTable = ({ docType, docTypeName }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [stations, setStations] = useState([]);

  // Фильтры
  const [filterLatestOnly, setFilterLatestOnly] = useState("all"); // all | latest
  const [selectedStation, setSelectedStation] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all"); // all | 30 | 15 | 5 | expired

  useEffect(() => {
    fetchDocuments();
    fetchStations();
  }, [docType]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "documents"),
        where("docType", "==", docType),
        orderBy("expiryDate", "asc")
      );
      const querySnapshot = await getDocs(q);
      const docs = [];
      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setDocuments(docs);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStations = async () => {
    try {
      const q = collection(db, "stations");
      const snap = await getDocs(q);
      const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setStations(data);
    } catch (err) {
      console.error("Error fetching stations:", err);
    }
  };

  const getRowColor = (expiryDate) => {
    const color = getStatusColor(expiryDate);
    const colorClasses = {
      "bg-red-200": "bg-red-50 hover:bg-red-100 border-l-4 border-red-500",
      "bg-yellow-200":
        "bg-yellow-50 hover:bg-yellow-100 border-l-4 border-yellow-500",
      "bg-orange-200":
        "bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-500",
      "bg-green-200":
        "bg-green-50 hover:bg-green-100 border-l-4 border-green-500",
      "bg-white": "bg-white hover:bg-gray-50 border-l-4 border-gray-300",
    };
    return colorClasses[color] || colorClasses["bg-white"];
  };

  // Применяем фильтры
  const filteredDocuments = (() => {
    let filtered = [...documents];
    const today = new Date();

    // фильтр по станции
    if (selectedStation !== "all") {
      filtered = filtered.filter((doc) => doc.stationId === selectedStation);
    }

    // фильтр по срокам
    filtered = filtered.filter((doc) => {
      const expiry = new Date(doc.expiryDate);
      const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
      if (expiryFilter === "expired") return diffDays < 0;
      if (expiryFilter === "5") return diffDays <= 5 && diffDays >= 0;
      if (expiryFilter === "15") return diffDays <= 15 && diffDays > 5;
      if (expiryFilter === "30") return diffDays <= 30 && diffDays > 15;
      return true;
    });

    // фильтр "только последние документы по станции"
    if (filterLatestOnly === "latest") {
      const byStation = {};
      for (const doc of filtered) {
        if (
          !byStation[doc.stationId] ||
          new Date(doc.expiryDate) >
            new Date(byStation[doc.stationId].expiryDate)
        ) {
          byStation[doc.stationId] = doc;
        }
      }
      filtered = Object.values(byStation);
    }

    return filtered;
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header и Фильтры */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap gap-4 items-center">
            <select
              value={filterLatestOnly}
              onChange={(e) => setFilterLatestOnly(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm">
              <option value="latest">Только последние документы</option>
              <option value="all">Все документы</option>
            </select>
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm">
              <option value="all">Все станции</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm">
              <option value="all">Все сроки</option>
              <option value="30">Осталось 30 дней</option>
              <option value="15">Осталось 15 дней</option>
              <option value="5">Осталось 5 дней</option>
              <option value="expired">Просрочено</option>
            </select>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200">
            Добавить документ
          </button>
        </div>

        {/* Таблица */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Станция
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Номер документа
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата выдачи
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата истечения
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Файл
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((doc, index) => (
                  <tr
                    key={doc.id}
                    onClick={() => setSelectedDocument(doc)}
                    className={`cursor-pointer transition-all duration-200 transform hover:scale-[1.02] ${getRowColor(
                      doc.expiryDate
                    )}`}
                    style={{ animationDelay: `${index * 50}ms` }}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {doc.stationName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doc.docNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(doc.issueDate).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(doc.expiryDate).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          getStatusColor(doc.expiryDate) === "bg-red-200"
                            ? "bg-red-100 text-red-800"
                            : getStatusColor(doc.expiryDate) === "bg-yellow-200"
                            ? "bg-yellow-100 text-yellow-800"
                            : getStatusColor(doc.expiryDate) === "bg-orange-200"
                            ? "bg-orange-100 text-orange-800"
                            : getStatusColor(doc.expiryDate) === "bg-green-200"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                        {getStatusText(doc.expiryDate)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {doc.fileUrl && (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:text-blue-800 transition-colors duration-200">
                          🔗
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Empty state */}
        {filteredDocuments.length === 0 && (
          <div className="text-center py-12 animate-fade-in">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Документы не найдены
            </h3>
            <p className="text-gray-500 mb-4">
              Измените фильтры или добавьте новый документ
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200">
              Добавить документ
            </button>
          </div>
        )}

        {/* Modals */}
        {selectedDocument && (
          <DocumentDetailModal
            document={selectedDocument}
            onClose={() => setSelectedDocument(null)}
          />
        )}
        {showAddModal && (
          <AddDocumentModal
            docType={docType}
            docTypeName={docTypeName}
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              setShowAddModal(false);
              fetchDocuments();
            }}
          />
        )}
      </div>
    </div>
  );
};

export default DocumentTable;
