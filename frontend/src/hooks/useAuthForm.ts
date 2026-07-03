import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/src/store/authStore";

export const useAuthForm = (initialMode: boolean = true) => {
  const { login } = useAuthStore();
  const router = useRouter();

  const [isLoginMode, setIsLoginMode] = useState(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const endpoint = isLoginMode ? "/api/auth/login" : "/api/auth/register";
    const payload = isLoginMode
      ? { email: formData.email, password: formData.password }
      : {
          name: formData.name,
          email: formData.email,
          password: formData.password,
        };

    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      // 🛡️ 1. ERROR HANDLING & GATEKEEPER
      if (!response.ok) {
        if (data.error === "EMAIL_NOT_VERIFIED") {
          router.push(
            `/verify-otp?email=${encodeURIComponent(formData.email)}`,
          );
          return;
        }
        throw new Error(
          data.error || "Authentication failed. Please check your credentials.",
        );
      }

      // 🛡️ 2. SUCCESS HANDLING (Separated Logic)
      if (isLoginMode) {
        login(data.user, data.accessToken || data.token);

        // 🟢 THE AMNESIA FIX: Check if user came from an invite link
        const pendingInvite = localStorage.getItem("pendingInvite");
        if (pendingInvite) {
          localStorage.removeItem("pendingInvite"); // Kachra saaf karo
          router.push(pendingInvite); // Wapas invite par bhejo
        } else {
          router.push("/");
        }
      } else {
        router.push(`/verify-otp?email=${encodeURIComponent(formData.email)}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoginMode,
    showPassword,
    formData,
    error,
    isLoading,
    togglePasswordVisibility,
    handleInputChange,
    handleSubmit,
  };
};
