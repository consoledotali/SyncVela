import React, { useState } from "react";
import { useAuthStore } from "@/src/store/authStore";

export default function Auth() {
  const { login } = useAuthStore();

  // NAYA: UI Toggle State
  const [isLogin, setIsLogin] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const payload = isLogin ? { email, password } : { name, email, password };

    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 🛡️ NAYA: Yeh line lazmi hai taake browser backend se aane wali cookie ko accept kare
        credentials: "include", 
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // STATE UPDATE: Sirf Access Token (data.token) Zustand mein save hoga. 
      // Refresh token browser ne khud hidden cookie mein save kar liya hai.
      login(data.user, data.accessToken || data.token); 
      // Note: Backend se ab data.accessToken aa raha hai, fallback ke liye data.token rakha hai.
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-96"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
          {isLogin ? "Welcome Back to SyncVela" : "Create SyncVela Account"}
        </h2>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded mb-4 text-sm text-center border border-red-200">
            {error}
          </div>
        )}

        {/* Name input sirf Registration ke waqt dikhega */}
        {!isLogin && (
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={!isLogin}
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 text-black"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 text-black"
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 text-black"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {isLoading
            ? "Processing..."
            : isLogin
              ? "Login"
              : "Register & Connect"}
        </button>

        {/* Toggle Button */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            {isLogin ? "Naya account banana hai?" : "Pehle se account hai?"}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(""); // Toggle karte waqt purane errors clear kar do
              }}
              className="ml-1 text-blue-600 font-semibold hover:underline focus:outline-none"
            >
              {isLogin ? "Register karein" : "Login karein"}
            </button>
          </p>
        </div>
      </form>
    </div>
  );
}
