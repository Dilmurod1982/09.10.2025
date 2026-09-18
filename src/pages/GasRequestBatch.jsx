import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { Eye, Printer } from "lucide-react";

export default function GasRequestBatch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const q = query(
        collection(db, "gasRequests"),
        where("batchId", "==", id)
      );
      const snap = await getDocs(q);
      setLetters(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-6">Юкланмоқда...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">
          Талабномалар партияси ({letters.length} та хат)
        </h1>
        <button
          onClick={() => navigate("/gas-requests")}
          className="px-4 py-2 border rounded-xl"
        >
          ← Орқага
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">№</th>
              <th className="px-4 py-3 text-left">ООО</th>
              <th className="px-4 py-3 text-left">Станциялар</th>
              <th className="px-4 py-3 text-left">Жами лимит</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {letters.map((l, idx) => (
              <tr key={l.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">{idx + 1}</td>
                <td className="px-4 py-3 font-medium">
                  {l.organizationName} mas'uliyati cheklangan jamiyati
                </td>
                <td className="px-4 py-3">{l.stations.length} та</td>
                <td className="px-4 py-3">
                  {l.totalLimit.toLocaleString("ru-RU")} м³
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => navigate(`/gas-request/${l.id}`)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
