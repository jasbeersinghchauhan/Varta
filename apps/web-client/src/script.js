// CONFIG
const SECURITY_CONFIG = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 14,
  MAX_EMAIL_LENGTH: 254,
  MAX_NAME_LENGTH: 80,
};

// const SERVER_URL = "https://varta-0w6d.onrender.com";
const SERVER_URL = "http://localhost:3000";

let accessToken = sessionStorage.getItem("accessToken");
let refreshToken = localStorage.getItem("refreshToken");

// DOM
const loginPanel = document.querySelector("#js-login-panel");
const registerPanel = document.querySelector("#js-register-panel");
const forgotPanel = document.querySelector("#js-forgot-panel");

const loginForm = document.querySelector("#js-login-form");
const registerForm = document.querySelector("#js-register-form");
const forgotForm = document.querySelector("#js-forgot-form");

const showRegisterBtn = document.querySelector("#js-show-register");
const showLoginLink = document.querySelector("#js-show-login");
const showForgotLink = document.querySelector("#js-show-forgot");
const backToLoginLink = document.querySelector("#js-back-to-login");
const btn = loginForm.querySelector("button");

// PANEL SWITCHING
const showPanel = (panel) => {
  [loginPanel, registerPanel, forgotPanel].forEach(p =>
    p.classList.remove("is-active")
  );
  panel.classList.add("is-active");
};

showRegisterBtn.addEventListener("click", () => showPanel(registerPanel));
showLoginLink.addEventListener("click", e => {
  e.preventDefault();
  showPanel(loginPanel);
});
showForgotLink.addEventListener("click", e => {
  e.preventDefault();
  showPanel(forgotPanel);
});
backToLoginLink.addEventListener("click", e => {
  e.preventDefault();
  showPanel(loginPanel);
});


// HELPERS
const sanitize = value => value.trim();

const setError = (input, message) => {
  const errorEl = input.closest(".form-field")
    .querySelector(".form-field__error");

  errorEl.textContent = message;
  input.setAttribute("aria-invalid", "true");
};

const clearError = input => {
  const errorEl = input.closest(".form-field")
    .querySelector(".form-field__error");
  errorEl.textContent = "";
  input.removeAttribute("aria-invalid");
};

const validateEmail = email => {
  if (email.length > SECURITY_CONFIG.MAX_EMAIL_LENGTH) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validatePassword = password => {
  const minLength =
    password.length >= SECURITY_CONFIG.MIN_PASSWORD_LENGTH;
  const maxLength =
    password.length <= SECURITY_CONFIG.MAX_PASSWORD_LENGTH;

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*]/.test(password);
  const noSpaces = !/\s/.test(password);

  const isValid =
    minLength &&
    maxLength &&
    hasUpper &&
    hasLower &&
    hasNumber &&
    hasSymbol &&
    noSpaces;

  return {
    isValid,
    minLength,
    maxLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSymbol,
    noSpaces,
  };
};

const refreshAccessToken = async () => {
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  let response;
  try {
    response = await fetch(`${SERVER_URL}/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        refreshToken
      })
    });
  } catch {
    throw new Error("Network error");
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Session expired");
  }

  accessToken = data.accessToken;
  sessionStorage.setItem("accessToken", accessToken);
  refreshToken = data.refreshToken;
  localStorage.setItem("refreshToken", refreshToken);
  return accessToken;
};

//LOGOUT
const logout = () => {
  accessToken = null;
  refreshToken = null;

  sessionStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");

  window.location.href = "/index.html";
};

const restoreSession = async () => {
  if (!accessToken && refreshToken) {
    try {
      await refreshAccessToken();
    } catch {
      logout();
    }
  }
};

restoreSession();

//API HELPER
const apiRequest = async (endpoint, method, body = null, retry = true) => {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json"
    }
  };

  if (accessToken) {
    options.headers["Authorization"] = `Bearer ${accessToken}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
  response = await fetch(`${SERVER_URL}${endpoint}`, options);
  } catch {
    throw new Error("Network error. Please check your connection.")
  }

  if (response.status == 401 && retry) {
    try {
      await refreshAccessToken();
      return apiRequest(endpoint, method, body, false);
    } catch {
      logout();
      throw new Error("Session expired. Please login again.");
    }
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || "Server error");
  }

  return data;
};

//LOGIN API
const login = async (email, password) => {
  const data = await apiRequest("/login", "POST", {
    email,
    password
  });

  accessToken = data.accessToken;
  refreshToken = data.refreshToken;

  sessionStorage.setItem("accessToken", accessToken);

  if (data.refreshToken) {
    localStorage.setItem("refreshToken", data.refreshToken);
  }
  return data;
};

// REGISTER API
const register = async (username, email, password) => {
  return apiRequest("/register", "POST", {
    username,
    email,
    password
  });
};

// LOGIN FORM
loginForm.addEventListener("submit", async e => {
  e.preventDefault();

  const email = loginForm.email;
  const password = loginForm.password;

  clearError(email);
  clearError(password);

  const cleanEmail = sanitize(email.value).toLowerCase();
  const cleanPassword = password.value;

  let isValid = true;

  if (!validateEmail(cleanEmail)) {
    setError(email, "Invalid email address.");
    isValid = false;
  }

  if (
    cleanPassword.length < SECURITY_CONFIG.MIN_PASSWORD_LENGTH ||
    cleanPassword.length > SECURITY_CONFIG.MAX_PASSWORD_LENGTH
  ) {
    setError(password, "Invalid credentials.");
    isValid = false;
  }

  if (!isValid){
    return;
  }

  btn.disabled = true;
  
  try {
    await login(cleanEmail, cleanPassword);

    alert("Login successful");
    window.location.href = "/homepage.html";
  } catch (err) {
    setError(password, err.message);
  } finally {
    btn.disabled = false;
  }
});

//REGISTER FORM
registerForm.addEventListener("submit", async e => {
  e.preventDefault();

  const fullName = registerForm.username;
  const email = registerForm.email;
  const password = registerForm.password;
  const confirm = registerForm.password_confirmation;

  [fullName, email, password, confirm].forEach(clearError);

  const cleanName = sanitize(fullName.value);
  const cleanEmail = sanitize(email.value).toLowerCase();
  const cleanPassword = password.value;

  let isValid = true;

  if (
    cleanName.length < 3 ||
    cleanName.length > SECURITY_CONFIG.MAX_NAME_LENGTH
  ) {
    setError(fullName, "Invalid full name.");
    isValid = false;
  }

  if (!validateEmail(cleanEmail)) {
    setError(email, "Invalid email address.");
    isValid = false;
  }

  const result = validatePassword(cleanPassword);

  if (!result.isValid) {
    setError(
      password,
      "Password must be 8-14 chars with upper, lower, number, symbol."
    );
    isValid = false;
  }

  if (cleanPassword !== confirm.value) {
    setError(confirm, "Passwords do not match.");
    isValid = false;
  }

  if (!isValid) return;

  try {
    await register(cleanName, cleanEmail, cleanPassword);
    alert("Registration successful");
    showPanel(loginPanel);
  } catch (err) {
    setError(email, err.message);
  }
});


// FORGOT PASSWORD
forgotForm.addEventListener("submit", async e => {
  e.preventDefault();

  const email = forgotForm.email;
  clearError(email);

  const cleanEmail = sanitize(email.value).toLowerCase();

  if (!validateEmail(cleanEmail)) {
    setError(email, "Invalid email.");
    return;
  }

  try {
    await apiRequest("/forgot-password", "POST", {
      email: cleanEmail
    });
    alert("Password reset link sent.");
    showPanel(loginPanel);
  } catch (err) {
    setError(email, err.message);
  }
});


// REAL-TIME PASSWORD CHECK
registerForm.password.addEventListener("input", () => {
  const result = validatePassword(registerForm.password.value);

  if (!registerForm.password.value) {
    clearError(registerForm.password);
    return;
  }

  if (!result.minLength)
    setError(registerForm.password, "Minimum 8 characters required.");
  else if (!result.hasUpper)
    setError(registerForm.password, "Include at least one uppercase letter.");
  else if (!result.hasLower)
    setError(registerForm.password, "Include at least one lowercase letter.");
  else if (!result.hasNumber)
    setError(registerForm.password, "Include at least one number.");
  else if (!result.hasSymbol)
    setError(registerForm.password, "Include at least one symbol.");
  else if (!result.noSpaces)
    setError(registerForm.password, "Spaces are not allowed.");
  else clearError(registerForm.password);
});