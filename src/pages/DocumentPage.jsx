// DocumentPage.jsx (обновленная версия)
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import DocumentTable from "../components/DocumentTable";

import { AddDocumentModalByType } from "../components";

const DocumentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [docTypeData, setDocTypeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchDocType = async () => {
      try {
        const snap = await getDocs(collection(db, "document_types"));
        const allTypes = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const foundType = allTypes.find((t) => t.id === id);
        setDocTypeData(foundType || { id, name: id, color: "bg-gray-400" });
      } catch (err) {
        console.error("Ошибка загрузки типа документа:", err);
        setDocTypeData({ id, name: id, color: "bg-gray-400" });
      } finally {
        setLoading(false);
      }
    };

    fetchDocType();
  }, [id]);

  const handleDocumentAdded = () => {
    setRefreshTrigger((prev) => prev + 1); // Триггер для обновления таблицы
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="px-3 py-2 rounded-md border hover:bg-gray-100">
              ← Назад
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`px-3 py-1 rounded-md text-white text-xl ${
                docTypeData?.color || "bg-gray-400"
              }`}>
              {docTypeData?.name?.slice(0, 20)}
            </div>

            {/* Кнопка добавления нового документа */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Добавить новый документ
            </button>
          </div>
        </div>

        <DocumentTable
          docType={id}
          docTypeData={docTypeData}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Модальное окно */}
      <AddDocumentModalByType
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        docType={id}
        docTypeData={docTypeData}
        onDocumentAdded={handleDocumentAdded}
      />
    </div>
  );
};

export default DocumentPage;
