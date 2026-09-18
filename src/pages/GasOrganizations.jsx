import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { toast } from "react-toastify";
import { Plus, X, Edit, Save, Building, User, Calendar } from "lucide-react";

export default function GasOrganizations() {
  const [gasOrgs, setGasOrgs] = useState([]);
  const [directors, setDirectors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [directorModalOpen, setDirectorModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [editingDirector, setEditingDirector] = useState(null);

  const [orgForm, setOrgForm] = useState({
    name: "",
    nameCyrillic: "",
    address: "",
    startDate: "",
    endDate: "",
  });
  const [directorForm, setDirectorForm] = useState({
    gasOrganizationId: "",
    lastName: "",
    firstName: "",
    middleName: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [orgsSnap, dirsSnap] = await Promise.all([
        getDocs(collection(db, "gasOrganizations")),
        getDocs(collection(db, "gasOrgDirectors")),
      ]);
      setGasOrgs(orgsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setDirectors(dirsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      toast.error("Юклашда хатолик");
    } finally {
      setLoading(false);
    }
  };

  // ---------- СОХРАНЕНИЕ ГАЗОВОГО ХОЗЯЙСТВА ----------
  const saveOrg = async () => {
    if (!orgForm.name.trim() || !orgForm.startDate) {
      toast.error("Ном ва бошланиш санасини киритинг");
      return;
    }
    try {
      if (editingOrg) {
        await updateDoc(doc(db, "gasOrganizations", editingOrg.id), {
          ...orgForm,
          updatedAt: new Date(),
        });
        toast.success("Янгиланди");
      } else {
        await addDoc(collection(db, "gasOrganizations"), {
          ...orgForm,
          createdAt: new Date(),
        });
        toast.success("Қўшилди");
      }
      setOrgModalOpen(false);
      setEditingOrg(null);
      setOrgForm({
        name: "",
        nameCyrillic: "",
        address: "",
        startDate: "",
        endDate: "",
      });
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Сақлашда хатолик");
    }
  };

  // ---------- СОХРАНЕНИЕ РУКОВОДИТЕЛЯ ----------
  const saveDirector = async () => {
    if (
      !directorForm.gasOrganizationId ||
      !directorForm.lastName ||
      !directorForm.firstName ||
      !directorForm.startDate
    ) {
      toast.error("Барча мажбурий майдонларни тўлдиринг");
      return;
    }
    try {
      if (editingDirector) {
        await updateDoc(doc(db, "gasOrgDirectors", editingDirector.id), {
          ...directorForm,
          updatedAt: new Date(),
        });
        toast.success("Янгиланди");
      } else {
        await addDoc(collection(db, "gasOrgDirectors"), {
          ...directorForm,
          createdAt: new Date(),
        });
        toast.success("Қўшилди");
      }
      setDirectorModalOpen(false);
      setEditingDirector(null);
      setDirectorForm({
        gasOrganizationId: "",
        lastName: "",
        firstName: "",
        middleName: "",
        startDate: "",
        endDate: "",
      });
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Сақлашда хатолик");
    }
  };

  if (loading) return <div className="p-6">Юкланмоқда...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Газ ташкилотлари</h1>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => {
            setEditingOrg(null);
            setOrgForm({
              name: "",
              nameCyrillic: "",
              address: "",
              startDate: "",
              endDate: "",
            });
            setOrgModalOpen(true);
          }}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2"
        >
          <Plus size={18} /> Газ ташкилотини номини қўшиш
        </button>

        <button
          onClick={() => {
            setEditingDirector(null);
            setDirectorForm({
              gasOrganizationId: "",
              lastName: "",
              firstName: "",
              middleName: "",
              startDate: "",
              endDate: "",
            });
            setDirectorModalOpen(true);
          }}
          className="bg-green-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2"
        >
          <Plus size={18} /> Газ ташкилотини рахбарини қўшиш
        </button>
      </div>

      {/* Таблица газовых хозяйств */}
      <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-8">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">Номи (lotin)</th>
              <th className="px-4 py-3 text-left">Номи (кирилл)</th>
              <th className="px-4 py-3 text-left">Манзил</th>
              <th className="px-4 py-3 text-left">Амал даври</th>
              <th className="px-4 py-3 text-left">Рахбар</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {gasOrgs.map((org) => {
              const orgDirectors = directors.filter(
                (d) => d.gasOrganizationId === org.id
              );
              const active = orgDirectors.find(
                (d) => !d.endDate || new Date(d.endDate) > new Date()
              );
              return (
                <tr key={org.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{org.name}</td>
                  <td className="px-4 py-3">{org.nameCyrillic}</td>
                  <td className="px-4 py-3">{org.address}</td>
                  <td className="px-4 py-3 text-sm">
                    {org.startDate} — {org.endDate || "..."}
                  </td>
                  <td className="px-4 py-3">
                    {active ? (
                      `${active.lastName} ${active.firstName} ${active.middleName}`
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setEditingOrg(org);
                        setOrgForm({
                          name: org.name || "",
                          nameCyrillic: org.nameCyrillic || "",
                          address: org.address || "",
                          startDate: org.startDate || "",
                          endDate: org.endDate || "",
                        });
                        setOrgModalOpen(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Список руководителей */}
      <h2 className="text-xl font-bold mb-3">Рахбарлар</h2>
      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">ФИШ</th>
              <th className="px-4 py-3 text-left">Газ ташкилоти</th>
              <th className="px-4 py-3 text-left">Амал даври</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {directors.map((d) => {
              const org = gasOrgs.find((o) => o.id === d.gasOrganizationId);
              return (
                <tr key={d.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {d.lastName} {d.firstName} {d.middleName}
                  </td>
                  <td className="px-4 py-3">{org?.name}</td>
                  <td className="px-4 py-3 text-sm">
                    {d.startDate} — {d.endDate || "..."}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setEditingDirector(d);
                        setDirectorForm({ ...d });
                        setDirectorModalOpen(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* МОДАЛКА: газовое хозяйство */}
      <AnimatePresence>
        {orgModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {editingOrg
                    ? "Газ ташкилотини таҳрирлаш"
                    : "Газ ташкилотини қўшиш"}
                </h2>
                <button onClick={() => setOrgModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Номи (лотin) *</label>
                  <input
                    type="text"
                    value={orgForm.name}
                    onChange={(e) =>
                      setOrgForm({ ...orgForm, name: e.target.value })
                    }
                    placeholder='"Ҳудудгаз Фарғона" газ таъминоти филиали'
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Номи (кирилл)</label>
                  <input
                    type="text"
                    value={orgForm.nameCyrillic}
                    onChange={(e) =>
                      setOrgForm({ ...orgForm, nameCyrillic: e.target.value })
                    }
                    placeholder='Фарганский филиал по газоснабжению "Худудгаз"'
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Манзил</label>
                  <input
                    type="text"
                    value={orgForm.address}
                    onChange={(e) =>
                      setOrgForm({ ...orgForm, address: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Бошланиш *</label>
                    <input
                      type="date"
                      value={orgForm.startDate}
                      onChange={(e) =>
                        setOrgForm({ ...orgForm, startDate: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Тугаш</label>
                    <input
                      type="date"
                      value={orgForm.endDate}
                      onChange={(e) =>
                        setOrgForm({ ...orgForm, endDate: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setOrgModalOpen(false)}
                  className="flex-1 px-4 py-2 border rounded-xl"
                >
                  Бекор
                </button>
                <button
                  onClick={saveOrg}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl"
                >
                  Сақлаш
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* МОДАЛКА: руководитель */}
      <AnimatePresence>
        {directorModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {editingDirector ? "Рахбарни таҳрирлаш" : "Рахбарни қўшиш"}
                </h2>
                <button onClick={() => setDirectorModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Газ ташкилоти *</label>
                  <select
                    value={directorForm.gasOrganizationId}
                    onChange={(e) =>
                      setDirectorForm({
                        ...directorForm,
                        gasOrganizationId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Танланг</option>
                    {gasOrgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-sm font-medium">Фамилияси *</label>
                    <input
                      type="text"
                      value={directorForm.lastName}
                      onChange={(e) =>
                        setDirectorForm({
                          ...directorForm,
                          lastName: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Исми *</label>
                    <input
                      type="text"
                      value={directorForm.firstName}
                      onChange={(e) =>
                        setDirectorForm({
                          ...directorForm,
                          firstName: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Отчестваси</label>
                    <input
                      type="text"
                      value={directorForm.middleName}
                      onChange={(e) =>
                        setDirectorForm({
                          ...directorForm,
                          middleName: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">
                      Иш бошланиши *
                    </label>
                    <input
                      type="date"
                      value={directorForm.startDate}
                      onChange={(e) =>
                        setDirectorForm({
                          ...directorForm,
                          startDate: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Иш тугаши</label>
                    <input
                      type="date"
                      value={directorForm.endDate}
                      onChange={(e) =>
                        setDirectorForm({
                          ...directorForm,
                          endDate: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setDirectorModalOpen(false)}
                  className="flex-1 px-4 py-2 border rounded-xl"
                >
                  Бекор
                </button>
                <button
                  onClick={saveDirector}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl"
                >
                  Сақлаш
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
