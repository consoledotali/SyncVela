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
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}${endpoint}`,
        payload,
        { withCredentials: true },
      );

      if (response.data.requiresVerification) {
        router.push(
          `/auth/verify-otp?email=${encodeURIComponent(formData.email)}`,
        );
        return;
      }

      if (response.data.accessToken && response.data.user) {
        login(response.data.user, response.data.accessToken);

        const pendingInvite = localStorage.getItem("pendingInvite");
        if (pendingInvite) {
          localStorage.removeItem("pendingInvite");
          router.push(pendingInvite);
        } else {
          router.push("/");
        }
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.data?.requiresVerification) {
          router.push(
            `/auth/verify-otp?email=${encodeURIComponent(formData.email)}`,
          );
          return;
        }

        setError(
          err.response?.data?.error ||
            "Something went wrong. Please check your credentials.",
        );
      } else {
        setError(getErrorMessage(err));
      }
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

