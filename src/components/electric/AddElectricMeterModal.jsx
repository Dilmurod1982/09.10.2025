import React, { useState } from "react";
import { db } from "../../firebase/config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const AddElectricMeterModal = ({ onClose, stationId, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    consumerAccount: "",
    contractNumber: "",
    contractDate: "",
    tariffGroup: "",
    meterSerialNumber: "",
    coefficient: "0.00000",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !formData.name ||
      !formData.consumerAccount ||
      !formData.contractNumber ||
      !formData.contractDate
    ) {
      alert("Заполните обязательные поля");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "electricMeters"), {
        stationId: String(stationId),
        name: formData.name.trim(),
        consumerAccount: formData.consumerAccount.trim(),
        contractNumber: formData.contractNumber.trim(),
        contractDate: formData.contractDate,
        tariffGroup: formData.tariffGroup.trim(),
        meterSerialNumber: formData.meterSerialNumber.trim(),
        coefficient: parseFloat(formData.coefficient) || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onSaved();
    } catch (err) {
      alert("Ошибка сохранения: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">
              Янги ҳисоблагич қўшиш
            </h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Номи *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Истеъмолчи ҳисоб рақами *
              </label>
              <input
                type="text"
                name="consumerAccount"
                value={formData.consumerAccount}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Шартнома рақами *
              </label>
              <input
                type="text"
                name="contractNumber"
                value={formData.contractNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Шартнома санаси *
              </label>
              <input
                type="date"
                name="contractDate"
                value={formData.contractDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тариф гуруҳи
              </label>
              <input
                type="text"
                name="tariffGroup"
                value={formData.tariffGroup}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ҳисоблагич завод рақами
              </label>
              <input
                type="text"
                name="meterSerialNumber"
                value={formData.meterSerialNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Коэффициент
              </label>
              <input
                type="text"
                name="coefficient"
                value={formData.coefficient}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="0.00000"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddElectricMeterModal;
