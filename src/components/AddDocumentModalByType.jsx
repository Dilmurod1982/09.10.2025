// components/AddDocumentModal.jsx
import React, { useState, useRef } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";

const AddDocumentModalByType = ({
  isOpen,
  onClose,
  docType,
  docTypeData,
  onDocumentAdded,
}) => {
  const [formData, setFormData] = useState({
    stationId: "",
    stationName: "",
    docNumber: "",
    issueDate: "",
    expiryDate: "",
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stations, setStations] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const fileInputRef = useRef(null);

  // Загрузка станций
  React.useEffect(() => {
    const fetchStations = async () => {
      try {
        const snap = await getDocs(collection(db, "stations"));
        const stationsList = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setStations(stationsList);
      } catch (error) {
        console.error("Ошибка загрузки станций:", error);
      }
    };

    if (isOpen) {
      fetchStations();
    }
  }, [isOpen]);

  // Исправленная фильтрация станций
  const filteredStations = stations.filter((station) => {
    const searchLower = searchTerm.toLowerCase();

    // Проверяем название станции
    if (station.stationName?.toLowerCase().includes(searchLower)) {
      return true;
    }

    // Проверяем адресные поля
    if (station.address) {
      const addressFields = [
        station.address.msc,
        station.address.street,
        station.address.house,
        station.address.regionName,
        station.address.cityName,
      ];

      return addressFields.some(
        (field) => field && field.toLowerCase().includes(searchLower)
      );
    }

    return false;
  });

  const handleStationSelect = (station) => {
    setFormData((prev) => ({
      ...prev,
      stationId: station.id,
      stationName: station.stationName,
    }));
    setSearchTerm(station.stationName);
    setShowDropdown(false);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Проверка размера файла (максимум 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert("Файл слишком большой. Максимальный размер: 10MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.stationId || !formData.docNumber || !formData.issueDate) {
      alert("Пожалуйста, заполните обязательные поля");
      return;
    }

    if (!file) {
      alert("Пожалуйста, выберите файл");
      return;
    }

    setLoading(true);

    try {
      // Загрузка файла в Firebase Storage
      const fileRef = ref(
        storage,
        `documents/${docType}/${Date.now()}_${file.name}`
      );
      const snapshot = await uploadBytes(fileRef, file);
      const fileUrl = await getDownloadURL(snapshot.ref);

      // Создание документа в Firestore
      const docData = {
        docType: docType,
        docNumber: formData.docNumber,
        issueDate: formData.issueDate,
        expiryDate: formData.expiryDate || "",
        stationId: formData.stationId,
        stationName: formData.stationName,
        fileName: file.name,
        fileUrl: fileUrl,
        createdAt: new Date(),
      };

      await addDoc(collection(db, "documents"), docData);

      // Очистка формы
      setFormData({
        stationId: "",
        stationName: "",
        docNumber: "",
        issueDate: "",
        expiryDate: "",
      });
      setFile(null);
      setSearchTerm("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Вызов callback и закрытие модального окна
      if (onDocumentAdded) {
        onDocumentAdded();
      }
      onClose();
    } catch (error) {
      console.error("Ошибка при создании документа:", error);
      alert("Ошибка при создании документа. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      stationId: "",
      stationName: "",
      docNumber: "",
      issueDate: "",
      expiryDate: "",
    });
    setFile(null);
    setSearchTerm("");
    setShowDropdown(false);
    onClose();
  };

  // Функция для форматирования адреса для отображения
  const formatAddress = (station) => {
    if (!station.address) return "Адрес не указан";

    const addr = station.address;
    const parts = [
      addr.regionName,
      addr.cityName,
      addr.msc,
      addr.street,
      addr.house && `д. ${addr.house}`,
    ].filter(Boolean);

    return parts.join(", ") || "Адрес не указан";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Добавить новый документ</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full">
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

        {/* Форма */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 1. Тип документа (неактивный) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Тип документа
            </label>
            <input
              type="text"
              value={docTypeData?.name || docType}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
          </div>

          {/* 2. Станция с поиском */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Станция *
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
                setFormData((prev) => ({
                  ...prev,
                  stationId: "",
                  stationName: "",
                }));
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Поиск станции..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />

            {showDropdown && searchTerm && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredStations.length === 0 ? (
                  <div className="px-4 py-2 text-gray-500 text-center">
                    Станции не найдены
                  </div>
                ) : (
                  filteredStations.map((station) => (
                    <div
                      key={station.id}
                      onClick={() => handleStationSelect(station)}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0">
                      <div className="font-medium">{station.stationName}</div>
                      <div className="text-sm text-gray-500">
                        {formatAddress(station)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 3. Номер документа */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Номер документа *
            </label>
            <input
              type="text"
              value={formData.docNumber}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, docNumber: e.target.value }))
              }
              placeholder="Введите номер документа"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* 4. Дата выдачи */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата выдачи *
            </label>
            <input
              type="date"
              value={formData.issueDate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, issueDate: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* 5. Дата истечения срока */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата истечения срока
            </label>
            <input
              type="date"
              value={formData.expiryDate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, expiryDate: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 6. Загрузка файла */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Файл документа *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              required
            />
            {file && (
              <p className="mt-1 text-sm text-green-600">
                Выбран файл: {file.name}
              </p>
            )}
          </div>

          {/* Кнопки */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50">
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center">
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Сохранение...
                </>
              ) : (
                "Сохранить"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDocumentModalByType;
