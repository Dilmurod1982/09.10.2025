import React from "react";
import { getStatusColor, getStatusText } from "../utils/dateUtils";

const DocumentDetailModal = ({ document, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transform animate-scale-in">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Детали документа
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Status Badge */}
            <div
              className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                getStatusColor(document.expiryDate) === "red"
                  ? "bg-red-100 text-red-800"
                  : getStatusColor(document.expiryDate) === "yellow"
                  ? "bg-yellow-100 text-yellow-800"
                  : getStatusColor(document.expiryDate) === "orange"
                  ? "bg-orange-100 text-orange-800"
                  : getStatusColor(document.expiryDate) === "green"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
              }`}>
              {getStatusText(document.expiryDate)}
            </div>

            {/* Document Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Станция
                </label>
                <p className="text-lg font-semibold text-gray-900">
                  {document.stationName}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Номер документа
                </label>
                <p className="text-lg font-semibold text-gray-900">
                  {document.docNumber}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Дата выдачи
                </label>
                <p className="text-lg text-gray-900">
                  {new Date(document.issueDate).toLocaleDateString("ru-RU")}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Дата истечения
                </label>
                <p className="text-lg text-gray-900">
                  {new Date(document.expiryDate).toLocaleDateString("ru-RU")}
                </p>
              </div>
            </div>

            {/* File Download */}
            {document.fileUrl && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-3">
                  Файл документа
                </label>
                <a
                  href={document.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105">
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
                  <span>Скачать документ</span>
                </a>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200">
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentDetailModal;
