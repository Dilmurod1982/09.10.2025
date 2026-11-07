import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { db } from "../firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore";
import AddElectricMeterModal from "../components/electric/AddElectricMeterModal";

const StationElectricMeters = () => {
  const { stationId } = useParams();
  const navigate = useNavigate();

  const [station, setStation] = useState(null);
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);

      // Загружаем станцию
      const mainSnap = await getDoc(doc(db, "gasSettlements", "main"));
      const allStations = mainSnap.data()?.mainData || [];
      const foundStation = allStations.find(
        (s) => String(s.id) === String(stationId)
      );
      setStation(foundStation || null);

      // Загружаем счётчики
      const q = query(
        collection(db, "electricMeters"),
        where("stationId", "==", String(stationId))
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMeters(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [stationId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <button
            onClick={() => navigate("/electric-meters")}
            className="text-sm text-blue-600 hover:text-blue-800 mb-2"
          >
            ← Орқага
          </button>
          <h1 className="text-2xl font-bold text-gray-800">
            {station?.name || `Станция #${stationId}`} — электр ҳисоблагичлари
          </h1>
          <p className="text-gray-500 mt-1">{station?.landmark || "—"}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md transition-all"
        >
          + Янги ҳисоблагич қўшиш
        </button>
      </div>

      {meters.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-12 text-center">
          <div className="text-6xl mb-4">⚡</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            Ҳисоблагичлар йўқ
          </h3>
          <p className="text-gray-500 mb-4">
            Биринчи ҳисоблагични қўшиш учун тугмани босинг
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Ҳисоблагич қўшиш
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Номи</th>
                  <th className="p-3 text-left">Истеъмолчи ҳисоб рақами</th>
                  <th className="p-3 text-left">Шартнома рақами</th>
                  <th className="p-3 text-left">Шартнома санаси</th>
                  <th className="p-3 text-left">Тариф гуруҳи</th>
                  <th className="p-3 text-left">Завод рақами</th>
                  <th className="p-3 text-left">Коэффициент</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {meters.map((m, i) => (
                  <motion.tr
                    key={m.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-blue-50"
                  >
                    <td className="p-3 font-medium">{m.name}</td>
                    <td className="p-3 font-mono">{m.consumerAccount}</td>
                    <td className="p-3">{m.contractNumber}</td>
                    <td className="p-3">
                      {m.contractDate
                        ? new Date(m.contractDate).toLocaleDateString("ru-RU")
                        : "—"}
                    </td>
                    <td className="p-3">{m.tariffGroup || "—"}</td>
                    <td className="p-3">{m.meterSerialNumber || "—"}</td>
                    <td className="p-3 font-mono">
                      {Number(m.coefficient || 0).toFixed(5)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddElectricMeterModal
          stationId={stationId}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default StationElectricMeters;
