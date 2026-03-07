// ==============================
// CONFIG (Single Source of Truth)
// ==============================
const SECURITY_CONFIG = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 14,
  MAX_EMAIL_LENGTH: 254,
  MAX_NAME_LENGTH: 80,
};

// ==============================
// DOM REFERENCES
// ==============================
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

// ==============================
// PANEL SWITCHING
// ==============================
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

// ==============================
// HELPERS
// ==============================
const sanitize = value => value.replace(/[<>]/g, "").trim();

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
  return /^[a-zA-Z][a-zA-Z0-9.]*@gmail\.com$/.test(email);
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

// ==============================
// LOGIN
// ==============================
loginForm.addEventListener("submit", e => {
  e.preventDefault();

  const email = loginForm.email;
  const password = loginForm.password;

  clearError(email);
  clearError(password);

  const cleanEmail = sanitize(email.value);
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

  if (!isValid) return;

  alert("Login request ready for backend.");
});

// ==============================
// REGISTER
// ==============================

const register = async (userName, userEmail, userPassword) => {
  try {
      const response = await fetch('http://localhost:5000/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({userName, userEmail, userPassword})
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Registration failed`);
    }
    console.log('Registration Success:', data);
    return data;
  }
  catch(error) {
    console.log(`Registration Error: `, error.message);
    throw error;
  }
  
}

registerForm.addEventListener("submit", async e => {
  e.preventDefault();

  const fullName = registerForm.full_name;
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

  await register(cleanName, cleanEmail, cleanPassword);
  alert("Registration successful");
  showPanel(loginPanel);
});

// ==============================
// FORGOT PASSWORD
// ==============================
forgotForm.addEventListener("submit", e => {
  e.preventDefault();

  const email = forgotForm.email;
  clearError(email);

  const cleanEmail = sanitize(email.value).toLowerCase();

  if (!validateEmail(cleanEmail)) {
    setError(email, "Invalid email address.");
    return;
  }

  alert("Password reset request ready for backend.");
});

// ==============================
// REAL-TIME PASSWORD CHECK
// ==============================
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