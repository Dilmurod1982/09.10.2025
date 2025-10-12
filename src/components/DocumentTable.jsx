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

  useEffect(() => {
    fetchDocuments();
  }, [docType]);

  const fetchDocuments = async () => {
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

  const getRowColor = (expiryDate) => {
    const color = getStatusColor(expiryDate);
    const colorClasses = {
      red: "bg-red-50 hover:bg-red-100 border-l-4 border-red-500",
      yellow: "bg-yellow-50 hover:bg-yellow-100 border-l-4 border-yellow-500",
      orange: "bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-500",
      green: "bg-green-50 hover:bg-green-100 border-l-4 border-green-500",
      default: "bg-white hover:bg-gray-50 border-l-4 border-gray-300",
    };
    return colorClasses[color];
  };

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
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {docTypeName}
              </h1>
              <p className="text-gray-600">
                Управление документами и отслеживание сроков
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 flex items-center space-x-2">
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
              <span>Добавить документ</span>
            </button>
          </div>
        </div>

        {/* Table */}
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
                {documents.map((doc, index) => (
                  <tr
                    key={doc.id}
                    onClick={() => setSelectedDocument(doc)}
                    className={`cursor-pointer transition-all duration-200 transform hover:scale-[1.02] ${getRowColor(
                      doc.expiryDate
                    )}`}
                    style={{ animationDelay: `${index * 50}ms` }}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {doc.stationName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {doc.docNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(doc.issueDate).toLocaleDateString("ru-RU")}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(doc.expiryDate).toLocaleDateString("ru-RU")}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          getStatusColor(doc.expiryDate) === "red"
                            ? "bg-red-100 text-red-800"
                            : getStatusColor(doc.expiryDate) === "yellow"
                            ? "bg-yellow-100 text-yellow-800"
                            : getStatusColor(doc.expiryDate) === "orange"
                            ? "bg-orange-100 text-orange-800"
                            : getStatusColor(doc.expiryDate) === "green"
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
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Empty State */}
        {documents.length === 0 && (
          <div className="text-center py-12 animate-fade-in">
            <svg
              className="mx-auto h-24 w-24 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Документы не найдены
            </h3>
            <p className="text-gray-500 mb-4">
              Начните с добавления первого документа
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200">
              Добавить документ
            </button>
          </div>
        )}

        {/* Document Detail Modal */}
        {selectedDocument && (
          <DocumentDetailModal
            document={selectedDocument}
            onClose={() => setSelectedDocument(null)}
          />
        )}

        {/* Add Document Modal */}
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
