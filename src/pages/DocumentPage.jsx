import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import DocumentTable from "../components/DocumentTable";
import { getStatusColor, getStatusText } from "../utils/dateUtils";

const DocumentPage = () => {
  const { id } = useParams(); // Например, "license" или "study_protocol"
  const [docTypeData, setDocTypeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stations, setStations] = useState([]);

  // фильтры
  const [filterLatestOnly, setFilterLatestOnly] = useState("all"); // all | latest
  const [selectedStation, setSelectedStation] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all"); // 30 | 15 | 5 | expired | all

  const navigate = useNavigate();

  useEffect(() => {
    const fetchDocType = async () => {
      try {
        const snap = await getDocs(collection(db, "document_types"));
        const allTypes = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const foundType = allTypes.find((t) => t.id === id);
        setDocTypeData(foundType || null);
      } catch (err) {
        console.error("Ошибка загрузки типа документа:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchStations = async () => {
      try {
        const snap = await getDocs(collection(db, "stations"));
        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setStations(data);
      } catch (err) {
        console.error("Ошибка загрузки станций:", err);
      }
    };

    fetchDocType();
    fetchStations();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="h-20 w-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!docTypeData) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-700">
        Тип документа не найден
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      {/* Верхняя панель фильтров */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        {/* Кнопка Назад */}
        <button
          onClick={() => navigate(-1)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
          ← Назад
        </button>
      </div>

      {/* Таблица документов */}
      <DocumentTable
        docType={docTypeData.id}
        docTypeName={docTypeData.name}
        color={docTypeData.color}
        filterLatestOnly={filterLatestOnly}
        selectedStation={selectedStation}
        expiryFilter={expiryFilter}
      />
    </div>
  );
};

export default DocumentPage;
