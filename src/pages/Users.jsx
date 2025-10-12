import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, updatePassword } from "firebase/auth";
import { db, auth } from "../firebase/config";
import { UserModal, AddUserModal } from "../components";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const usersCollection = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollection);
      const usersList = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (user) => {
    setSelectedUser(user);
    setIsUserModalOpen(true);
  };

  const handleAddUser = () => {
    setIsAddUserModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsUserModalOpen(false);
    setSelectedUser(null);
  };

  const handleCloseAddModal = () => {
    setIsAddUserModalOpen(false);
  };

  const handleUserUpdated = () => {
    fetchUsers();
    handleCloseModal();
  };

  const handleUserCreated = () => {
    fetchUsers();
    handleCloseAddModal();
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: "bg-red-100 text-red-800",
      nazorat: "bg-blue-100 text-blue-800",
      rahbar: "bg-green-100 text-green-800",
      operator: "bg-orange-100 text-orange-800",
      boshmexanik: "bg-purple-100 text-purple-800",
      mehanik: "bg-indigo-100 text-indigo-800",
      buxgalter: "bg-teal-100 text-teal-800",
      yurist: "bg-pink-100 text-pink-800",
      partner: "bg-gray-100 text-gray-800",
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Пользователи</h1>
        <button
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
          onClick={handleAddUser}>
          + Добавить нового пользователя
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Имя
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Фамилия
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Роль
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата регистрации
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => handleUserClick(user)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {user.id.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.firstName || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.lastName || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(
                        user.role
                      )}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.createdAt
                      ? new Date(
                          user.createdAt.seconds * 1000
                        ).toLocaleDateString("ru-RU")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isUserModalOpen && selectedUser && (
        <UserModal
          user={selectedUser}
          onClose={handleCloseModal}
          onUserUpdated={handleUserUpdated}
        />
      )}

      {isAddUserModalOpen && (
        <AddUserModal
          onClose={handleCloseAddModal}
          onUserCreated={handleUserCreated}
        />
      )}
    </div>
  );
};

export default Users;
