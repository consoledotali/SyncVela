import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAuthStore } from "@/src/store/authStore";

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Authentication failed. Please try again.";
}

export const useAuthForm = (initialMode: boolean = true) => {
  const { login } = useAuthStore();
  const router = useRouter();

  const [isLoginMode] = useState(initialMode);
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
    // 🚀 UX FIX: Error fauran clear karo jab user dobara type karna shuru kare
    setError("");
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

      const response = await axios.post(`${apiUrl}${endpoint}`, payload, {
        withCredentials: true,
        validateStatus: () => true,
      });

      const data = response.data;

      // 🔴 Error Handling Pipeline
      if (response.status < 200 || response.status >= 300) {
        // 🚀 ROUTING FIX: Correct path is /auth/verify-otp
        if (data.error === "EMAIL_NOT_VERIFIED") {
          router.push(
            `/auth/verify-otp?email=${encodeURIComponent(formData.email)}`,
          );
          return;
        }

        // 🚀 THE GOOGLE ACCOUNT INTERCEPTOR
        if (data.error === "GOOGLE_ACCOUNT") {
          throw new Error(
            "This account uses Google Sign-In. Please log in with Google first. You can then set a password in your profile settings to enable email/password login.",
          );
        }

        throw new Error(
          data.error || "Authentication failed. Please check your credentials.",
        );
      }

      // 🟢 Success Pipeline
      if (isLoginMode) {
        // 🚀 ARCHITECTURE FIX: Sirf Zustand store update karo.
        // AuthScreen.tsx ka useEffect automatically detect karega aur router.push() se seamless redirect marega. No window.location.href reloads.

        // Ensure hum token nikal rahe hain chahe backend payload kisi bhi shape mein aaye (e.g. data.tokens.accessToken ya data.token)
        const tokenToStore =
          data.tokens?.accessToken || data.accessToken || data.token;
        login(data.user, tokenToStore);
      } else {
        // 🚀 ROUTING FIX: Push exactly to /auth/verify-otp
        router.push(
          `/auth/verify-otp?email=${encodeURIComponent(formData.email)}`,
        );
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
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
