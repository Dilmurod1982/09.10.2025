import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import PartnerDetailsModal from "../components/PartnerDetailsModal";

const PartnerStatement = () => {
  const { contractId } = useParams();
  const navigate = useNavigate();

  const [contract, setContract] = useState(null);
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!contractId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const cSnap = await getDoc(doc(db, "contracts", contractId));
        if (!cSnap.exists()) {
          setError("Шартнома топилмади");
          setLoading(false);
          return;
        }
        const c = { id: cSnap.id, ...cSnap.data() };
        setContract(c);

        if (c.partnerId) {
          const pSnap = await getDoc(doc(db, "partners", c.partnerId));
          if (pSnap.exists()) {
            setPartner({ id: pSnap.id, ...pSnap.data() });
          }
        }
      } catch (e) {
        console.error("Ошибка загрузки договора:", e);
        setError(e.message || "Маълумотларни юклашда хатолик");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [contractId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <div className="text-gray-500 text-sm">Юкланмоқда...</div>
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => navigate("/homepartner")}
            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            ← Орқага
          </button>
          <div className="bg-white rounded-xl shadow p-6 text-center text-red-600">
            {error || "Шартнома топилмади"}
          </div>
        </div>
      </div>
    );
  }

  // Объект для PartnerDetailsModal
  const partnerForModal = {
    contractId: contract.id,
    partnerName: contract.partner || partner?.name || "Ҳамкор",
    contractNumber: contract.contractNumber,
    contractDate: contract.contractDate,
    contractEndDate: contract.contractEndDate,
    startBalance: contract.startBalance,
    startBalanceDate: contract.startBalanceDate,
    stationName: contract.station,
    stationId: contract.stationId,
    files: contract.files || [],
    inn: partner?.inn,
    director: partner?.director,
    shhr: partner?.shxr || partner?.shhr,
    bankAccount: partner?.account || partner?.bankAccount,
    partnerAddress: partner?.address,
    partnerPhone: partner?.phone,
  };

  return (
    <>
      {/* Фоновая страница (за модалкой) */}
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => navigate("/homepartner")}
            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            ← Орқага
          </button>
          <div className="bg-white rounded-xl shadow p-6">
            <h1 className="text-xl font-bold text-gray-800 mb-2">
              Шартнома №{contract.contractNumber || contract.autoId}
            </h1>
            <p className="text-gray-600 text-sm mb-4">
              {contract.partner} • {contract.station}
            </p>
            <p className="text-gray-500 text-sm">Оборотка очилмоқда...</p>
          </div>
        </div>
      </div>

      {/* Модалка оборотки */}
      <PartnerDetailsModal
        isOpen={true}
        onClose={() => navigate("/homepartner")}
        partner={partnerForModal}
        stationName={contract.station || "Заправка"}
      />
    </>
  );
};

export default PartnerStatement;
