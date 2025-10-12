import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config"; // Убедитесь что storage импортируется

const AddDocumentModal = ({ docType, docTypeName, onClose, onSuccess }) => {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    stationId: "",
    docNumber: "",
    issueDate: "",
    expiryDate: "",
    file: null,
  });

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "stations"));
      const stationsList = [];
      querySnapshot.forEach((doc) => {
        stationsList.push({ id: doc.id, ...doc.data() });
      });
      setStations(stationsList);
    } catch (error) {
      console.error("Error fetching stations:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !formData.stationId ||
      !formData.docNumber ||
      !formData.issueDate ||
      !formData.expiryDate
    ) {
      alert("Пожалуйста, заполните все обязательные поля");
      return;
    }

    setLoading(true);
    try {
      let fileUrl = "";

      // Upload file if exists
      if (formData.file) {
        const fileRef = ref(
          storage,
          `documents/${docType}/${Date.now()}_${formData.file.name}`
        );
        const snapshot = await uploadBytes(fileRef, formData.file);
        fileUrl = await getDownloadURL(snapshot.ref);
      }

      // Get station name
      const selectedStation = stations.find(
        (station) => station.id === formData.stationId
      );

      // Save document data
      await addDoc(collection(db, "documents"), {
        stationId: formData.stationId,
        stationName: selectedStation?.stationName || "Неизвестная станция",
        docType: docType,
        docNumber: formData.docNumber,
        issueDate: formData.issueDate,
        expiryDate: formData.expiryDate,
        fileName: formData.file?.name || "",
        fileUrl: fileUrl,
        createdAt: new Date(),
      });

      onSuccess();
    } catch (error) {
      console.error("Error adding document:", error);
      alert("Ошибка при добавлении документа");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      file: e.target.files[0],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform animate-scale-in">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Добавить {docTypeName}
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Станция *
              </label>
              <select
                required
                value={formData.stationId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    stationId: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200">
                <option value="">Выберите станцию</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.stationName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Номер документа *
              </label>
              <input
                type="text"
                required
                value={formData.docNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    docNumber: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                placeholder="Введите номер документа"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата выдачи *
              </label>
              <input
                type="date"
                required
                value={formData.issueDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    issueDate: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата истечения срока *
              </label>
              <input
                type="date"
                required
                value={formData.expiryDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    expiryDate: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Файл документа
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
                disabled={loading}>
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? "Добавление..." : "Добавить"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddDocumentModal;
