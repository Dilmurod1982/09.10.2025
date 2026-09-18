import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { collection, getDocs, addDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { toast } from "react-toastify";
import { Plus, FileText, Eye, Building, Calendar, X } from "lucide-react";

const MONTHS = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

export default function GasRequests() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [gasOrgs, setGasOrgs] = useState([]);
  const [directors, setDirectors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    gasOrganizationId: "",
    letterDate: "",
    letterNumber: "",
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [reqSnap, orgSnap, dirSnap] = await Promise.all([
        getDocs(collection(db, "gasRequests")),
        getDocs(collection(db, "gasOrganizations")),
        getDocs(collection(db, "gasOrgDirectors")),
      ]);

      const reqs = reqSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );

      setRequests(reqs);
      setGasOrgs(orgSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setDirectors(dirSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      toast.error("Маълумотларни юклашда хатолик");
    } finally {
      setLoading(false);
    }
  };

  const groupedByBatch = React.useMemo(() => {
    const map = {};
    requests.forEach((r) => {
      const key = r.batchId || r.id;
      if (!map[key]) {
        map[key] = {
          batchId: key,
          year: r.year,
          month: r.month,
          period: r.period,
          letterDate: r.letterDate,
          letterNumber: r.letterNumber,
          gasOrganizationName: r.gasOrganizationName,
          gasDirectorName: r.gasDirectorName,
          createdAt: r.createdAt,
          letters: [],
          totalLimit: 0,
        };
      }
      map[key].letters.push(r);
      map[key].totalLimit += r.totalLimit || 0;
    });

    return Object.values(map).sort(
      (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    );
  }, [requests]);

  const normalizePeriod = (p) => {
    if (!p) return "";
    const m = String(p).match(/^(\d{4})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
    return String(p);
  };

  const handleCreate = async () => {
    if (!form.gasOrganizationId) {
      toast.error("Газ ташкилотини танланг");
      return;
    }
    if (!form.letterDate || !form.letterNumber) {
      toast.error("Хат санаси ва рақамини киритинг");
      return;
    }

    setCreating(true);
    try {
      const period = `${form.year}-${String(form.month).padStart(2, "0")}`;
      const targetPeriod = normalizePeriod(period);

      const activeDirector = directors.find(
        (d) =>
          d.gasOrganizationId === form.gasOrganizationId &&
          (!d.endDate || new Date(d.endDate) > new Date())
      );
      if (!activeDirector) {
        toast.error("Бу газ ташкилоти учун фаол рахбар топилмади");
        setCreating(false);
        return;
      }

      const [orgsSnap, stationsSnap, mainSnap] = await Promise.all([
        getDocs(collection(db, "organizations")),
        getDocs(collection(db, "stations")),
        getDoc(doc(db, "gasSettlements", "main")),
      ]);

      const allOrgs = orgsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const allStations = stationsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const mainDoc = mainSnap.exists() ? mainSnap.data() : {};
      const mainData = mainDoc.mainData || [];
      const dataArr = mainDoc.data || [];

      console.log("📊 ДИАГНОСТИКА:", {
        organizations: allOrgs.length,
        stations: allStations.length,
        mainData: mainData.length,
        data: dataArr.length,
        targetPeriod,
        dataForPeriod: dataArr.filter(
          (d) => normalizePeriod(d.period) === targetPeriod
        ).length,
      });

      const gasOrgName =
        gasOrgs.find((o) => o.id === form.gasOrganizationId)?.name || "";
      const gasDirectorName = `${activeDirector.lastName} ${
        activeDirector.firstName
      } ${activeDirector.middleName || ""}`.trim();

      const batchRef = await addDoc(collection(db, "gasRequestBatches"), {
        year: Number(form.year),
        month: Number(form.month),
        period,
        letterDate: form.letterDate,
        letterNumber: form.letterNumber,
        gasOrganizationId: form.gasOrganizationId,
        gasOrganizationName: gasOrgName,
        gasDirectorId: activeDirector.id,
        gasDirectorName,
        createdAt: new Date(),
      });

      const lettersPayload = [];

      for (const org of allOrgs) {
        const orgStations = allStations
          .filter((s) => s.organizationId === org.id)
          .map((station) => {
            const mainItem = mainData.find(
              (m) => String(m.stationId) === String(station.id)
            );

            let limit = 0;
            if (mainItem) {
              const dataItem = dataArr.find(
                (d) =>
                  normalizePeriod(d.period) === targetPeriod &&
                  String(d.stationId) === String(mainItem.id)
              );
              limit = Number(dataItem?.limit) || 0;
            }

            return {
              stationId: station.id,
              mainDataId: mainItem?.id || "",
              stationNumber: station.stationNumber || "",
              stationName: station.stationName || "",
              landmark: mainItem?.landmark || "",
              limit,
            };
          });

        if (orgStations.length === 0) continue;

        orgStations.sort(
          (a, b) =>
            (parseInt(a.stationNumber) || 0) - (parseInt(b.stationNumber) || 0)
        );

        lettersPayload.push({
          batchId: batchRef.id,
          year: Number(form.year),
          month: Number(form.month),
          period,
          letterDate: form.letterDate,
          letterNumber: form.letterNumber,

          gasOrganizationId: form.gasOrganizationId,
          gasOrganizationName: gasOrgName,
          gasDirectorId: activeDirector.id,
          gasDirectorName,

          organizationId: org.id,
          organizationName: org.name,
          organizationNameCyr: `Общество с ограниченной ответственностью "${org.name}"`,
          organizationDirectorName: org.directorName || "",
          organizationCity: org.city || "",
          organizationRegion: org.region || "",

          stations: orgStations,
          totalLimit: orgStations.reduce((s, x) => s + x.limit, 0),

          createdAt: new Date(),
        });
      }

      if (lettersPayload.length === 0) {
        toast.error("Ҳеч қандай ООО да станция топилмади");
        setCreating(false);
        return;
      }

      for (const letter of lettersPayload) {
        await addDoc(collection(db, "gasRequests"), letter);
      }

      const totalLimit = lettersPayload.reduce((s, l) => s + l.totalLimit, 0);
      toast.success(
        `${
          lettersPayload.length
        } та хат яратилди (жами: ${totalLimit.toLocaleString("ru-RU")} м³)`
      );

      setCreateModalOpen(false);
      setForm({
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        gasOrganizationId: "",
        letterDate: "",
        letterNumber: "",
      });

      navigate(`/gas-requests/batch/${batchRef.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Яратишда хатолик: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            Талабномалар
          </h1>
          <p className="text-gray-600">Газ таъминоти учун ойлик талабномалар</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <button
            onClick={() => navigate("/gas-organizations")}
            className="px-5 py-2.5 bg-gray-700 text-white rounded-xl hover:bg-gray-800 transition-colors flex items-center gap-2 justify-center"
          >
            <Building size={18} />
            Газ ташкилотлари
          </button>

          <button
            onClick={() => {
              setForm({
                year: new Date().getFullYear(),
                month: new Date().getMonth() + 1,
                gasOrganizationId: "",
                letterDate: "",
                letterNumber: "",
              });
              setCreateModalOpen(true);
            }}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 justify-center shadow-md"
          >
            <Plus size={18} />
            Янги талабнома яратиш
          </button>
        </div>
      </div>

      {groupedByBatch.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-md p-12 text-center">
          <FileText className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Талабномалар мавжуд эмас
          </h3>
          <p className="text-gray-500 mb-4">
            Биринчи талабномани яратишдан бошланг
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700"
          >
            Янги талабнома яратиш
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <th className="px-4 py-3 text-left font-semibold">№</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Хат санаси
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Хат рақами
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Давр</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Газ ташкилоти
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    ООО сони
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Жами лимит
                  </th>
                  <th className="px-4 py-3 text-left font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupedByBatch.map((batch, idx) => (
                  <tr
                    key={batch.batchId}
                    className="hover:bg-blue-50 transition-colors"
                  >
                    <td className="px-4 py-3">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium">
                      {batch.letterDate}
                    </td>
                    <td className="px-4 py-3">{batch.letterNumber}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-blue-600" />
                        <span>
                          {batch.year} — {MONTHS[batch.month - 1]}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{batch.gasOrganizationName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {batch.letters.length} та
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {batch.totalLimit.toLocaleString("ru-RU")} м³
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          navigate(`/gas-requests/batch/${batch.batchId}`)
                        }
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-1.5"
                      >
                        <Eye size={14} />
                        Кўриш
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {createModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !creating && setCreateModalOpen(false)}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 flex justify-between items-center">
                <h2 className="text-xl font-bold">Янги талабнома яратиш</h2>
                <button
                  onClick={() => !creating && setCreateModalOpen(false)}
                  disabled={creating}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Йил *
                    </label>
                    <select
                      value={form.year}
                      onChange={(e) =>
                        setForm({ ...form, year: e.target.value })
                      }
                      disabled={creating}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    >
                      {[2024, 2025, 2026, 2027, 2028].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ой *
                    </label>
                    <select
                      value={form.month}
                      onChange={(e) =>
                        setForm({ ...form, month: e.target.value })
                      }
                      disabled={creating}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    >
                      {MONTHS.map((m, i) => (
                        <option key={i + 1} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Газ ташкилоти *
                  </label>
                  <select
                    value={form.gasOrganizationId}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        gasOrganizationId: e.target.value,
                      })
                    }
                    disabled={creating}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">Танланг</option>
                    {gasOrgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  {gasOrgs.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Аввал газ ташкилотини қўшинг
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Хат санаси *
                    </label>
                    <input
                      type="date"
                      value={form.letterDate}
                      onChange={(e) =>
                        setForm({ ...form, letterDate: e.target.value })
                      }
                      disabled={creating}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Хат рақами *
                    </label>
                    <input
                      type="text"
                      value={form.letterNumber}
                      onChange={(e) =>
                        setForm({ ...form, letterNumber: e.target.value })
                      }
                      placeholder="08-26"
                      disabled={creating}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
                  <p className="font-medium mb-1">ℹ️ Маълумот</p>
                  <p className="text-xs">
                    Танланган давр учун <b>ҳар бир ООО га алоҳида хат</b>{" "}
                    яратилади. Барча станциялар автоматик равишда қўшилади ва
                    лимитлар <code>gasSettlements/main</code> дан олинади.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t flex gap-3 justify-end">
                <button
                  onClick={() => setCreateModalOpen(false)}
                  disabled={creating}
                  className="px-5 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Бекор
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                      Яратилмоқда...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Яратиш
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
