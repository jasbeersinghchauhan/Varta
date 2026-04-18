// CONFIG
const SECURITY_CONFIG = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 64,
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

const urlParams = new URLSearchParams(window.location.search);
const resetToken = urlParams.get("token");
const verifyToken = urlParams.get("verifyToken");

// DOM
const panels = {
  login: document.querySelector("#js-login-panel"),
  register: document.querySelector("#js-register-panel"),
  forgot: document.querySelector("#js-forgot-panel"),
  verify: document.querySelector("#js-verify-panel"),
  reset: document.querySelector("#js-reset-panel"),
};

const forms = {
  login: document.querySelector("#js-login-form"),
  register: document.querySelector("#js-register-form"),
  forgot: document.querySelector("#js-forgot-form"),
  verify: document.querySelector("#js-verify-form"),
  reset: document.querySelector("#js-reset-form"),
};

const resendCodeBtn = document.querySelector("#js-resend-code");
const showRegisterBtn = document.querySelector("#js-show-register");
const showLoginBtn = document.querySelector("#js-show-login");
const showForgotBtn = document.querySelector("#js-show-forgot");
const backToLoginBtn = document.querySelector("#js-back-to-login");
const backToLoginFromVerifyBtn = document.querySelector("#js-back-to-login-from-verify");
const backToLoginFromResetBtn = document.querySelector("#js-back-to-login-from-reset");

const loader = document.querySelector("#globalLoader");
const globalMessage = document.querySelector("#globalMessage");

function showLoader() {
  loader.classList.add("active");
}

function hideLoader() {
  loader.classList.remove("active");
}

function showMessage(message, type = "info") {
  if (!globalMessage) return;

  globalMessage.textContent = message;
  globalMessage.className = `global-message ${type} show`;

  setTimeout(() => {
    globalMessage.classList.remove("show");
  }, 3000);
}

// PANEL SWITCHING
function switchPanel(panel) {
  Object.values(panels).forEach(p =>
    p.classList.remove("is-active")
  );
  if (panel)
    panel.classList.add("is-active");
}

// ATTACH PANEL NAVIGATION
showRegisterBtn?.addEventListener("click", () => switchPanel(panels.register));
showLoginBtn?.addEventListener("click", () => switchPanel(panels.login));
showForgotBtn?.addEventListener("click", () => switchPanel(panels.forgot));
backToLoginBtn?.addEventListener("click", () => switchPanel(panels.login));
backToLoginFromVerifyBtn?.addEventListener("click", () => switchPanel(panels.login));
backToLoginFromResetBtn?.addEventListener("click", () => switchPanel(panels.login));

// FORM VALIDATION HELPERS
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
  const hasSymbol = /[^A-Za-z0-9\s]/.test(password);
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

// PASSWORD UI VALIDATOR
function handlePasswordValidation(inputElement) {
  const value = inputElement.value;
  if (!value) return clearError(inputElement);

  const result = validatePassword(value);

  if (!result.minLength) setError(inputElement, "Minimum 8 characters required.");
  else if (!result.maxLength) setError(inputElement, "Maximum 14 characters allowed.");
  else if (!result.hasUpper) setError(inputElement, "Include at least one uppercase letter.");
  else if (!result.hasLower) setError(inputElement, "Include at least one lowercase letter.");
  else if (!result.hasNumber) setError(inputElement, "Include at least one number.");
  else if (!result.hasSymbol) setError(inputElement, "Include at least one symbol.");
  else if (!result.noSpaces) setError(inputElement, "Spaces are not allowed.");
  else clearError(inputElement);
}

// REAL-TIME PASSWORD LISTENERS
forms.register?.password?.addEventListener("input", (e) => handlePasswordValidation(e.target));
forms.reset?.new_password?.addEventListener("input", (e) => handlePasswordValidation(e.target));

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

  const isJson = response.headers.get("Content-Type")?.includes("application/json");
  let data = isJson ? await response.json() : {};

  if (!response.ok) {
    throw new Error(data.message || "Request failed. Please try again");
  }

  return data;
}

function startCooldown() {
  const COOLDOWN_SECONDS = 60;
  const btn = resendCodeBtn;

  if (!btn) return;

  const existingCooldown = sessionStorage.getItem("resendCooldownTime");
  let timeLeft = COOLDOWN_SECONDS;

  if (existingCooldown) {
    const remainingMs = parseInt(existingCooldown) - Date.now();
    if (remainingMs > 0) {
      timeLeft = Math.ceil(remainingMs / 1000);
    } else {
      sessionStorage.removeItem("resendCooldownTime");
    }
  } else {
    sessionStorage.setItem("resendCooldownTime", Date.now() + (COOLDOWN_SECONDS * 1000));
  }

  if (timeLeft <= 0) {
    btn.disabled = false;
    btn.textContent = "Resend Verification Email";
    return;
  }

  btn.disabled = true;

  const timer = setInterval(() => {
    btn.textContent = `Resend available in ${timeLeft}s`;
    timeLeft--;

    if (timeLeft < 0) {
      clearInterval(timer);
      btn.disabled = false;
      btn.textContent = "Resend Verification Email";
      sessionStorage.removeItem("resendCooldownTime");
    }
  }, 1000);
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

  window.location.replace("/index.html");
}

async function restoreSession() {
  if (!refreshToken && !accessToken) return;
  try {
    if (!accessToken && refreshToken)
      await refreshAccessToken();

    if (accessToken)
      window.location.replace("/homepage.html");
  } catch {
    await logout();
  }
}

async function validateResetToken(token) {
  try {
    await apiRequest("/validate-reset-token", "POST", { token });
    return true;
  } catch {
    return false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  restoreSession();
  startCooldown();

  if (resetToken) {
    const valid = await validateResetToken(resetToken);
    if (valid) {
      switchPanel(panels.reset);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      showMessage("Reset link is invalid or expired.", "error");
      switchPanel(panels.forgot);
    }
  }

  if (verifyToken) {
    try {
      showLoader();
      await apiRequest("/verify-email", "POST", { token: verifyToken });
      showMessage("Email verified successfully! You can now log in.", "success");
      switchPanel(panels.login);
    } catch (err) {
      showMessage(err.message || "Verification link is invalid or expired.", "error");
    } finally {
      hideLoader();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
});

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

// RESEND API
async function resendVerification(email) {
  return apiRequest("/resend-verification", "POST", { email });
}

// RESET PASSWORD API
async function resetPassword(token, newPassword) {
  return apiRequest("/reset-password", "POST", { token, newPassword });
}

// LOGIN FORM
forms.login?.addEventListener("submit", async e => {
  e.preventDefault();

  const btn = forms.login.querySelector("button");

  const email = forms.login.email;
  const password = forms.login.password;

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

    window.location.replace("/homepage.html");
  } catch (err) {
    setError(password, err.message);
  } finally {
    btn.disabled = false;
    hideLoader();
  }
});

//REGISTER FORM
forms.register?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const btn = forms.register.querySelector("button");

  const fullName = forms.register.username;
  const email = forms.register.email;
  const password = forms.register.password;
  const confirm = forms.register.password_confirmation;

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

    sessionStorage.setItem("pendingVerificationEmail", cleanEmail);

    switchPanel(panels.verify);
  } catch (err) {
    setError(email, err.message || "Registration failed.");
  } finally {
    hideLoader();
    btn.disabled = false;
  }
});


// FORGOT PASSWORD
forms.forgot?.addEventListener("submit", async e => {
  e.preventDefault();

  const btn = forms.forgot.querySelector("button");

  const email = forms.forgot.email;
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
    showMessage("If an account exists, a reset link has been sent to your email.", "success");
    switchPanel(panels.login);
  } catch (err) {
    setError(email, err.message || "Unable to send reset link.");
  } finally {
    hideLoader();
    btn.disabled = false;
  }
});

// RESEND CODE
resendCodeBtn?.addEventListener("click", async e => {
  e.preventDefault();
  const pendingEmail = sessionStorage.getItem("pendingVerificationEmail");

  if (!pendingEmail) {
    showMessage("No pending registration found. Please register again.", "error");
    return;
  }

  try {
    showLoader();
    await resendVerification(pendingEmail);
    showMessage("A new verification code has been sent to your email.", "success");

    startCooldown();
  } catch (err) {
    showMessage(err.message || "Unable to resend code.", "error");
  } finally {
    hideLoader();
  }
});

// RESET PASSWORD FORM SUBMIT
forms.reset?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = forms.reset.querySelector("button");
  const newPassword = forms.reset.new_password;
  const confirmPassword = forms.reset.confirm_new_password;

  clearError(newPassword);
  clearError(confirmPassword);

  const cleanPassword = newPassword.value;
  let isValid = true;

  const result = validatePassword(cleanPassword);
  if (!result.isValid) {
    setError(newPassword, "Password does not meet requirements.");
    isValid = false;
  }

  if (cleanPassword !== confirmPassword.value) {
    setError(confirmPassword, "Passwords do not match.");
    isValid = false;
  }

  if (!isValid) return;

  btn.disabled = true;
  try {
    showLoader();
    await resetPassword(resetToken, cleanPassword);

    // Clear the token from the URL bar so it doesn't linger
    window.history.replaceState({}, document.title, window.location.pathname);

    switchPanel(panels.login);
    showMessage("Password updated successfully! Please log in.", "success");
  } catch (err) {
    if (err.message.toLowerCase().includes("expired")) {
      showMessage("Reset link expired. Please request a new one.");
      switchPanel(panels.forgot);
    } else if (err.message.toLowerCase().includes("invalid")) {
      showMessage("Invalid reset link.", "error");
      switchPanel(panels.forgot);
    } else {
      setError(newPassword, err.message);
    }
  } finally {
    hideLoader();
    btn.disabled = false;
  }
});