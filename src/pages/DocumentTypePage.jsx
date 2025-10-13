import React, { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
} from "@mui/material";
import { motion } from "framer-motion";
import { Plus, Edit, X } from "lucide-react";

const DocumentTypePage = () => {
  const [docTypes, setDocTypes] = useState([]);
  const [openView, setOpenView] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [current, setCurrent] = useState(null);
  const [editable, setEditable] = useState(false);
  const [newType, setNewType] = useState({
    id: "",
    name: "",
    path: "",
    color: "#16a34a",
    validity: "",
  });

  // 🔥 Реальное обновление данных из Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "document_types"), (snapshot) => {
      setDocTypes(
        snapshot.docs.map((d) => ({
          firebaseId: d.id, // <-- реальный Firestore ID
          ...d.data(),
        }))
      );
    });
    return () => unsub();
  }, []);

  // 🟢 Открыть модал просмотра
  const handleOpenView = (type) => {
    setCurrent({ ...type });
    setEditable(false);
    setOpenView(true);
  };

  const handleCloseView = () => {
    setOpenView(false);
    setCurrent(null);
  };

  // 🟢 Открыть модал добавления
  const handleOpenCreate = () => {
    setNewType({
      id: "",
      name: "",
      path: "",
      color: "#16a34a",
      validity: "",
    });
    setOpenCreate(true);
  };

  const handleCloseCreate = () => {
    setOpenCreate(false);
  };

  // 💾 Сохранить новый тип
  const handleSaveCreate = async () => {
    try {
      // создаём документ с ID равным полю id
      await setDoc(doc(db, "document_types", newType.id), newType);
      setOpenCreate(false);
    } catch (e) {
      console.error("Ошибка при создании типа:", e);
    }
  };

  // ✏️ Сохранить изменения типа
  const handleSaveEdit = async () => {
    try {
      // обновляем документ по реальному Firestore ID
      await updateDoc(doc(db, "document_types", current.firebaseId), {
        name: current.name,
        path: current.path,
        color: current.color,
        validity: current.validity,
      });
      setEditable(false);
      setOpenView(false);
    } catch (e) {
      console.error("Ошибка при обновлении типа:", e);
    }
  };

  const isCreateDisabled =
    !newType.id ||
    !newType.name ||
    !newType.path ||
    !newType.color ||
    !newType.validity;

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold text-gray-800">
          Типы документов
        </h1>
        <Tooltip title="Добавить новый тип">
          <Button
            variant="contained"
            color="error"
            startIcon={<Plus />}
            onClick={handleOpenCreate}
            sx={{
              textTransform: "none",
              fontSize: "16px",
              fontWeight: 500,
              borderRadius: "12px",
              px: 3,
              py: 1,
            }}>
            Добавить тип
          </Button>
        </Tooltip>
      </div>

      {/* Таблица */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white shadow-md rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-3 px-4">ID</th>
              <th className="py-3 px-4">Название</th>
              <th className="py-3 px-4">Путь</th>
              <th className="py-3 px-4">Цвет</th>
              <th className="py-3 px-4">Срок действия</th>
            </tr>
          </thead>
          <tbody>
            {docTypes.map((type) => (
              <tr
                key={type.firebaseId}
                className="hover:bg-gray-50 cursor-pointer transition-all"
                onClick={() => handleOpenView(type)}>
                <td className="py-3 px-4">{type.id}</td>
                <td className="py-3 px-4">{type.name}</td>
                <td className="py-3 px-4">{type.path}</td>
                <td className="py-3 px-4">
                  <div
                    className="w-6 h-6 rounded-full border"
                    style={{ backgroundColor: type.color }}
                  />
                </td>
                <td className="py-3 px-4">
                  {type.validity === "infinity" ? "Бессрочная" : "Со сроком"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* 🪟 Модал просмотра / редактирования */}
      <Dialog
        open={openView}
        onClose={handleCloseView}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          className: "rounded-2xl",
        }}>
        <DialogTitle
          component="div"
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
          <span className="text-xl font-semibold text-gray-800">
            {editable ? "Редактировать тип" : current?.name}
          </span>
          <IconButton onClick={handleCloseView}>
            <X />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {current && (
            <div className="flex flex-col gap-4 mt-2">
              <TextField label="ID" value={current.id} disabled fullWidth />
              <TextField
                label="Название"
                value={current.name}
                onChange={(e) =>
                  setCurrent({ ...current, name: e.target.value })
                }
                disabled={!editable}
                fullWidth
              />
              <TextField
                label="Путь"
                value={current.path}
                onChange={(e) =>
                  setCurrent({ ...current, path: e.target.value })
                }
                disabled={!editable}
                fullWidth
              />
              <div className="flex items-center gap-3">
                <label className="text-gray-700 w-24">Цвет:</label>
                <input
                  type="color"
                  value={current.color || "#cccccc"}
                  disabled={!editable}
                  onChange={(e) =>
                    setCurrent({ ...current, color: e.target.value })
                  }
                  className="w-16 h-10 rounded-lg border"
                />
              </div>
              <TextField
                select
                label="Срок действия"
                value={current.validity || ""}
                onChange={(e) =>
                  setCurrent({ ...current, validity: e.target.value })
                }
                disabled={!editable}
                fullWidth>
                <MenuItem value="infinity">Бессрочная</MenuItem>
                <MenuItem value="expiration">Со сроком</MenuItem>
              </TextField>
            </div>
          )}
        </DialogContent>

        <DialogActions>
          {!editable ? (
            <Button
              variant="contained"
              color="primary"
              startIcon={<Edit />}
              onClick={() => setEditable(true)}>
              Редактировать
            </Button>
          ) : (
            <>
              <Button color="inherit" onClick={() => setEditable(false)}>
                Отмена
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleSaveEdit}>
                Сохранить
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* 🪟 Модал создания */}
      <Dialog
        open={openCreate}
        onClose={handleCloseCreate}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          className: "rounded-2xl",
        }}>
        <DialogTitle
          component="div"
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
          <span className="text-xl font-semibold text-gray-800">
            Создать новый тип документа
          </span>
          <IconButton onClick={handleCloseCreate}>
            <X />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <div className="flex flex-col gap-4 mt-2">
            <TextField
              label="ID"
              value={newType.id}
              onChange={(e) => setNewType({ ...newType, id: e.target.value })}
              fullWidth
            />
            <TextField
              label="Название"
              value={newType.name}
              onChange={(e) => setNewType({ ...newType, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Путь"
              value={newType.path}
              onChange={(e) => setNewType({ ...newType, path: e.target.value })}
              fullWidth
            />
            <div className="flex items-center gap-3">
              <label className="text-gray-700 w-24">Цвет:</label>
              <input
                type="color"
                value={newType.color}
                onChange={(e) =>
                  setNewType({ ...newType, color: e.target.value })
                }
                className="w-16 h-10 rounded-lg border"
              />
            </div>
            <TextField
              select
              label="Срок действия"
              value={newType.validity || ""}
              onChange={(e) =>
                setNewType({ ...newType, validity: e.target.value })
              }
              fullWidth>
              <MenuItem value="infinity">Бессрочная</MenuItem>
              <MenuItem value="expiration">Со сроком</MenuItem>
            </TextField>
          </div>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseCreate}>Отмена</Button>
          <Button
            variant="contained"
            color="success"
            disabled={isCreateDisabled}
            onClick={handleSaveCreate}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default DocumentTypePage;
