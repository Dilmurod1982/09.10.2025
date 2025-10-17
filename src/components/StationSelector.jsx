import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";

const StationSelector = ({ onSelect }) => {
  const { userData } = useAppStore(); // данные текущего пользователя
  const [stations, setStations] = useState([]);
  const [selectedStationId, setSelectedStationId] = useState("");

  useEffect(() => {
    const fetchStations = async () => {
      if (!userData?.stations || userData.stations.length === 0) return;

      try {
        const querySnapshot = await getDocs(collection(db, "stations"));
        const matchedStations = [];

        querySnapshot.forEach((doc) => {
          if (userData.stations.includes(doc.id)) {
            matchedStations.push({ id: doc.id, ...doc.data() });
          }
        });

        setStations(matchedStations);
      } catch (error) {
        console.error("Ошибка при загрузке станций:", error);
      }
    };

    fetchStations();
  }, [userData]);

  const handleSelect = (e) => {
    const stationId = e.target.value;
    setSelectedStationId(stationId);
    const selected = stations.find((s) => s.id === stationId);
    onSelect(selected || null);
  };

  return (
    <div className="mb-6">
      <label className="block font-semibold mb-2">Выберите станцию:</label>
      <select
        className="select select-bordered w-full max-w-md"
        value={selectedStationId}
        onChange={handleSelect}>
        <option value="">-- Выберите станцию --</option>
        {stations.map((station) => (
          <option key={station.id} value={station.id}>
            {station.stationName || "Без названия"}
          </option>
        ))}
      </select>
    </div>
  );
};

export default StationSelector;
