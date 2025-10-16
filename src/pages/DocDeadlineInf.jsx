import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";

const DocDeadlineInf = () => {
  const [documentTypes, setDocumentTypes] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  const { documents, setDocuments } = useAppStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const typesSnap = await getDocs(collection(db, "document_types"));
        const typesData = typesSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((type) => type.validity === "infinity")
          .sort((a, b) => (a.number || 0) - (b.number || 0)); // ✅ сортировка по полю number

        const docsSnap = await getDocs(collection(db, "documents"));
        const docsData = docsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setDocuments(docsData);

        const counts = {};
        const now = new Date();
        docsData.forEach((data) => {
          const type = data.docType;
          const expiry = data.expiryDate ? new Date(data.expiryDate) : null;
          const diffDays = expiry
            ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
            : Infinity;

          if (!counts[type])
            counts[type] = {
              total: 0,
              expired: 0,
              less30: 0,
              less15: 0,
              less5: 0,
            };

          counts[type].total++;
          if (expiry === null) return;
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

    fetchData();
  }, [setDocuments]);

  if (loading) return <p className="text-center text-gray-500">Загрузка...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Сроки действия документов</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {documentTypes.map((type) => {
          const s = stats[type.id] || {};
          return (
            <Link
              to={`/documentsinf/${type.id}`}
              key={type.id}
              className="border rounded-lg p-4 hover:shadow-md transition bg-white">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-medium text-lg">{type.name}</h2>
                <div
                  className={`w-8 h-8 rounded-md ${
                    type.color || "bg-blue-500"
                  }`}
                />
              </div>
              <div className="space-y-1 text-sm">
                <p>Всего: {s.total || 0}</p>
                <p className="text-red-600">Просрочено: {s.expired || 0}</p>
                <p className="text-orange-500">Меньше 5 дней: {s.less5 || 0}</p>
                <p className="text-yellow-500">
                  Меньше 15 дней: {s.less15 || 0}
                </p>
                <p className="text-blue-500">Меньше 30 дней: {s.less30 || 0}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default DocDeadlineInf;
