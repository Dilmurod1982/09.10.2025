import React, { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";

const AddElectricReadingModal = ({ onClose, meter, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [loadingLastDate, setLoadingLastDate] = useState(true);
  const [lastReading, setLastReading] = useState(null);
  const [isFirstEntry, setIsFirstEntry] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});

  const [formData, setFormData] = useState({
    readingDate: getTodayString(),
    activeEnergy: "",
    reactiveEnergy: "",
    eco: "",
  });

  function getTodayString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function getNextDay(dateStr) {
    if (!dateStr) return getTodayString();
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() + 1);
    const ny = d.getUTCFullYear();
    const nm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const nd = String(d.getUTCDate()).padStart(2, "0");
    return `${ny}-${nm}-${nd}`;
  }

  function normalizeNumberInput(raw) {
    if (raw === "" || raw === null || raw === undefined) return "";
    let cleaned = String(raw).replace(/,/g, ".");
    cleaned = cleaned.replace(/[^\d.-]/g, "");
    const hasMinus = cleaned.startsWith("-");
    cleaned = cleaned.replace(/-/g, "");
    if (hasMinus) cleaned = "-" + cleaned;
    const firstDot = cleaned.indexOf(".");
    if (firstDot !== -1) {
      cleaned =
        cleaned.substring(0, firstDot + 1) +
        cleaned.substring(firstDot + 1).replace(/\./g, "");
    }
    const dotIdx = cleaned.indexOf(".");
    if (dotIdx !== -1) {
      const intPart = cleaned.substring(0, dotIdx);
      const fracPart = cleaned.substring(dotIdx + 1).substring(0, 5);
      cleaned = `${intPart}.${fracPart}`;
    }
    return cleaned;
  }

  function parseNumber(value) {
    if (value === "" || value === null || value === undefined) return null;
    const cleaned = String(value).replace(/,/g, ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  useEffect(() => {
    const loadLastReading = async () => {
      try {
        setLoadingLastDate(true);
        const q = query(
          collection(db, "electricReadings"),
          where("meterId", "==", meter.id),
          orderBy("readingDate", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          const lastReadingData = {
            id: snap.docs[0].id,
            ...snap.docs[0].data(),
          };
          setLastReading(lastReadingData);
          setIsFirstEntry(false);

          const nextDate = getNextDay(lastReadingData.readingDate);
          setFormData((prev) => ({
            ...prev,
            readingDate: nextDate,
          }));
        } else {
          setLastReading(null);
          setIsFirstEntry(true);
          setFormData((prev) => ({
            ...prev,
            readingDate: getTodayString(),
          }));
        }
      } catch (err) {
        console.error("Ошибка загрузки последнего показания:", err);
      } finally {
        setLoadingLastDate(false);
      }
    };

    if (meter?.id) {
      loadLastReading();
    }
  }, [meter?.id]);

  const validateNotLessThanPrevious = (field, value) => {
    if (isFirstEntry || !lastReading) return "";
    const numValue = parseNumber(value);
    if (numValue === null) return "";
    const prevValue = Number(lastReading[field]) || 0;
    if (numValue < prevValue) {
      const fieldLabels = {
        activeEnergy: "Актив энергия",
        reactiveEnergy: "Реактив энергия",
        eco: "ЭКО",
      };
      return `${fieldLabels[field]} олдинги кўрсаткичдан (${prevValue}) кам бўлиши мумкин эмас`;
    }
    return "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (["activeEnergy", "reactiveEnergy", "eco"].includes(name)) {
      const normalized = normalizeNumberInput(value);
      setFormData((prev) => ({ ...prev, [name]: normalized }));
      const error = validateNotLessThanPrevious(name, normalized);
      setValidationErrors((prev) => ({ ...prev, [name]: error }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = {
      activeEnergy: validateNotLessThanPrevious(
        "activeEnergy",
        formData.activeEnergy
      ),
      reactiveEnergy: validateNotLessThanPrevious(
        "reactiveEnergy",
        formData.reactiveEnergy
      ),
      eco: validateNotLessThanPrevious("eco", formData.eco),
    };
    setValidationErrors(errors);

    if (errors.activeEnergy) return alert(errors.activeEnergy);
    if (errors.reactiveEnergy) return alert(errors.reactiveEnergy);
    if (errors.eco) return alert(errors.eco);

    const activeNum = parseNumber(formData.activeEnergy);
    if (activeNum === null) return alert("Введите активную энергию");

    setLoading(true);
    try {
      const q = query(
        collection(db, "electricReadings"),
        where("meterId", "==", meter.id),
        where("readingDate", "==", formData.readingDate)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        alert("Показание за эту дату уже существует");
        setLoading(false);
        return;
      }

      await addDoc(collection(db, "electricReadings"), {
        meterId: meter.id,
        stationId: meter.stationId,
        readingDate: formData.readingDate,
        activeEnergy: parseNumber(formData.activeEnergy) || 0,
        reactiveEnergy: parseNumber(formData.reactiveEnergy) || 0,
        eco: parseNumber(formData.eco) || 0,
        createdAt: serverTimestamp(),
      });

      onSaved();
    } catch (err) {
      alert("Ошибка сохранения: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      {/* 🔥 Модалка: max-h-[95vh], flex-col, скролл внутри */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[95vh] flex flex-col overflow-hidden">
        {/* Заголовок — фиксированный */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 sm:p-5 flex-shrink-0">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-white leading-tight">
                Янги кўрсаткични киритиш
              </h2>
              <p className="text-green-100 text-xs sm:text-sm mt-0.5 truncate">
                {meter?.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {loadingLastDate ? (
          <div className="p-10 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
            <p className="text-sm text-gray-500 mt-3">
              Охирги кўрсаткич текширилмоқда...
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col flex-1 overflow-hidden"
          >
            {/* 🔥 Скроллируемая часть */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 sm:space-y-4">
              {!isFirstEntry && lastReading && (
                <div className="p-2.5 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0">ℹ️</span>
                    <div className="min-w-0">
                      <div className="font-semibold mb-1">
                        Охирги кўрсаткич (
                        {formatDateDisplay(lastReading.readingDate)}):
                      </div>
                      <div className="space-y-0.5">
                        <div>
                          Актив:{" "}
                          <strong>
                            {Number(lastReading.activeEnergy).toFixed(5)}
                          </strong>
                        </div>
                        <div>
                          Реактив:{" "}
                          <strong>
                            {Number(lastReading.reactiveEnergy).toFixed(5)}
                          </strong>
                        </div>
                        <div>
                          ЭКО:{" "}
                          <strong>{Number(lastReading.eco).toFixed(5)}</strong>
                        </div>
                      </div>
                      <div className="mt-1.5 text-blue-700">
                        ⚠️ Янги кўрсаткичлар охиргидан{" "}
                        <strong>кам бўлмаслиги</strong> керак
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isFirstEntry && (
                <div className="p-2.5 sm:p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0">📌</span>
                    <div>
                      Бу ҳисоблагич учун <strong>биринчи кўрсаткич</strong>.
                      Санани қўлда киритишингиз мумкин
                    </div>
                  </div>
                </div>
              )}

              {/* Дата */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Сана *{" "}
                  {!isFirstEntry && (
                    <span className="text-xs text-gray-500">(автоматик)</span>
                  )}
                </label>
                <input
                  type="date"
                  name="readingDate"
                  value={formData.readingDate}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg font-mono text-sm ${
                    !isFirstEntry
                      ? "bg-gray-100 text-gray-600 cursor-not-allowed border-gray-300"
                      : "border-gray-300 focus:ring-2 focus:ring-green-500"
                  }`}
                  readOnly={!isFirstEntry}
                  disabled={!isFirstEntry}
                  required
                />
                {!isFirstEntry && (
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                    🔒 Сана ўзгартирилмайди (+1 кун автоматик)
                  </p>
                )}
              </div>

              {/* Актив энергия */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Актив энергия (кВт·ч) *
                  {!isFirstEntry && lastReading && (
                    <span className="text-xs text-gray-500 ml-1">
                      (мин: {Number(lastReading.activeEnergy).toFixed(5)})
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="activeEnergy"
                  value={formData.activeEnergy}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 font-mono text-sm ${
                    validationErrors.activeEnergy
                      ? "border-red-400 focus:ring-red-500 bg-red-50"
                      : "border-gray-300 focus:ring-green-500"
                  }`}
                  placeholder="0.00000"
                  required
                />
                {validationErrors.activeEnergy && (
                  <p className="text-xs text-red-600 mt-1">
                    ⚠️ {validationErrors.activeEnergy}
                  </p>
                )}
              </div>

              {/* Реактив энергия */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Реактив энергия
                  {!isFirstEntry && lastReading && (
                    <span className="text-xs text-gray-500 ml-1">
                      (мин: {Number(lastReading.reactiveEnergy).toFixed(5)})
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="reactiveEnergy"
                  value={formData.reactiveEnergy}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 font-mono text-sm ${
                    validationErrors.reactiveEnergy
                      ? "border-red-400 focus:ring-red-500 bg-red-50"
                      : "border-gray-300 focus:ring-green-500"
                  }`}
                  placeholder="0.00000"
                />
                {validationErrors.reactiveEnergy && (
                  <p className="text-xs text-red-600 mt-1">
                    ⚠️ {validationErrors.reactiveEnergy}
                  </p>
                )}
              </div>

              {/* ЭКО */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  ЭКО
                  {!isFirstEntry && lastReading && (
                    <span className="text-xs text-gray-500 ml-1">
                      (мин: {Number(lastReading.eco).toFixed(5)})
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="eco"
                  value={formData.eco}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 font-mono text-sm ${
                    validationErrors.eco
                      ? "border-red-400 focus:ring-red-500 bg-red-50"
                      : "border-gray-300 focus:ring-green-500"
                  }`}
                  placeholder="0.00000"
                />
                {validationErrors.eco && (
                  <p className="text-xs text-red-600 mt-1">
                    ⚠️ {validationErrors.eco}
                  </p>
                )}
              </div>
            </div>

            {/* 🔥 Кнопки — фиксированные снизу */}
            <div className="flex gap-2 sm:gap-3 p-3 sm:p-4 border-t bg-gray-50 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {loading ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

function formatDateDisplay(dateStr) {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  return `${day}.${month}.${year}`;
}

export default AddElectricReadingModal;
