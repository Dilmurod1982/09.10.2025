import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../lib/zustand";

const HomePartner = () => {
  const navigate = useNavigate();
  const userData = useAppStore((s) => s.userData);
  const partnerId = userData?.partnerId;

  const [contracts, setContracts] = useState([]);
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!partnerId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setError("");
        const pSnap = await getDoc(doc(db, "partners", partnerId));
        if (pSnap.exists()) {
          setPartner({ id: pSnap.id, ...pSnap.data() });
        }

        const q = query(
          collection(db, "contracts"),
          where("partnerId", "==", partnerId)
        );
        const snap = await getDocs(q);
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.autoId || 0) - (a.autoId || 0));
        setContracts(list);
      } catch (e) {
        setError(e.message || "Маълумотларни юклашда хатолик");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [partnerId]);

  // ============================================================
  // Форматирование
  // ============================================================
  const formatDate = (d) => {
    if (!d) return "—";
    try {
      const date = d.toDate ? d.toDate() : new Date(d);
      return date.toLocaleDateString("ru-RU");
    } catch {
      return "—";
    }
  };

  const formatMoney = (n) => {
    if (n === undefined || n === null || n === "") return "—";
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(n) || 0);
  };

  const formatM3 = (n) => {
    if (n === undefined || n === null) return "—";
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);
  };

  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const isExpired = (endDate) => {
    if (!endDate) return false;
    try {
      const d = endDate.toDate ? endDate.toDate() : new Date(endDate);
      return d < new Date();
    } catch {
      return false;
    }
  };

  // ============================================================
  // Расчёт последней даты отчёта и последнего сальдо по договору
  // ============================================================
  const enrichContract = (contract) => {
    const transactions = Array.isArray(contract.transactions)
      ? [...contract.transactions].sort((a, b) =>
          String(a.reportDate || "").localeCompare(String(b.reportDate || ""))
        )
      : [];

    if (transactions.length === 0) {
      return {
        ...contract,
        lastReportDate: null,
        lastBalance: toNumber(contract.startBalance),
        hasTransactions: false,
      };
    }

    // Сальдо после последней транзакции
    let balance = toNumber(contract.startBalance);
    for (const t of transactions) {
      balance += toNumber(t.totalAmount) - toNumber(t.paymentSum);
    }

    const lastTx = transactions[transactions.length - 1];

    return {
      ...contract,
      lastReportDate: lastTx.reportDate,
      lastBalance: balance,
      hasTransactions: true,
    };
  };

  const enrichedContracts = useMemo(
    () => contracts.map(enrichContract),
    [contracts]
  );

  // ============================================================
  // Стиль сальдо (положительное — красное, отрицательное — зелёное)
  // ============================================================
  const balanceClass = (val) => {
    const n = toNumber(val);
    if (n > 0) return "text-red-600";
    if (n < 0) return "text-green-600";
    return "text-gray-700";
  };

  if (!partnerId) {
    return (
      <div className="p-6 text-center text-red-600">
        Сизнинг аккаунтингизга ҳамкор бириктирилмаган. Админга мурожаат қилинг.
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {partner?.name || "Ҳамкор"}
          </h1>
          <p className="text-gray-600 text-sm md:text-base mt-1">
            {partner?.inn && `ИНН: ${partner.inn}`}
            {partner?.director && ` • Раҳбар: ${partner.director}`}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <h2 className="text-lg font-semibold mb-3 text-gray-800">
          Шартномалар ({enrichedContracts.length})
        </h2>

        {enrichedContracts.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
            Шартномалар топилмади
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Шартнома №</th>
                  <th className="px-4 py-3 text-left">Станция</th>
                  <th className="px-4 py-3 text-left">Сана</th>
                  <th className="px-4 py-3 text-left">Тугаш санаси</th>
                  <th className="px-4 py-3 text-right">Бошланғич сальдо</th>
                  <th className="px-4 py-3 text-left">Охирги ҳисобот</th>
                  <th className="px-4 py-3 text-right">Охирги сальдо</th>
                  <th className="px-4 py-3 text-center">→</th>
                </tr>
              </thead>
              <tbody>
                {enrichedContracts.map((c, i) => (
                  <tr
                    key={c.id}
                    className={`border-t hover:bg-blue-50 cursor-pointer transition-colors ${
                      isExpired(c.contractEndDate) ? "bg-red-50/40" : ""
                    }`}
                    onClick={() => navigate(`/partner-statement/${c.id}`)}
                  >
                    <td className="px-4 py-3">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">
                      {c.contractNumber || "—"}
                    </td>
                    <td className="px-4 py-3">{c.station || "—"}</td>
                    <td className="px-4 py-3">{formatDate(c.contractDate)}</td>
                    <td className="px-4 py-3">
                      {formatDate(c.contractEndDate)}
                      {isExpired(c.contractEndDate) && (
                        <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                          тугаган
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${balanceClass(
                        c.startBalance
                      )}`}
                    >
                      {c.startBalance != null
                        ? formatMoney(c.startBalance)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.lastReportDate ? formatDate(c.lastReportDate) : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-semibold ${balanceClass(
                        c.lastBalance
                      )}`}
                    >
                      {formatMoney(c.lastBalance)}
                    </td>
                    <td className="px-4 py-3 text-center text-blue-600">📊</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="px-4 py-2 text-xs text-gray-500 border-t bg-gray-50">
              💡 Сальдо:{" "}
              <span className="text-red-600 font-semibold">қизил</span> —
              қарздорлик,{" "}
              <span className="text-green-600 font-semibold">яшил</span> —
              олдиндан тўлов
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePartner;
