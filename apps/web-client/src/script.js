// CONFIG
const SECURITY_CONFIG = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 14,
  MAX_EMAIL_LENGTH: 254,
  MAX_NAME_LENGTH: 80,
};

// Automatically switch between local and live server
const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const SERVER_URL = isLocalhost
  ? "http://localhost:3000"
  : "https://varta-0w6d.onrender.com";

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
const showLoginBtn = document.querySelector("#js-show-login");
const showForgotBtn = document.querySelector("#js-show-forgot");
const backToLoginBtn = document.querySelector("#js-back-to-login");

const loader = document.querySelector("#globalLoader");

function showLoader() {
  loader.classList.add("active");
}

function hideLoader() {
  loader.classList.remove("active");
}

// PANEL SWITCHING
function switchPanel(panel) {
  [loginPanel, registerPanel, forgotPanel].forEach(p =>
    p.classList.remove("is-active")
  );

  panel.classList.add("is-active");
}

showRegisterBtn?.addEventListener("click", () => switchPanel(registerPanel));
showLoginBtn?.addEventListener("click", () => switchPanel(loginPanel));
showForgotBtn?.addEventListener("click", () => switchPanel(forgotPanel));
backToLoginBtn?.addEventListener("click", () => switchPanel(loginPanel));


// HELPERS
const sanitize = value => value.trim();

function setError(input, message) {
  const error = input.closest(".form-field")
    .querySelector(".form-field__error");

  error.textContent = message;
  input.classList.add("is-invalid");
  input.classList.remove("is-valid");
}

function clearError(input) {
  const error = input.closest(".form-field")
    .querySelector(".form-field__error");

  error.textContent = "";
  input.classList.remove("is-invalid");
  input.classList.add("is-valid");
}

function validateEmail(email) {
  if (email.length > SECURITY_CONFIG.MAX_EMAIL_LENGTH) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  const minLength =
    password.length >= SECURITY_CONFIG.MIN_PASSWORD_LENGTH;
  const maxLength =
    password.length <= SECURITY_CONFIG.MAX_PASSWORD_LENGTH;

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
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
}

async function refreshAccessToken() {
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

  if (!response.ok) {
    throw new Error("Session expired");
  }

  let data = {};
  try {
    data = await response.json();
  } catch { }

  accessToken = data.accessToken;
  sessionStorage.setItem("accessToken", accessToken);
  refreshToken = data.refreshToken;
  localStorage.setItem("refreshToken", refreshToken);
  return accessToken;
};

//LOGOUT
async function logout() {
  if (refreshToken) {
    try {
      await fetch(`${SERVER_URL}/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({ refreshToken })
      });
    } catch (err) {
      console.error("Logout failed: ", err);
    }
  }

  accessToken = null;
  refreshToken = null;

  sessionStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");

  window.location.href = "/index.html";
}

async function restoreSession() {
  if (!refreshToken && !accessToken) return;
  try {
    if (!accessToken && refreshToken)
      await refreshAccessToken();

    if (accessToken)
      window.location.href = "/homepage.html";
  } catch {
    await logout();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  restoreSession();
});

//API HELPER
async function apiRequest(endpoint, method = "GET", body = null, retry = true) {
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

  const isAuthRoute = ["/login", "/register"].includes(endpoint);
  if (response.status === 401 && retry && !isAuthRoute) {
    try {
      await refreshAccessToken();
      return apiRequest(endpoint, method, body, false);
    } catch {
      await logout();
      throw new Error("Session expired. Please login again.");
    }
  }

  let data = {};
  const contentType = response.headers.get("Content-Type") || "";

  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed. Please try again");
  }

  return data;
}

//LOGIN API
async function login(email, password) {
  let data = await apiRequest("/login", "POST", {
    email,
    password
  });

  accessToken = data.accessToken;
  refreshToken = data.refreshToken;

  sessionStorage.setItem("accessToken", accessToken);

  if (refreshToken) {
    localStorage.setItem("refreshToken", refreshToken);
  }
  return data;
}

// REGISTER API
async function register(username, email, password) {
  return apiRequest("/register", "POST", {
    username,
    email,
    password
  });
}

// LOGIN FORM
loginForm?.addEventListener("submit", async e => {
  e.preventDefault();

  const btn = loginForm.querySelector("button");

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

  const result = validatePassword(cleanPassword);

  if (!result.isValid) {
    setError(password, "Invalid credentials.");
    isValid = false;
  }

  if (!isValid) {
    return;
  }

  btn.disabled = true;

  try {
    showLoader();
    await login(cleanEmail, cleanPassword);

    window.location.href = "/homepage.html";
  } catch (err) {
    setError(password, err.message);
  } finally {
    btn.disabled = false;
    hideLoader();
  }
});

//REGISTER FORM
registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const btn = registerForm.querySelector("button");

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
    setError(fullName, "Name must be between 3 and 80 characters.");
    isValid = false;
  }

  if (!validateEmail(cleanEmail)) {
    setError(email, "Enter a valid email address.");
    isValid = false;
  }

  const result = validatePassword(cleanPassword);

  if (!result.isValid) {
    setError(
      password,
      "Password must contain uppercase, lowercase, number and symbol."
    );
    isValid = false;
  }

  if (cleanPassword !== confirm.value) {
    setError(confirm, "Passwords do not match.");
    isValid = false;
  }

  if (!isValid) return;

  btn.disabled = true;

  try {
    showLoader();
    await register(cleanName, cleanEmail, cleanPassword);
    switchPanel(loginPanel);
  } catch (err) {
    setError(email, err.message || "Registration failed.");
  } finally {
    hideLoader();
    btn.disabled = false;
  }
});


// FORGOT PASSWORD
forgotForm?.addEventListener("submit", async e => {
  e.preventDefault();

  const btn = forgotForm.querySelector("button");

  const email = forgotForm.email;
  clearError(email);

  const cleanEmail = sanitize(email.value).toLowerCase();

  if (!validateEmail(cleanEmail)) {
    setError(email, "Enter a valid email address.");
    return;
  }

  btn.disabled = true;

  try {
    showLoader();
    await apiRequest("/forgot-password", "POST", {
      email: cleanEmail
    });
    switchPanel(loginPanel);
  } catch (err) {
    setError(email, err.message || "Unable to send reset link.");
  } finally {
    hideLoader();
    btn.disabled = false;
  }
});


// REAL-TIME PASSWORD CHECK
registerForm?.password?.addEventListener("input", () => {
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