import React, { useState, useRef, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  doc as firestoreDoc,
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import toast from "react-hot-toast";

const AddDocumentModalByStationInf = ({
  isOpen,
  onClose,
  stationId,
  stationName,
  onDocumentAdded,
}) => {
  const [formData, setFormData] = useState({
    docType: "",
    docNumber: "",
    issueDate: "",
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [docTypes, setDocTypes] = useState([]);
  const [localStationName, setLocalStationName] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchDocTypes = async () => {
      try {
        const snap = await getDocs(collection(db, "document_types"));
        const typesList = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() || {}) }))
          .filter((t) => t.validity === "infinity");
        setDocTypes(typesList);
      } catch (err) {
        console.error("Ошибка загрузки типов документов:", err);
        toast.error("Ошибка загрузки типов документов 😕");
      }
    };

    const fetchStationNameIfNeeded = async () => {
      try {
        if ((!stationName || stationName === "") && stationId) {
          const sRef = firestoreDoc(db, "stations", stationId);
          const sSnap = await getDoc(sRef);
          if (sSnap.exists()) {
            const name = sSnap.data().name || "";
            setLocalStationName(name);
          }
        } else {
          setLocalStationName(stationName || "");
        }
      } catch (err) {
        console.error("Ошибка загрузки станции:", err);
        toast.error("Ошибка загрузки станции 😕");
      }
    };

    fetchDocTypes();
    fetchStationNameIfNeeded();

    setFormData({
      docType: "",
      docNumber: "",
      issueDate: "",
    });
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [isOpen, stationId, stationName]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("Файл слишком большой (макс. 10MB)");
      return;
    }
    setFile(selectedFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.docType || !formData.docNumber || !formData.issueDate) {
      toast.error("Заполните все обязательные поля ⚠️");
      return;
    }
    if (!file) {
      toast.error("Выберите файл для загрузки 📄");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Сохраняем документ...");

    try {
      const storagePath = `documents/${formData.docType}/${Date.now()}_${
        file.name
      }`;
      const fileRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(fileRef, file);
      const fileUrl = await getDownloadURL(snapshot.ref);

      const stationNameToSave = localStationName || stationName || "";

      const docData = {
        docType: formData.docType,
        docNumber: formData.docNumber,
        issueDate: formData.issueDate,

        stationId: stationId || "",
        stationName: stationNameToSave,
        fileName: file.name,
        fileUrl,
        createdAt: new Date(),
      };

      await addDoc(collection(db, "documents"), docData);

      toast.success("Документ успешно добавлен ✅", { id: toastId });
      if (onDocumentAdded) await onDocumentAdded();
      handleClose();
    } catch (err) {
      console.error("Ошибка при создании документа:", err);
      toast.error("Ошибка при создании документа 😢", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      docType: "",
      docNumber: "",
      issueDate: "",
    });
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLocalStationName("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg animate-fadeIn">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Добавить документ</h2>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Станция */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Станция
            </label>
            <input
              type="text"
              value={localStationName || stationName || ""}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
          </div>

          {/* Тип документа */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Тип документа *
            </label>
            <select
              value={formData.docType}
              onChange={(e) =>
                setFormData((p) => ({ ...p, docType: e.target.value }))
              }
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="">Выберите тип документа</option>
              {docTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || t.id}
                </option>
              ))}
            </select>
          </div>

          {/* Номер документа */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Номер документа *
            </label>
            <input
              type="text"
              value={formData.docNumber}
              onChange={(e) =>
                setFormData((p) => ({ ...p, docNumber: e.target.value }))
              }
              placeholder="Введите номер документа"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Даты */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата выдачи *
            </label>
            <input
              type="date"
              value={formData.issueDate}
              onChange={(e) =>
                setFormData((p) => ({ ...p, issueDate: e.target.value }))
              }
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Файл */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Файл документа *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

export default AddDocumentModalByStationInf;
