import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

const StationsSelection = ({ selectedStations, onStationsChange, onClose }) => {
  const [stations, setStations] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    try {
      const stationsCollection = collection(db, "stations");
      const stationsSnapshot = await getDocs(stationsCollection);
      const stationsList = stationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setStations(stationsList);
    } catch (error) {
      console.error("Error fetching stations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStationToggle = (stationId) => {
    const newSelectedStations = selectedStations.includes(stationId)
      ? selectedStations.filter((id) => id !== stationId)
      : [...selectedStations, stationId];

    onStationsChange(newSelectedStations);
  };

  // Функция для получения полного адреса из объекта address
  const getFullAddress = (address) => {
    if (!address) return "";

    const parts = [];
    if (address.regionName) parts.push(address.regionName);
    if (address.cityName) parts.push(address.cityName);
    if (address.street) parts.push(address.street);
    if (address.house) parts.push(`дом ${address.house}`);

    return parts.join(", ");
  };

  // Функция для получения названия станции
  const getStationName = (station) => {
    // Используем msc как название станции, если оно есть
    if (station.msc) return station.msc;

    // Или создаем название из адреса
    if (station.address) {
      const address = getFullAddress(station.address);
      return address || `Станция ${station.id.substring(0, 8)}`;
    }

    return `Станция ${station.id.substring(0, 8)}`;
  };

  const filteredStations = stations.filter((station) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();

    // Поиск по названию станции
    const stationName = getStationName(station).toLowerCase();
    if (stationName.includes(searchLower)) return true;

    // Поиск по адресу
    const address = getFullAddress(station.address).toLowerCase();
    if (address.includes(searchLower)) return true;

    // Поиск по номеру телефона
    if (station.phone && station.phone.toLowerCase().includes(searchLower))
      return true;

    // Поиск по городу
    if (
      station.address?.cityName &&
      station.address.cityName.toLowerCase().includes(searchLower)
    )
      return true;

    // Поиск по региону
    if (
      station.address?.regionName &&
      station.address.regionName.toLowerCase().includes(searchLower)
    )
      return true;

    return false;
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Выбор станций</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-light w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">
            ×
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Поиск станций по названию, адресу или городу..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStations.map((station) => (
                <div
                  key={station.id}
                  className="flex items-start p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200">
                  <input
                    type="checkbox"
                    checked={selectedStations.includes(station.id)}
                    onChange={() => handleStationToggle(station.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                  />
                  <div className="ml-3 flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {getStationName(station)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {getFullAddress(station.address)}
                    </div>
                    {station.phone && (
                      <div className="text-xs text-gray-400 mt-1">
                        📞 {station.phone}
                      </div>
                    )}
                    {/* Дополнительная информация о станции */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {station.chillers && station.chillers.length > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          ❄️ {station.chillers.length}
                        </span>
                      )}
                      {station.compressors &&
                        station.compressors.length > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                            ⚙️ {station.compressors.length}
                          </span>
                        )}
                      {station.dispensers && station.dispensers.length > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                          ⛽ {station.dispensers.length}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filteredStations.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  {searchTerm
                    ? "Станции не найдены"
                    : "Станции не найдены в базе данных"}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Выбрано: {selectedStations.length}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};

export default StationsSelection;
