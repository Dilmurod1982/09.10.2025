import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";
import { getStatusColor, getStatusText } from "../utils/dateUtils";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const DocumentTable = ({ docType, docTypeName }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Загружаем документы
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const q = query(collection(db, docType), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const docsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDocuments(docsData);
      } catch (error) {
        console.error("Ошибка загрузки документов:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [docType]);

  // Экспорт в Excel
  const handleExportToExcel = () => {
    if (documents.length === 0) {
      alert("Нет данных для экспорта!");
      return;
    }

    // Преобразуем данные в формат таблицы
    const exportData = documents.map((doc) => ({
      ID: doc.id,
      "Номер документа": doc.number || "",
      "Дата принятия": doc.date_of_issue || "",
      "Срок действия": doc.date_of_expiry || "",
      Статус: getStatusText(doc.date_of_expiry),
      Название: docTypeName,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Документы");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, `${docTypeName}.xlsx`);
  };

  if (loading) {
    return <p className="text-center text-gray-500">Загрузка...</p>;
  }

  if (documents.length === 0) {
    return <p className="text-center text-gray-500">Документы отсутствуют</p>;
  }

  return (
    <div className="p-4 bg-white rounded-2xl shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">{docTypeName}</h2>
        <button
          onClick={handleExportToExcel}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition">
          Экспорт в Excel
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200 text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3 border-b">№</th>
              <th className="p-3 border-b">Номер документа</th>
              <th className="p-3 border-b">Дата принятия</th>
              <th className="p-3 border-b">Срок действия</th>
              <th className="p-3 border-b">Статус</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc, index) => (
              <tr key={doc.id} className="hover:bg-gray-50">
                <td className="p-3 border-b">{index + 1}</td>
                <td className="p-3 border-b">{doc.number || "—"}</td>
                <td className="p-3 border-b">{doc.date_of_issue || "—"}</td>
                <td className="p-3 border-b">{doc.date_of_expiry || "—"}</td>
                <td className="p-3 border-b">
                  <span
                    className={`px-3 py-1 rounded-full text-white text-xs ${getStatusColor(
                      doc.date_of_expiry
                    )}`}>
                    {getStatusText(doc.date_of_expiry)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DocumentTable;
