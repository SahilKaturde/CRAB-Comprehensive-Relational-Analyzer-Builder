const API = import.meta.env.VITE_DJANGO_API || "http://127.0.0.1:8000";

export const authService = {
  login: async (data) => {
    const res = await fetch(`${API}/api/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Login failed");
    }

    const result = await res.json();

    // Store tokens
    localStorage.setItem("access", result.access);
    localStorage.setItem("refresh", result.refresh);

    return result;
  },

  register: async (data) => {
    const res = await fetch(`${API}/api/register/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMessage = Object.values(errorData).flat().join(", ");
      throw new Error(errorMessage || "Registration failed");
    }

    return await res.json();
  },

  logout: () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
  },

  isAuthenticated: () => {
    return !!localStorage.getItem("access");
  }
};