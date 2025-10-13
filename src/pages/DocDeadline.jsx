import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

const DocDeadline = () => {
  const [documentTypes, setDocumentTypes] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 🔹 Загружаем типы документов
      const typesSnap = await getDocs(collection(db, "document_types"));
      const typesData = typesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 🔹 Загружаем все документы
      const docsSnap = await getDocs(collection(db, "documents"));
      const counts = {};

      docsSnap.forEach((doc) => {
        const data = doc.data();
        const type = data.docType;
        const expiry = new Date(data.expiryDate);
        const now = new Date();
        const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

        if (!counts[type]) {
          counts[type] = {
            total: 0,
            expired: 0,
            less30: 0,
            less15: 0,
            less5: 0,
          };
        }

        counts[type].total++;

        if (diffDays < 0) counts[type].expired++;
        else if (diffDays <= 5) counts[type].less5++;
        else if (diffDays <= 15) counts[type].less15++;
        else if (diffDays <= 30) counts[type].less30++;
      });

      setDocumentTypes(typesData);
      setStats(counts);
    } catch (err) {
      console.error("Ошибка загрузки данных:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="h-20 w-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 🔹 Сортировка: сначала типы с просроченными/срочными документами
  const sortedTypes = [...documentTypes].sort((a, b) => {
    const aStats = stats[a.id] || {};
    const bStats = stats[b.id] || {};
    const aScore =
      (aStats.expired || 0) * 100 +
      (aStats.less5 || 0) * 50 +
      (aStats.less15 || 0) * 30 +
      (aStats.less30 || 0) * 10;
    const bScore =
      (bStats.expired || 0) * 100 +
      (bStats.less5 || 0) * 50 +
      (bStats.less15 || 0) * 30 +
      (bStats.less30 || 0) * 10;
    return bScore - aScore;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-10 px-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 text-center mb-10">
          Сроки Действия Документов
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedTypes.map((docType) => {
            const typeStats = stats[docType.id] || {
              total: 0,
              expired: 0,
              less30: 0,
              less15: 0,
              less5: 0,
            };

            return (
              <Link
                key={docType.id}
                to={`/documents/${docType.id}`}
                className="group">
                <div className="bg-white rounded-2xl shadow-md hover:shadow-2xl p-6 transition-transform transform hover:-translate-y-2 border border-gray-200 hover:border-blue-300 duration-300">
                  <div
                    className={`w-12 h-12 ${
                      docType.color || "bg-blue-500"
                    } rounded-xl flex items-center justify-center mb-4`}>
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                    {docType.name}
                  </h3>

                  {typeStats.total > 0 ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-700 font-medium">
                        <span>Всего:</span>
                        <span>{typeStats.total}</span>
                      </div>

                      {typeStats.less30 > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Меньше 30 дней:</span>
                          <span>{typeStats.less30}</span>
                        </div>
                      )}
                      {typeStats.less15 > 0 && (
                        <div className="flex justify-between text-orange-500">
                          <span>Меньше 15 дней:</span>
                          <span>{typeStats.less15}</span>
                        </div>
                      )}
                      {typeStats.less5 > 0 && (
                        <div className="flex justify-between text-yellow-500 font-medium">
                          <span>Меньше 5 дней:</span>
                          <span>{typeStats.less5}</span>
                        </div>
                      )}
                      {typeStats.expired > 0 && (
                        <div className="flex justify-between text-red-600 font-semibold">
                          <span>Просрочено:</span>
                          <span>{typeStats.expired}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm italic">Нет данных</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DocDeadline;
