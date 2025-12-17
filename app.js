// attendance-system/app.js
// University of Chittagong - Department of Philosophy
// Attendance Management System
// Version: 3.1.2 - Final Bug Fix
// Modified as per requirements with security improvements

// ==================== APP CONFIGURATION ====================
const SECURITY_CONFIG = {
  users: [],
  sessionTimeout: 60 * 60 * 1000,
  maxBackupFiles: 5,
  dataVersion: "3.1.2",
  appSalt: "cu_philosophy_2025_secure_salt"
};

// ==================== GLOBAL STATE ====================
let appState = {
  isAuthenticated: false,
  courses: [],
  currentCourse: null,
  teacherName: "",
  teacherEmail: "",
  teacherPhone: "",
  online: navigator.onLine,
  currentYear: new Date().getFullYear().toString(),
  currentUser: null
};

let attendanceState = {
  isActive: false,
  currentDate: null,
  studentList: [],
  currentIndex: 0,
};

let LAST_ATTENDANCE = null;
let deferredPrompt = null;
let currentModule = null;
let autoSaveInterval = null;

// ==================== ENHANCED SECURITY FUNCTIONS ====================
function hashPassword(password) {
  // Enhanced hash function with salt
  return CryptoJS.SHA256(password + SECURITY_CONFIG.appSalt).toString();
}

function validateInput(input, type = 'text') {
  if (!input) return '';
  const sanitized = input.toString().trim();
  
  switch(type) {
    case 'username':
      return sanitized.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 20);
    case 'text':
      return sanitized.replace(/[<>]/g, '').substring(0, 100);
    case 'number':
      return sanitized.replace(/[^0-9]/g, '').substring(0, 10);
    case 'year':
      return sanitized.replace(/[^0-9]/g, '').substring(0, 4);
    default:
      return sanitized;
  }
}

function validateCourseData(course) {
  if (!course.id || !course.name || !course.year) {
    return false;
  }
  
  if (course.year === 'M.A.' && !course.group) {
    return false;
  }
  
  return true;
}

// ==================== ENHANCED NOTIFICATION SYSTEM ====================
function showNotification(message, type = "info", duration = 5000) {
  // Remove existing notifications
  document.querySelectorAll('.notification').forEach(n => n.remove());
  
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  
  let icon = "";
  switch (type) {
    case "success":
      icon = "check-circle";
      break;
    case "error":
      icon = "exclamation-circle";
      break;
    case "warning":
      icon = "exclamation-triangle";
      break;
    default:
      icon = "info-circle";
  }

  notification.innerHTML = `
    <i class="fas fa-${icon}"></i>
    <span>${message}</span>
    <button class="close-notification">&times;</button>
  `;

  document.body.appendChild(notification);

  // Close button
  notification.querySelector(".close-notification").onclick = () => {
    notification.remove();
  };

  // Auto remove after duration
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, duration);
  
  // Haptic feedback for mobile
  provideHapticFeedback();
}

function provideHapticFeedback() {
  if ('vibrate' in navigator) {
    navigator.vibrate(50);
  }
}

// ==================== ENHANCED PASSWORD STRENGTH CHECK ====================
function checkPasswordStrength(password) {
  if (!password || password.length < 6) return "weak";
  
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;
  
  if (strength >= 4) return "strong";
  if (strength >= 2) return "medium";
  return "weak";
}

// ==================== ENHANCED NETWORK STATUS ====================
function updateNetStatus() {
  const dot = document.getElementById("netDot");
  const text = document.getElementById("netText");

  if (!dot || !text) return;

  if (navigator.onLine) {
    dot.style.background = "green";
    text.textContent = "Online";
    // Sync data if previously offline
    if (appState.isAuthenticated) {
      setTimeout(() => syncData(), 1000);
    }
  } else {
    dot.style.background = "red";
    text.textContent = "Offline";
    showNotification("You are offline. Working in offline mode.", "warning");
  }
}

// ==================== QUOTE SYSTEM ====================
const quotes = [
  "Labor is the source of all wealth. – Karl Marx",
  "Work gives meaning to life. – Tolstoy",
  "Pleasure in the job puts perfection in the work. – Aristotle",
  "Without labor nothing prospers. – Sophocles",
  "Choose a job you love, and you will never have to work a day in your life. – Confucius",
  "The only way to do great work is to love what you do. – Steve Jobs",
];

function showQuote() {
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  const quoteBox = document.getElementById("quoteBox");
  if (quoteBox) {
    quoteBox.textContent = q;
  }
}

// ==================== YEAR FORMAT FUNCTION ====================
function formatYear(year, batch) {
  if (year === "M.A.") return "M.A.";
  const yearInt = parseInt(year);
  if (yearInt == 1) return `1st ${batch}`;
  if (yearInt == 2) return `2nd ${batch}`;
  if (yearInt == 3) return `3rd ${batch}`;
  return `${yearInt}th ${batch}`;
}

// ==================== WELCOME SCREEN ====================
function showWelcomeScreen() {
  const welcomeScreen = document.getElementById("welcomeScreen");
  if (welcomeScreen) {
    welcomeScreen.classList.remove("hidden");
    // Hide after 3 seconds
    setTimeout(() => {
      welcomeScreen.classList.add("hidden");
      checkAutoLogin();
    }, 3000);
  }
}

// ==================== ENHANCED AUTO LOGIN WITH SESSION MANAGEMENT ====================
function checkAutoLogin() {
  try {
    const session = localStorage.getItem("attendanceSession");
    if (!session) {
      showLoginScreen();
      return false;
    }
    
    const sessionData = JSON.parse(session);
    const now = new Date().getTime();
    
    if (sessionData.expires < now) {
      localStorage.removeItem("attendanceSession");
      showLoginScreen();
      return false;
    }
    
    if (sessionData.version !== SECURITY_CONFIG.dataVersion) {
      localStorage.removeItem("attendanceSession");
      showLoginScreen();
      return false;
    }
    
    // Session is valid
    appState.isAuthenticated = true;
    appState.teacherName = sessionData.teacherName || "";
    appState.teacherEmail = sessionData.teacherEmail || "";
    appState.teacherPhone = sessionData.teacherPhone || "";
    appState.currentUser = sessionData.username || "";

    // Show dashboard
    window.showDashboard();

    // Load courses
    setTimeout(() => {
      loadCourses();
    }, 100);

    // Start session refresh
    startSessionRefresh();
    
    return true;
  } catch (e) {
    console.error("Auto-login error:", e);
    localStorage.removeItem("attendanceSession");
    showLoginScreen();
    return false;
  }
}

function showLoginScreen() {
  const loginScreen = document.getElementById("loginScreen");
  const welcomeScreen = document.getElementById("welcomeScreen");
  
  if (welcomeScreen) welcomeScreen.classList.add("hidden");
  if (loginScreen) loginScreen.classList.remove("hidden");
}

function startSessionRefresh() {
  setInterval(() => {
    if (appState.isAuthenticated) {
      const session = JSON.parse(localStorage.getItem("attendanceSession") || "{}");
      if (session.expires) {
        session.expires = new Date().getTime() + SECURITY_CONFIG.sessionTimeout;
        localStorage.setItem("attendanceSession", JSON.stringify(session));
      }
    }
  }, 30 * 60 * 1000); // Refresh every 30 minutes
}

// ==================== SCREEN MANAGEMENT ====================
window.showDashboard = function() {
  const loginScreen = document.getElementById("loginScreen");
  const dashboardScreen = document.getElementById("dashboardScreen");

  if (loginScreen) loginScreen.classList.add("hidden");
  if (dashboardScreen) {
    dashboardScreen.classList.remove("hidden");

    // Update teacher name display
    const teacherNameDisplay = document.getElementById("teacherNameDisplay");
    if (teacherNameDisplay) {
      teacherNameDisplay.textContent = appState.teacherName;
    }

    // Show quote
    showQuote();

    // Hide all modules initially
    hideAllModules();
    
    // Start auto-save if in attendance mode
    startAutoSave();
  }
}

function hideAllModules() {
  document.querySelectorAll(".module-container").forEach((module) => {
    module.classList.add("hidden");
  });
  currentModule = null;
}

// ==================== AUTO-SAVE FEATURE ====================
function startAutoSave() {
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  
  autoSaveInterval = setInterval(() => {
    if (appState.isAuthenticated && appState.courses.length > 0) {
      saveCourses();
      console.log('Auto-saved at', new Date().toISOString());
    }
  }, 60000); // Auto-save every minute
}

// ==================== REGISTRATION SYSTEM ====================
function setupRegistration() {
  const showRegisterBtn = document.getElementById("showRegister");
  const showLoginBtn = document.getElementById("showLogin");
  const registerBox = document.getElementById("registerBox");
  const loginBox = document.getElementById("loginBox");
  const registerForm = document.getElementById("registerForm");

  if (showRegisterBtn) {
    showRegisterBtn.onclick = (e) => {
      e.preventDefault();
      loginBox.classList.add("hidden");
      registerBox.classList.remove("hidden");
    };
  }

  if (showLoginBtn) {
    showLoginBtn.onclick = (e) => {
      e.preventDefault();
      registerBox.classList.add("hidden");
      loginBox.classList.remove("hidden");
    };
  }

  if (registerForm) {
    registerForm.addEventListener("submit", handleRegistration);
  }

  // Password toggle for registration
  setupPasswordToggle("toggleRegPass", "regPass");
  setupPasswordToggle("toggleRegPass2", "regPass2");
}

function handleRegistration(e) {
  e.preventDefault();

  const username = validateInput(document.getElementById("regUser")?.value || "", 'username');
  const teacherName = validateInput(document.getElementById("teacherNameReg")?.value || "", 'text');
  const password = document.getElementById("regPass")?.value || "";
  const confirmPassword = document.getElementById("regPass2")?.value || "";
  const hint = validateInput(document.getElementById("regHint")?.value || "", 'text');

  // Validation
  if (!username || !teacherName || !password || !confirmPassword) {
    showNotification("Please fill all required fields", "error");
    return;
  }

  if (password !== confirmPassword) {
    showNotification("Passwords do not match", "error");
    return;
  }

  const strength = checkPasswordStrength(password);
  if (strength === "weak") {
    showNotification("Password is too weak. Use at least 8 characters with uppercase, lowercase and numbers", "warning");
    return;
  }

  // Check if user already exists
  const users = JSON.parse(localStorage.getItem("attendanceUsers") || "[]");
  if (users.some((u) => u.username === username)) {
    showNotification("Username already exists", "error");
    return;
  }

  // Create new user with enhanced security
  const newUser = {
    username: username,
    password: hashPassword(password),
    teacherName: teacherName,
    hint: hint || "",
    createdAt: new Date().toISOString(),
    lastLogin: null,
    loginCount: 0
  };

  users.push(newUser);
  localStorage.setItem("attendanceUsers", JSON.stringify(users));

  // Auto login
  loginSuccess(newUser, teacherName);

  showNotification(
    "Registration successful! Welcome " + teacherName,
    "success",
  );

  // Switch to login view
  document.getElementById("registerBox").classList.add("hidden");
  document.getElementById("loginBox").classList.remove("hidden");
}

// ==================== ENHANCED LOGIN/LOGOUT ====================
function handleLogin(e) {
  e.preventDefault();

  const username = validateInput(document.getElementById("username")?.value || "", 'username');
  const password = document.getElementById("password")?.value || "";

  if (!username || !password) {
    showNotification("Please fill all fields", "error");
    return;
  }

  // Check if user exists
  const users = JSON.parse(localStorage.getItem("attendanceUsers") || "[]");
  const user = users.find((u) => u.username === username);

  if (user) {
    // Check password
    const hashedPassword = hashPassword(password);
    if (user.password === hashedPassword) {
      loginSuccess(user, user.teacherName);
    } else {
      showNotification("Invalid password", "error");
      // Increment failed attempts (for future rate limiting feature)
      user.failedAttempts = (user.failedAttempts || 0) + 1;
      localStorage.setItem("attendanceUsers", JSON.stringify(users));
    }
  } else {
    showNotification("User not found. Please register first.", "error");
    const showRegisterBtn = document.getElementById("showRegister");
    if (showRegisterBtn) showRegisterBtn.click();
  }
}

function loginSuccess(user, teacherName) {
  appState.isAuthenticated = true;
  appState.teacherName = teacherName;
  appState.currentUser = user.username;

  // Update user stats
  const users = JSON.parse(localStorage.getItem("attendanceUsers") || "[]");
  const userIndex = users.findIndex(u => u.username === user.username);
  if (userIndex > -1) {
    users[userIndex].lastLogin = new Date().toISOString();
    users[userIndex].loginCount = (users[userIndex].loginCount || 0) + 1;
    users[userIndex].failedAttempts = 0; // Reset failed attempts
    localStorage.setItem("attendanceUsers", JSON.stringify(users));
  }

  // Save session with enhanced security
  const sessionData = {
    username: user.username,
    teacherName: teacherName,
    expires: new Date().getTime() + SECURITY_CONFIG.sessionTimeout,
    version: SECURITY_CONFIG.dataVersion,
    loginTime: new Date().toISOString(),
    sessionId: CryptoJS.SHA256(Date.now() + user.username).toString()
  };
  localStorage.setItem("attendanceSession", JSON.stringify(sessionData));
  localStorage.setItem("teacherName", teacherName);

  // Start session refresh
  startSessionRefresh();

  // Show dashboard
  showDashboard();

  // Load courses
  loadCourses();

  showNotification("Login successful! Welcome " + teacherName, "success");
}

function handleLogout() {
  if (confirm("Are you sure you want to logout?")) {
    // Clear session data
    localStorage.removeItem("attendanceSession");
    
    // Clear app state
    appState.isAuthenticated = false;
    appState.teacherName = "";
    appState.currentUser = null;
    
    // Stop auto-save
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
      autoSaveInterval = null;
    }

    // Show login screen
    document.getElementById("dashboardScreen").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("hidden");

    // Clear form
    const loginForm = document.getElementById("loginForm");
    if (loginForm) loginForm.reset();

    showNotification("Logged out successfully", "success");
  }
}

// ==================== PASSWORD TOGGLE ====================
function setupPasswordToggle(toggleId, inputId) {
  const toggleBtn = document.getElementById(toggleId);
  const passwordInput = document.getElementById(inputId);

  if (toggleBtn && passwordInput) {
    toggleBtn.onclick = () => {
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
      } else {
        passwordInput.type = "password";
        toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
      }
    };
  }
}

// ==================== ENHANCED PASSWORD RESET ====================
function setupPasswordReset() {
  const resetLink = document.getElementById("resetPasswordLink");
  const resetModal = document.getElementById("passwordResetModal");
  const cancelResetBtn = document.getElementById("cancelResetBtn");
  const confirmResetBtn = document.getElementById("confirmResetBtn");

  if (resetLink) {
    resetLink.onclick = (e) => {
      e.preventDefault();
      if (resetModal) resetModal.classList.remove("hidden");
    };
  }

  if (cancelResetBtn) {
    cancelResetBtn.onclick = () => {
      if (resetModal) resetModal.classList.add("hidden");
      const resetUsername = document.getElementById("resetUsername");
      const newPassword = document.getElementById("newPassword");
      const confirmPassword = document.getElementById("confirmPassword");
      
      if (resetUsername) resetUsername.value = "";
      if (newPassword) newPassword.value = "";
      if (confirmPassword) confirmPassword.value = "";
    };
  }

  if (confirmResetBtn) {
    confirmResetBtn.onclick = () => {
      const username = validateInput(document.getElementById("resetUsername")?.value || "", 'username');
      const newPassword = document.getElementById("newPassword")?.value || "";
      const confirmPassword = document.getElementById("confirmPassword")?.value || "";

      if (!username || !newPassword || !confirmPassword) {
        showNotification("Please fill all fields", "error");
        return;
      }

      if (newPassword !== confirmPassword) {
        showNotification("Passwords do not match", "error");
        return;
      }

      // Check password strength
      const strength = checkPasswordStrength(newPassword);
      if (strength === "weak") {
        showNotification(
          "Password is too weak. Use at least 8 characters with uppercase, lowercase and numbers",
          "warning",
        );
        return;
      }

      // Update password
      const users = JSON.parse(localStorage.getItem("attendanceUsers") || "[]");
      const userIndex = users.findIndex((u) => u.username === username);

      if (userIndex === -1) {
        showNotification("User not found", "error");
        return;
      }

      users[userIndex].password = hashPassword(newPassword);
      users[userIndex].updatedAt = new Date().toISOString();
      users[userIndex].passwordChanged = new Date().toISOString();

      localStorage.setItem("attendanceUsers", JSON.stringify(users));

      if (resetModal) resetModal.classList.add("hidden");
      const resetUsername = document.getElementById("resetUsername");
      const newPass = document.getElementById("newPassword");
      const confirmPass = document.getElementById("confirmPassword");
      
      if (resetUsername) resetUsername.value = "";
      if (newPass) newPass.value = "";
      if (confirmPass) confirmPass.value = "";

      showNotification("Password reset successful!", "success");
    };
  }

  // Setup password toggles for reset modal
  setupPasswordToggle("toggleNewPass", "newPassword");
  setupPasswordToggle("toggleConfirmPass", "confirmPassword");
}

// ==================== YEAR MANAGEMENT ====================
function setupYearManagement() {
  const addYearBtn = document.getElementById("addYearBtn");
  const delYearBtn = document.getElementById("delYearBtn");

  if (addYearBtn) {
    addYearBtn.onclick = () => {
      const yearInput = document.getElementById("newYear");
      const year = validateInput(yearInput?.value || "", 'year');

      if (!year || year.length !== 4) {
        showNotification("Please enter a valid 4-digit year", "error");
        return;
      }

      const currentYear = new Date().getFullYear();
      if (parseInt(year) < 2000 || parseInt(year) > currentYear + 5) {
        showNotification(`Year must be between 2000 and ${currentYear + 5}`, "error");
        return;
      }

      // Save current year to app state
      appState.currentYear = year;

      // Refresh courses display
      loadLiveCourses();

      if (yearInput) yearInput.value = "";
      showNotification(`Year ${year} added successfully`, "success");
    };
  }

  if (delYearBtn) {
    delYearBtn.onclick = () => {
      const yearInput = document.getElementById("delYear");
      const year = validateInput(yearInput?.value || "", 'year');

      if (!year) {
        showNotification("Please enter a year to delete", "error");
        return;
      }

      // Get current user for password verification
      const users = JSON.parse(localStorage.getItem("attendanceUsers") || "[]");
      const currentUser = users.find(
        (u) => u.username === appState.currentUser,
      );

      if (!currentUser) {
        showNotification("User not found", "error");
        return;
      }

      const password = prompt(
        `To delete year ${year}, please enter your password:`,
      );
      if (!password) return;

      // Verify password
      if (hashPassword(password) !== currentUser.password) {
        showNotification("Incorrect password", "error");
        return;
      }

      // Delete courses for this year
      const originalLength = appState.courses.length;
      appState.courses = appState.courses.filter((course) => {
        // For M.A. courses, check differently
        if (course.year === "M.A.") {
          return true; // Keep M.A. courses
        }
        return course.year !== year;
      });

      const deletedCount = originalLength - appState.courses.length;
      saveCourses();
      loadLiveCourses();

      if (yearInput) yearInput.value = "";
      showNotification(
        `Year ${year} deleted. Removed ${deletedCount} courses.`,
        "success",
      );
    };
  }
}

// ==================== MODULE MANAGEMENT ====================
function showModule(moduleId) {
  hideAllModules();

  const module = document.getElementById(moduleId);
  if (module) {
    module.classList.remove("hidden");
    currentModule = moduleId;

    // Initialize module specific content
    switch (moduleId) {
      case "attendanceModule":
        loadLiveCourses();
        break;
      case "searchModule":
        populateSearchCourses();
        break;
      case "dataModule":
        populateImportCourseSelect();
        populateManualCourseSelect();
        break;
    }
  }
}

// ==================== COURSE MANAGEMENT ====================
function loadCourses() {
  const savedCourses = localStorage.getItem("attendanceCourses");

  if (savedCourses) {
    try {
      const data = JSON.parse(savedCourses);
      if (data.version === SECURITY_CONFIG.dataVersion) {
        appState.courses = data.courses || [];
      } else {
        appState.courses = migrateData(data);
      }
    } catch (error) {
      console.error("Error loading courses:", error);
      appState.courses = [];
      showNotification("Error loading course data", "error");
    }
  } else {
    appState.courses = [];
  }

  saveCourses();
}

function saveCourses() {
  try {
    const data = {
      version: SECURITY_CONFIG.dataVersion,
      courses: appState.courses,
      lastUpdated: new Date().toISOString(),
      backupId: CryptoJS.SHA256(Date.now() + JSON.stringify(appState.courses)).toString().substring(0, 10)
    };
    localStorage.setItem("attendanceCourses", JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save courses:", error);
    showNotification("Failed to save data. Please check storage space.", "error");
  }
}

function loadLiveCourses() {
  const liveCoursesDiv = document.getElementById("liveCourses");
  if (!liveCoursesDiv) return;

  liveCoursesDiv.innerHTML = "";

  if (appState.courses.length === 0) {
    liveCoursesDiv.innerHTML = `
      <div class="no-courses">
        <i class="fas fa-book"></i>
        <p>No courses available</p>
        <p>Create your first course to start taking attendance</p>
      </div>
    `;
    return;
  }

  // Group courses by year
  const coursesByYear = {};
  appState.courses.forEach((course) => {
    const yearDisplay = formatYear(course.year, appState.currentYear);
    
    if (!coursesByYear[yearDisplay]) {
      coursesByYear[yearDisplay] = [];
    }
    coursesByYear[yearDisplay].push(course);
  });

  // Display courses
  Object.keys(coursesByYear)
    .sort((a, b) => {
      // Sort years properly
      if (a === "M.A.") return 1;
      if (b === "M.A.") return -1;
      return a.localeCompare(b);
    })
    .forEach((year) => {
      const yearSection = document.createElement("div");
      yearSection.className = "year-section";
      yearSection.innerHTML = `<h4>${year}</h4>`;

      const coursesGrid = document.createElement("div");
      coursesGrid.className = "courses-grid";

      coursesByYear[year].forEach((course) => {
        const courseBtn = document.createElement("button");
        courseBtn.className = "course-btn";
        courseBtn.innerHTML = `
          <div class="course-code">${course.id}</div>
          <div class="course-name">${course.name}</div>
          ${course.group ? `<div class="course-group">Group ${course.group}</div>` : ""}
          <div class="course-stats">${course.students?.length || 0} students</div>
        `;

        courseBtn.onclick = () => startAttendanceForCourse(course.id);

        coursesGrid.appendChild(courseBtn);
      });

      yearSection.appendChild(coursesGrid);
      liveCoursesDiv.appendChild(yearSection);
    });
}

function showNewCourseModal() {
  const modal = document.getElementById("newCourseModal");
  const teacherInput = document.getElementById("courseTeacher");
  const yearSelect = document.getElementById("courseYear");
  const groupSection = document.getElementById("groupSection");

  if (teacherInput) {
    teacherInput.value = appState.teacherName;
  }

  // Show/hide group section based on year selection
  if (yearSelect && groupSection) {
    yearSelect.onchange = function () {
      if (this.value === "M.A.") {
        groupSection.classList.remove("hidden");
        const courseGroup = document.getElementById("courseGroup");
        if (courseGroup) courseGroup.required = true;
      } else {
        groupSection.classList.add("hidden");
        const courseGroup = document.getElementById("courseGroup");
        if (courseGroup) courseGroup.required = false;
      }
    };
  }

  if (modal) modal.classList.remove("hidden");
}

function createNewCourse() {
  const courseCode = validateInput(document.getElementById("courseCode")?.value || "", 'text').toUpperCase();
  const courseName = validateInput(document.getElementById("courseName")?.value || "", 'text');
  const year = document.getElementById("courseYear")?.value;
  const group = document.getElementById("courseGroup")?.value;
  const teacher = validateInput(document.getElementById("courseTeacher")?.value || "", 'text');

  // Validation
  if (!courseCode || !courseName || !year) {
    showNotification("Please fill all required fields", "error");
    return;
  }

  // Check if M.A. course needs group
  if (year === "M.A." && !group) {
    showNotification(
      "M.A. course requires a group selection",
      "error",
    );
    return;
  }

  // Check if course already exists
  if (appState.courses.some((c) => c.id === courseCode)) {
    showNotification(`Course ${courseCode} already exists`, "error");
    return;
  }

  const newCourse = {
    id: courseCode,
    name: courseName,
    year: year,
    group: year === "M.A." ? group : null,
    teacher: teacher,
    created: new Date().toISOString(),
    students: [],
    dates: [],
    attendance: {},
  };

  appState.courses.push(newCourse);
  saveCourses();

  // Close modal
  const modal = document.getElementById("newCourseModal");
  if (modal) modal.classList.add("hidden");

  // Clear form
  const courseCodeInput = document.getElementById("courseCode");
  const courseNameInput = document.getElementById("courseName");
  const courseYearSelect = document.getElementById("courseYear");
  const courseGroupSelect = document.getElementById("courseGroup");
  
  if (courseCodeInput) courseCodeInput.value = "";
  if (courseNameInput) courseNameInput.value = "";
  if (courseYearSelect) courseYearSelect.value = "";
  if (courseGroupSelect) courseGroupSelect.value = "";

  // Refresh live courses
  loadLiveCourses();

  showNotification(`Course ${courseCode} created successfully`, "success");
}

// ==================== MANUAL STUDENT ADD ====================
function setupManualStudentAdd() {
  const addStuBtn = document.getElementById("addStuBtn");
  const addStuBtn2 = document.getElementById("addStuBtn2");

  if (addStuBtn) {
    addStuBtn.onclick = () => {
      if (!appState.currentCourse) {
        showNotification("Please select a course first", "error");
        return;
      }
      addStudentToCourse(
        appState.currentCourse.id,
        "stuName",
        "stuRoll",
        "stuReg",
      );
    };
  }

  if (addStuBtn2) {
    addStuBtn2.onclick = () => {
      const courseSelect = document.getElementById("manualCourseSelect");
      const courseId = courseSelect?.value;

      if (!courseId) {
        showNotification("Please select a course", "error");
        return;
      }

      addStudentToCourse(courseId, "stuName2", "stuRoll2", "stuReg2");
    };
  }
}

function addStudentToCourse(courseId, nameFieldId, rollFieldId, regFieldId) {
  const course = appState.courses.find((c) => c.id === courseId);
  if (!course) {
    showNotification("Course not found", "error");
    return;
  }

  const name = validateInput(document.getElementById(nameFieldId)?.value || "", 'text');
  const roll = validateInput(document.getElementById(rollFieldId)?.value || "", 'number');
  const reg = validateInput(document.getElementById(regFieldId)?.value || "", 'number');

  if (!name || !roll) {
    showNotification("Name and Roll Number are required", "error");
    return;
  }

  // Check if student already exists
  if (course.students.some((s) => s.id === roll)) {
    showNotification(
      "Student with this roll number already exists",
      "error",
    );
    return;
  }

  const newStudent = {
    id: roll,
    name: name,
    registration: reg || "",
    added: new Date().toISOString(),
  };

  course.students.push(newStudent);
  saveCourses();

  // Clear form
  const nameInput = document.getElementById(nameFieldId);
  const rollInput = document.getElementById(rollFieldId);
  const regInput = document.getElementById(regFieldId);
  
  if (nameInput) nameInput.value = "";
  if (rollInput) rollInput.value = "";
  if (regInput) regInput.value = "";

  showNotification(`Student ${name} added to ${course.id}`, "success");
}

// ==================== POPULATE COURSE SELECTS ====================
function populateSearchCourses() {
  const searchCourseSelect = document.getElementById("searchCourse");
  if (!searchCourseSelect) return;

  searchCourseSelect.innerHTML = '<option value="">Select Course</option>';
  appState.courses.forEach((course) => {
    const option = document.createElement("option");
    option.value = course.id;
    option.textContent = `${course.id} - ${course.name}`;
    searchCourseSelect.appendChild(option);
  });
}

function populateImportCourseSelect() {
  const importSelect = document.getElementById("importCourseSelect");
  if (!importSelect) return;

  importSelect.innerHTML = '<option value="">Select Course</option>';
  appState.courses.forEach((course) => {
    const option = document.createElement("option");
    option.value = course.id;
    option.textContent = `${course.id} - ${course.name}`;
    importSelect.appendChild(option);
  });
}

function populateManualCourseSelect() {
  const manualSelect = document.getElementById("manualCourseSelect");
  if (!manualSelect) return;

  manualSelect.innerHTML = '<option value="">Select Course</option>';
  appState.courses.forEach((course) => {
    const option = document.createElement("option");
    option.value = course.id;
    option.textContent = `${course.id} - ${course.name}`;
    manualSelect.appendChild(option);
  });
}

// ==================== ENHANCED ATTENDANCE MANAGEMENT ====================
function startAttendanceForCourse(courseId) {
  const course = appState.courses.find((c) => c.id === courseId);
  if (!course) {
    showNotification("Course not found", "error");
    return;
  }

  // Check if attendance already taken today
  const today = new Date().toISOString().split("T")[0];
  if (course.dates.includes(today)) {
    const confirmResume = confirm(
      "Attendance for this course has already been taken today.\nDo you want to edit previous data?"
    );
    if (!confirmResume) return;
  }

  // Check if course has students
  if (course.students.length === 0) {
    showNotification(
      "No students in this course. Please add students first.",
      "error",
    );
    return;
  }

  // Start attendance process
  appState.currentCourse = course;

  // Initialize attendance for today if not exists
  if (!course.dates.includes(today)) {
    course.dates.push(today);
    course.dates.sort();
  }

  if (!course.attendance[today]) {
    course.attendance[today] = {};
    // Set all students as absent initially
    course.students.forEach((student) => {
      course.attendance[today][student.id] = "absent";
    });
  }

  saveCourses();

  // Setup attendance state
  attendanceState = {
    isActive: true,
    currentDate: today,
    studentList: [...course.students],
    currentIndex: 0,
  };

  // Show attendance popup
  showAttendancePopup();
}

function showAttendancePopup() {
  const popup = document.createElement("div");
  popup.className = "modal";
  popup.innerHTML = `
    <div class="modal-content">
      <h3><i class="fas fa-clipboard-check"></i> Taking Attendance</h3>
      <div class="popup-body">
        <div id="currentStudentInfo" class="student-info">
          <p>Course: <strong>${appState.currentCourse?.id}</strong></p>
          <p>Date: <strong>${attendanceState.currentDate}</strong></p>
          <hr>
          <div id="studentDisplay"></div>
        </div>
        <div class="attendance-buttons" style="display: flex; gap: 1rem; margin: 1rem 0;">
          <button id="markPresent" class="btn btn-success" style="flex: 1;">Present ✓</button>
          <button id="markAbsent" class="btn btn-danger" style="flex: 1;">Absent ✗</button>
        </div>
        <div class="attendance-actions">
          <button id="markAllPresent" class="btn btn-sm" style="background: #2ecc71; color: white;">Mark All Present</button>
          <button id="markAllAbsent" class="btn btn-sm" style="background: #e74c3c; color: white;">Mark All Absent</button>
          <button id="skipStudent" class="btn btn-sm" style="background: #f39c12; color: white;">Skip</button>
        </div>
        <div class="progress" style="margin-top: 1rem;">
          <div style="background: #ddd; height: 10px; border-radius: 5px; overflow: hidden;">
            <div id="progressBar" style="background: #3498db; height: 100%; width: 0%; transition: width 0.3s;"></div>
          </div>
          <p id="progressText" style="text-align: center; margin-top: 0.5rem; font-size: 0.9rem;"></p>
        </div>
        <div class="modal-buttons">
          <button id="completeAttendance" class="btn btn-primary">Complete</button>
          <button id="cancelAttendance" class="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Show first student
  showNextStudentInPopup();

  // Keyboard shortcuts
  const keyHandler = (e) => {
    if (!attendanceState.isActive) return;
    
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      markStudent("present");
    } else if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      markStudent("absent");
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      skipStudent();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      const cancelBtn = document.getElementById("cancelAttendance");
      if (cancelBtn) cancelBtn.click();
    }
  };
  
  document.addEventListener('keydown', keyHandler);

  // Event listeners
  const markPresentBtn = document.getElementById("markPresent");
  const markAbsentBtn = document.getElementById("markAbsent");
  const skipStudentBtn = document.getElementById("skipStudent");
  const markAllPresentBtn = document.getElementById("markAllPresent");
  const markAllAbsentBtn = document.getElementById("markAllAbsent");
  const completeAttendanceBtn = document.getElementById("completeAttendance");
  const cancelAttendanceBtn = document.getElementById("cancelAttendance");

  if (markPresentBtn) markPresentBtn.onclick = () => markStudent("present");
  if (markAbsentBtn) markAbsentBtn.onclick = () => markStudent("absent");
  if (skipStudentBtn) skipStudentBtn.onclick = skipStudent;
  if (markAllPresentBtn) markAllPresentBtn.onclick = () => markAllStudents("present");
  if (markAllAbsentBtn) markAllAbsentBtn.onclick = () => markAllStudents("absent");
  if (completeAttendanceBtn) completeAttendanceBtn.onclick = completeAttendance;
  if (cancelAttendanceBtn) {
    cancelAttendanceBtn.onclick = () => {
      document.removeEventListener('keydown', keyHandler);
      popup.remove();
      attendanceState.isActive = false;
      
      // Ask for confirmation
      if (confirm("Are you sure you want to cancel? All unsaved changes will be lost.")) {
        showNotification("Attendance cancelled", "info");
      }
    };
  }
}

function showNextStudentInPopup() {
  if (attendanceState.currentIndex >= attendanceState.studentList.length) {
    completeAttendance();
    return;
  }

  const student = attendanceState.studentList[attendanceState.currentIndex];
  const studentDisplay = document.getElementById("studentDisplay");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  if (studentDisplay) {
    studentDisplay.innerHTML = `
      <h4>Student ${attendanceState.currentIndex + 1} of ${attendanceState.studentList.length}</h4>
      <p><strong>ID:</strong> ${student.id}</p>
      <p><strong>Name:</strong> ${student.name}</p>
      ${student.registration ? `<p><strong>Registration:</strong> ${student.registration}</p>` : ""}
      <p><small>Press P for Present, A for Absent, S to Skip</small></p>
    `;
  }

  if (progressBar && progressText) {
    const progress = ((attendanceState.currentIndex + 1) / attendanceState.studentList.length) * 100;
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${attendanceState.currentIndex + 1}/${attendanceState.studentList.length} students`;
  }
}

function markStudent(status) {
  const student = attendanceState.studentList[attendanceState.currentIndex];
  const course = appState.currentCourse;
  const today = attendanceState.currentDate;

  if (course && course.attendance[today]) {
    course.attendance[today][student.id] = status;
    saveCourses();
    provideHapticFeedback();
  }

  attendanceState.currentIndex++;
  showNextStudentInPopup();
}

function skipStudent() {
  attendanceState.currentIndex++;
  showNextStudentInPopup();
  showNotification("Student skipped", "warning", 2000);
}

function markAllStudents(status) {
  if (!confirm(`Mark ALL students as ${status}?`)) return;
  
  const course = appState.currentCourse;
  const today = attendanceState.currentDate;
  
  if (course && course.attendance[today]) {
    attendanceState.studentList.forEach(student => {
      course.attendance[today][student.id] = status;
    });
    saveCourses();
    
    // Jump to end
    attendanceState.currentIndex = attendanceState.studentList.length;
    showNextStudentInPopup();
    
    showNotification(`All students marked as ${status}`, "success");
  }
}

function completeAttendance() {
  // Remove popup and keyboard listener
  const popup = document.querySelector(".modal");
  if (popup) popup.remove();
  
  attendanceState.isActive = false;
  
  // Remove keyboard listener
  const keyHandler = (e) => {
    if (!attendanceState.isActive) return;
    // ... existing key handler code
  };
  document.removeEventListener('keydown', keyHandler);

  // Show summary popup
  showSummaryPopup();

  showNotification("Attendance completed successfully!", "success");
}

function showSummaryPopup() {
  const popup = document.getElementById("summaryPopup");
  if (popup) {
    popup.classList.remove("hidden");
  }
}

// ==================== ENHANCED SUMMARY & SHARING ====================
function exportAttendanceSummary() {
  const course = appState.currentCourse;
  if (!course) return;

  try {
    // Prepare Excel data
    const data = [];
    const today = attendanceState.currentDate || new Date().toISOString().split("T")[0];

    // Headers
    data.push(["Attendance Summary", "", "", ""]);
    data.push(["Course:", course.id, "Date:", today]);
    data.push(["Course Name:", course.name, "Teacher:", course.teacher]);
    data.push([
      "Year:",
      formatYear(course.year, appState.currentYear),
      "Total Students:",
      course.students.length
    ]);
    data.push([]);
    data.push(["Sl No", "Student ID", "Student Name", "Registration No", "Status"]);

    // Student data
    course.students.forEach((student, index) => {
      const status =
        course.attendance[today] &&
        course.attendance[today][student.id] === "present"
          ? "Present"
          : "Absent";
      data.push([index + 1, student.id, student.name, student.registration || "", status]);
    });

    // Summary
    data.push([]);
    const totalStudents = course.students.length;
    const presentCount = course.students.filter(
      (s) =>
        course.attendance[today] &&
        course.attendance[today][s.id] === "present",
    ).length;
    const absentCount = totalStudents - presentCount;
    const percentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

    data.push(["Summary", "", "", "", ""]);
    data.push(["Total Students:", totalStudents]);
    data.push(["Present:", presentCount]);
    data.push(["Absent:", absentCount]);
    data.push(["Attendance Percentage:", percentage + "%"]);

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Set column widths
    const wscols = [
      {wch: 8},  // Sl No
      {wch: 12}, // Student ID
      {wch: 25}, // Student Name
      {wch: 15}, // Registration No
      {wch: 10}  // Status
    ];
    ws['!cols'] = wscols;
    
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");

    // Save file
    const filename = `${course.id}_attendance_${today}.xlsx`;
    XLSX.writeFile(wb, filename);

    // Close summary popup
    const summaryPopup = document.getElementById("summaryPopup");
    if (summaryPopup) summaryPopup.classList.add("hidden");

    showNotification(`Attendance saved as ${filename}`, "success");
    
    // Also create CSV version
    exportToCSV(data, filename.replace('.xlsx', '.csv'));
  } catch (error) {
    console.error("Export error:", error);
    showNotification("Failed to export attendance", "error");
  }
}

function exportToCSV(data, filename) {
  try {
    const csvContent = data.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("CSV export error:", error);
  }
}

function shareAttendance() {
  // Show share options popup
  const sharePopup = document.getElementById("shareOptionsPopup");
  if (sharePopup) {
    sharePopup.classList.remove("hidden");
  }
}

function shareViaEmail() {
  const course = appState.currentCourse;
  if (!course) return;

  const today = attendanceState.currentDate || new Date().toLocaleDateString("en-GB");
  const subject = `Attendance Summary - ${course.id} - ${today}`;
  const body = `Please find attached the attendance summary for ${course.id} (${course.name}) on ${today}.\n\nTeacher: ${course.teacher}\nTotal Students: ${course.students.length}`;

  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function shareViaWhatsApp() {
  const course = appState.currentCourse;
  if (!course) return;

  const today = attendanceState.currentDate || new Date().toLocaleDateString("en-GB");
  const text = `*Attendance Summary*\n\n*Course:* ${course.id} - ${course.name}\n*Date:* ${today}\n*Teacher:* ${course.teacher}\n\nPlease check the attached Excel file for details.`;

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

function shareViaMessenger() {
  showNotification("Messenger sharing coming soon", "info");
}

// ==================== ENHANCED SEARCH & CORRECTION ====================
function searchAttendance() {
  const date = document.getElementById("searchDate")?.value;
  const courseId = document.getElementById("searchCourse")?.value;
  const searchTerm = validateInput(document.getElementById("searchStudentId")?.value || "", 'text').toLowerCase();

  if (!date || !courseId) {
    showNotification("Please select date and course", "error");
    return;
  }

  const course = appState.courses.find((c) => c.id === courseId);
  if (!course) return;

  // Check if date exists
  if (!course.dates.includes(date)) {
    showNotification("No attendance record for this date", "error");
    return;
  }

  const resultsDiv = document.getElementById("searchResults");
  if (!resultsDiv) return;

  resultsDiv.innerHTML = "";
  resultsDiv.classList.remove("hidden");

  let filteredStudents = course.students;
  if (searchTerm) {
    filteredStudents = filteredStudents.filter(
      (s) =>
        s.id.toLowerCase().includes(searchTerm) ||
        s.name.toLowerCase().includes(searchTerm),
    );
  }

  if (filteredStudents.length === 0) {
    resultsDiv.innerHTML = "<p class='no-results'>No students found</p>";
    return;
  }

  // Add search statistics
  const stats = document.createElement("div");
  stats.className = "search-stats";
  stats.innerHTML = `<p>Found ${filteredStudents.length} student(s)</p>`;
  resultsDiv.appendChild(stats);

  filteredStudents.forEach((student) => {
    const status =
      (course.attendance[date] && course.attendance[date][student.id]) ||
      "absent";

    const card = document.createElement("div");
    card.className = "student-card";
    card.innerHTML = `
      <div>
        <strong>${student.id}</strong><br>
        ${student.name}<br>
        <small>${student.registration || ""}</small>
      </div>
      <div>
        <span class="status ${status}">${status.toUpperCase()}</span>
        <button onclick="correctAttendance('${courseId}', '${student.id}', '${date}', 'present')" 
                class="btn btn-sm present-btn" title="Mark as Present">Present</button>
        <button onclick="correctAttendance('${courseId}', '${student.id}', '${date}', 'absent')" 
                class="btn btn-sm absent-btn" title="Mark as Absent">Absent</button>
      </div>
    `;

    resultsDiv.appendChild(card);
  });
}

function correctAttendance(courseId, studentId, date, newStatus) {
  const course = appState.courses.find((c) => c.id === courseId);
  if (!course) return;

  if (!course.attendance[date]) {
    course.attendance[date] = {};
  }

  const oldStatus = course.attendance[date][studentId] || "absent";
  course.attendance[date][studentId] = newStatus;
  saveCourses();

  // Refresh search results
  searchAttendance();

  showNotification(
    `Corrected ${studentId} from ${oldStatus} to ${newStatus}`,
    "success",
  );
}

// ==================== ENHANCED DATA MANAGEMENT ====================
function backupData() {
  try {
    const backup = {
      version: SECURITY_CONFIG.dataVersion,
      courses: appState.courses,
      users: JSON.parse(localStorage.getItem("attendanceUsers") || "[]"),
      timestamp: new Date().toISOString(),
      teacherName: appState.teacherName,
      currentYear: appState.currentYear,
      backupId: CryptoJS.SHA256(Date.now() + appState.teacherName).toString().substring(0, 16),
      dataHash: CryptoJS.SHA256(JSON.stringify(appState.courses)).toString()
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-backup-${new Date().toISOString().split("T")[0]}-${backup.backupId}.json`;
    a.click();

    URL.revokeObjectURL(url);

    showNotification("Backup created successfully", "success");
  } catch (error) {
    console.error("Backup error:", error);
    showNotification("Failed to create backup", "error");
  }
}

function verifyBackup(backupData) {
  const requiredKeys = ['version', 'courses', 'timestamp', 'backupId'];
  if (!requiredKeys.every(key => key in backupData)) {
    return false;
  }
  
  if (backupData.version !== SECURITY_CONFIG.dataVersion) {
    if (!confirm(`Backup version (${backupData.version}) differs from current (${SECURITY_CONFIG.dataVersion}). Continue?`)) {
      return false;
    }
  }
  
  return true;
}

function restoreData(file) {
  if (!confirm("Restore will replace all current data. Continue?")) {
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const backup = JSON.parse(e.target.result);

      if (!verifyBackup(backup)) {
        showNotification("Invalid or incompatible backup file", "error");
        return;
      }

      appState.courses = backup.courses || [];
      if (backup.users) {
        localStorage.setItem("attendanceUsers", JSON.stringify(backup.users));
      }
      if (backup.currentYear) {
        appState.currentYear = backup.currentYear;
      }

      saveCourses();
      loadLiveCourses();

      showNotification("Data restored successfully from " + new Date(backup.timestamp).toLocaleString(), "success");
    } catch (error) {
      console.error("Restore error:", error);
      showNotification("Failed to restore: " + error.message, "error");
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm("WARNING: This will delete ALL data including courses, attendance records, and user accounts. Are you sure?")) {
    return;
  }

  const verification = prompt('Type "DELETE ALL DATA" to confirm:');
  if (verification !== "DELETE ALL DATA") {
    showNotification("Deletion cancelled", "info");
    return;
  }

  // Final confirmation
  if (!confirm("This is your final warning. This action cannot be undone. Proceed?")) {
    showNotification("Deletion cancelled", "info");
    return;
  }

  appState.courses = [];
  localStorage.removeItem("attendanceCourses");
  localStorage.removeItem("attendanceUsers");
  localStorage.removeItem("attendanceSession");

  saveCourses();
  loadLiveCourses();

  // Logout user
  appState.isAuthenticated = false;
  const dashboardScreen = document.getElementById("dashboardScreen");
  const loginScreen = document.getElementById("loginScreen");
  
  if (dashboardScreen) dashboardScreen.classList.add("hidden");
  if (loginScreen) loginScreen.classList.remove("hidden");

  showNotification("All data cleared. You have been logged out.", "success");
}

// ==================== ENHANCED CSV IMPORT ====================
function importCSVData(file) {
  const courseId = document.getElementById("importCourseSelect")?.value;
  if (!courseId) {
    showNotification("Please select a course first", "error");
    return;
  }

  const course = appState.courses.find((c) => c.id === courseId);
  if (!course) {
    showNotification("Course not found", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const content = e.target.result;
      const lines = content.split("\n");
      let imported = 0;
      let skipped = 0;
      let errors = 0;

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || index === 0) return; // Skip empty lines and header

        const parts = trimmed.split(",").map((p) => p.trim());
        if (parts.length >= 2) {
          const [studentId, studentName, ...rest] = parts;
          
          // Validate data
          if (!studentId || !studentName) {
            errors++;
            return;
          }

          // Check if student already exists
          if (course.students.some((s) => s.id === studentId)) {
            skipped++;
            return;
          }

          const newStudent = {
            id: validateInput(studentId, 'number'),
            name: validateInput(studentName, 'text'),
            registration: rest[0] ? validateInput(rest[0], 'number') : "",
            added: new Date().toISOString(),
          };

          course.students.push(newStudent);
          imported++;
        }
      });

      saveCourses();
      
      let message = `Imported ${imported} students`;
      if (skipped > 0) message += `, skipped ${skipped} duplicates`;
      if (errors > 0) message += `, ${errors} invalid records`;
      
      showNotification(message, "success");
    } catch (error) {
      console.error("CSV import error:", error);
      showNotification("Failed to import CSV file. Please check format.", "error");
    }
  };
  reader.readAsText(file);
}

// ==================== DATA SYNC FUNCTIONALITY ====================
function syncData() {
  if (!navigator.onLine) {
    console.log("Offline - skipping sync");
    return;
  }
  
  // This is a placeholder for future cloud sync implementation
  console.log("Data sync placeholder - would sync to cloud here");
  
  // For now, just backup to localStorage as a sync checkpoint
  try {
    const syncCheckpoint = {
      lastSync: new Date().toISOString(),
      coursesCount: appState.courses.length,
      totalStudents: appState.courses.reduce((sum, course) => sum + (course.students?.length || 0), 0)
    };
    localStorage.setItem("lastSync", JSON.stringify(syncCheckpoint));
  } catch (error) {
    console.error("Sync checkpoint error:", error);
  }
}

// ==================== ATTENDANCE ANALYTICS ====================
function generateAttendanceAnalytics(courseId) {
  const course = appState.courses.find(c => c.id === courseId);
  if (!course || !course.students.length) return null;
  
  const analytics = {
    totalStudents: course.students.length,
    totalDays: course.dates.length,
    studentStats: [],
    overallAttendance: 0
  };
  
  if (course.dates.length === 0) return analytics;
  
  // Calculate per-student attendance
  course.students.forEach(student => {
    let presentDays = 0;
    course.dates.forEach(date => {
      if (course.attendance[date] && course.attendance[date][student.id] === 'present') {
        presentDays++;
      }
    });
    
    const percentage = course.dates.length > 0 ? Math.round((presentDays / course.dates.length) * 100) : 0;
    
    analytics.studentStats.push({
      id: student.id,
      name: student.name,
      presentDays,
      percentage,
      status: percentage >= 75 ? 'Good' : percentage >= 50 ? 'Average' : 'Poor'
    });
  });
  
  // Calculate overall attendance
  const totalPossible = course.students.length * course.dates.length;
  let totalPresent = 0;
  
  course.dates.forEach(date => {
    if (course.attendance[date]) {
      Object.values(course.attendance[date]).forEach(status => {
        if (status === 'present') totalPresent++;
      });
    }
  });
  
  analytics.overallAttendance = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;
  
  return analytics;
}

// ==================== EVENT LISTENERS SETUP ====================
function setupEventListeners() {
  // Password toggle for login
  setupPasswordToggle("togglePassword", "password");

  // Registration system
  setupRegistration();

  // Login Form
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  // Logout Button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  // Password Reset
  setupPasswordReset();

  // Dashboard Modules
  const btnAttendance = document.getElementById("btnAttendance");
  const btnSearch = document.getElementById("btnSearch");
  const btnData = document.getElementById("btnData");
  
  if (btnAttendance) {
    btnAttendance.addEventListener("click", () => showModule("attendanceModule"));
  }
  if (btnSearch) {
    btnSearch.addEventListener("click", () => showModule("searchModule"));
  }
  if (btnData) {
    btnData.addEventListener("click", () => showModule("dataModule"));
  }

  // Attendance Module
  const btnNewCourse = document.getElementById("btnNewCourse");
  const saveCourseBtn = document.getElementById("saveCourseBtn");
  const cancelCourseBtn = document.getElementById("cancelCourseBtn");
  
  if (btnNewCourse) {
    btnNewCourse.addEventListener("click", showNewCourseModal);
  }
  if (saveCourseBtn) {
    saveCourseBtn.addEventListener("click", createNewCourse);
  }
  if (cancelCourseBtn) {
    cancelCourseBtn.addEventListener("click", () => {
      const modal = document.getElementById("newCourseModal");
      if (modal) modal.classList.add("hidden");
    });
  }

  // Year Management
  setupYearManagement();

  // Manual Student Add
  setupManualStudentAdd();

  // Summary Popup
  const saveExcelBtn = document.getElementById("saveExcelBtn");
  const shareSummaryBtn = document.getElementById("shareSummaryBtn");
  const closeSummaryBtn = document.getElementById("closeSummaryBtn");
  
  if (saveExcelBtn) {
    saveExcelBtn.addEventListener("click", exportAttendanceSummary);
  }
  if (shareSummaryBtn) {
    shareSummaryBtn.addEventListener("click", shareAttendance);
  }
  if (closeSummaryBtn) {
    closeSummaryBtn.addEventListener("click", () => {
      const summaryPopup = document.getElementById("summaryPopup");
      if (summaryPopup) summaryPopup.classList.add("hidden");
    });
  }

  // Share Options
  const shareEmailBtn = document.getElementById("shareEmailBtn");
  const shareWhatsappBtn = document.getElementById("shareWhatsappBtn");
  const shareMessengerBtn = document.getElementById("shareMessengerBtn");
  const closeSharePopupBtn = document.getElementById("closeSharePopupBtn");
  
  if (shareEmailBtn) {
    shareEmailBtn.addEventListener("click", shareViaEmail);
  }
  if (shareWhatsappBtn) {
    shareWhatsappBtn.addEventListener("click", shareViaWhatsApp);
  }
  if (shareMessengerBtn) {
    shareMessengerBtn.addEventListener("click", shareViaMessenger);
  }
  if (closeSharePopupBtn) {
    closeSharePopupBtn.addEventListener("click", () => {
      const sharePopup = document.getElementById("shareOptionsPopup");
      if (sharePopup) sharePopup.classList.add("hidden");
    });
  }

  // Search Module
  const searchAttendanceBtn = document.getElementById("searchAttendanceBtn");
  if (searchAttendanceBtn) {
    searchAttendanceBtn.addEventListener("click", searchAttendance);
  }

  // Data Management Module
  const backupDataBtn = document.getElementById("backupDataBtn");
  const restoreDataFile = document.getElementById("restoreDataFile");
  const clearAllDataBtn = document.getElementById("clearAllDataBtn");
  const importCSVFile = document.getElementById("importCSVFile");
  
  if (backupDataBtn) {
    backupDataBtn.addEventListener("click", backupData);
  }
  if (restoreDataFile) {
    restoreDataFile.addEventListener("change", function (e) {
      if (e.target.files[0]) {
        restoreData(e.target.files[0]);
        e.target.value = "";
      }
    });
  }
  if (clearAllDataBtn) {
    clearAllDataBtn.addEventListener("click", clearAllData);
  }
  if (importCSVFile) {
    importCSVFile.addEventListener("change", function (e) {
      if (e.target.files[0]) {
        importCSVData(e.target.files[0]);
        e.target.value = "";
      }
    });
  }

  // Network Status
  window.addEventListener("online", updateNetStatus);
  window.addEventListener("offline", updateNetStatus);
  
  // PWA Install Prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show install button (you can add this to your UI)
    showNotification('Install this app for better experience', 'info', 3000);
  });
  
  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then(registration => {
          console.log('ServiceWorker registered:', registration);
        })
        .catch(error => {
          console.log('ServiceWorker registration failed:', error);
        });
    });
  }
}

// ==================== DATA MIGRATION ====================
function migrateData(oldData) {
  console.log("Migrating data from older version...");
  
  if (Array.isArray(oldData)) {
    // Version 1.0 data (just array of courses)
    return oldData.map(course => ({
      ...course,
      created: course.created || new Date().toISOString(),
      students: course.students || [],
      dates: course.dates || [],
      attendance: course.attendance || {}
    }));
  } else if (oldData && oldData.courses) {
    // Version 2.0 data (has courses property)
    return oldData.courses;
  }
  
  return [];
}

// ==================== INITIALIZE APP ====================
function initializeApp() {
  console.log("Initializing Attendance System v3.1.2...");
  
  // Initialize network status
  updateNetStatus();
  
  // Setup event listeners
  setupEventListeners();
  
  console.log("App initialized successfully");
}

// Make some functions available globally for HTML onclick handlers
window.correctAttendance = correctAttendance;
window.showNotification = showNotification;
window.checkAutoLogin = checkAutoLogin; // Make it globally available

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
