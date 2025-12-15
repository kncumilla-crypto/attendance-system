// attendance-system/app.js
// University of Chittagong - Department of Philosophy
// Attendance Management System
// Version: 3.0
// Modified as per requirements

// ==================== APP CONFIGURATION ====================
const SECURITY_CONFIG = {
    users: [],
    sessionTimeout: 60 * 60 * 1000,
    maxBackupFiles: 5,
    dataVersion: '3.0'
};

// ==================== GLOBAL STATE ====================
let appState = {
    isAuthenticated: false,
    courses: [],
    currentCourse: null,
    teacherName: '',
    teacherEmail: '',
    teacherPhone: '',
    online: navigator.onLine,
    currentYear: new Date().getFullYear().toString()
};

let attendanceState = {
    isActive: false,
    currentDate: null,
    studentList: [],
    currentIndex: 0
};

let LAST_ATTENDANCE = null;
let deferredPrompt = null;
let currentModule = null;

// ==================== UTILITY FUNCTIONS ====================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    let icon = '';
    switch(type) {
        case 'success': icon = 'check-circle'; break;
        case 'error': icon = '-exclamation-circle'; break;
        case 'warning': icon = 'exclamation-triangle'; break;
        default: icon = 'info-circle';
    }
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
        <button class="close-notification">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    // Close button
    notification.querySelector('.close-notification').onclick = () => {
        notification.remove();
    };
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function hashPassword(password) {
    // Simple hash function (in production use proper backend hashing)
    return CryptoJS.SHA256(password).toString();
}

function checkPasswordStrength(password) {
    if (password.length < 6) return 'weak';
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) return 'strong';
    return 'medium';
}

// Network Status Function
function updateNetStatus() {
    const dot = document.getElementById("netDot");
    const text = document.getElementById("netText");

    if (navigator.onLine) {
        dot.style.background = "green";
        text.textContent = "Online";
    } else {
        dot.style.background = "red";
        text.textContent = "Offline";
    }
}

// Quote System
const quotes = [
    "“Labor is the source of all wealth.” – Karl Marx",
    "“Work gives meaning to life.” – Tolstoy",
    "“Pleasure in the job puts perfection in the work.” – Aristotle",
    "“Without labor nothing prospers.” – Sophocles",
    "“Choose a job you love, and you will never have to work a day in your life.” – Confucius",
    "“The only way to do great work is to love what you do.” – Steve Jobs"
];

function showQuote() {
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    const quoteBox = document.getElementById("quoteBox");
    if (quoteBox) {
        quoteBox.textContent = q;
    }
}

// Year Format Function
function formatYear(year, batch) {
    if (year == 1) return `1st ${batch}`;
    if (year == 2) return `2nd ${batch}`;
    if (year == 3) return `3rd ${batch}`;
    return `${year}th ${batch}`;
}

// ==================== WELCOME SCREEN ====================
function showWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen) {
        welcomeScreen.classList.remove('hidden');
        // Hide after 3 seconds
        setTimeout(() => {
            welcomeScreen.classList.add('hidden');
            checkAutoLogin();
        }, 3000);
    }
}

// ==================== AUTO LOGIN ====================
function checkAutoLogin() {
    try {
        const session = localStorage.getItem('attendanceSession');
        if (session) {
            const sessionData = JSON.parse(session);
            const now = new Date().getTime();
            
            if (sessionData.expires > now && sessionData.version === SECURITY_CONFIG.dataVersion) {
                appState.isAuthenticated = true;
                appState.teacherName = sessionData.teacherName || '';
                appState.teacherEmail = sessionData.teacherEmail || '';
                appState.teacherPhone = sessionData.teacherPhone || '';
                
                // Show dashboard
                showDashboard();
                
                // Load courses
                setTimeout(() => {
                    loadCourses();
                }, 100);
                
                return true;
            } else {
                localStorage.removeItem('attendanceSession');
            }
        }
    } catch (e) {
        console.error('Auto-login error:', e);
        localStorage.removeItem('attendanceSession');
    }
    return false;
}

// ==================== SCREEN MANAGEMENT ====================
function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (dashboardScreen) {
        dashboardScreen.classList.remove('hidden');
        
        // Update teacher name display
        const teacherNameDisplay = document.getElementById('teacherNameDisplay');
        if (teacherNameDisplay) {
            teacherNameDisplay.textContent = appState.teacherName;
        }
        
        // Show quote
        showQuote();
        
        // Hide all modules initially
        hideAllModules();
    }
}

function hideAllModules() {
    document.querySelectorAll('.module-container').forEach(module => {
        module.classList.add('hidden');
    });
    currentModule = null;
}

// ==================== REGISTRATION SYSTEM ====================
function setupRegistration() {
    const showRegisterBtn = document.getElementById('showRegister');
    const showLoginBtn = document.getElementById('showLogin');
    const registerBox = document.getElementById('registerBox');
    const loginBox = document.getElementById('loginBox');
    const registerForm = document.getElementById('registerForm');
    
    if (showRegisterBtn) {
        showRegisterBtn.onclick = (e) => {
            e.preventDefault();
            loginBox.classList.add('hidden');
            registerBox.classList.remove('hidden');
        };
    }
    
    if (showLoginBtn) {
        showLoginBtn.onclick = (e) => {
            e.preventDefault();
            registerBox.classList.add('hidden');
            loginBox.classList.remove('hidden');
        };
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegistration);
    }
    
    // Password toggle for registration
    setupPasswordToggle('toggleRegPass', 'regPass');
    setupPasswordToggle('toggleRegPass2', 'regPass2');
}

function handleRegistration(e) {
    e.preventDefault();
    
    const username = document.getElementById('regUser')?.value?.trim();
    const teacherName = document.getElementById('teacherNameReg')?.value?.trim();
    const password = document.getElementById('regPass')?.value;
    const confirmPassword = document.getElementById('regPass2')?.value;
    const hint = document.getElementById('regHint')?.value?.trim();
    
    // Validation
    if (!username || !teacherName || !password || !confirmPassword) {
        showNotification('Please fill all required fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    // Check if user already exists
    const users = JSON.parse(localStorage.getItem('attendanceUsers') || '[]');
    if (users.some(u => u.username === username)) {
        showNotification('Username already exists', 'error');
        return;
    }
    
    // Create new user
    const newUser = {
        username: username,
        password: hashPassword(password),
        teacherName: teacherName,
        hint: hint || '',
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    localStorage.setItem('attendanceUsers', JSON.stringify(users));
    
    // Auto login
    loginSuccess(newUser, teacherName);
    
    showNotification('Registration successful! Welcome ' + teacherName, 'success');
    
    // Switch to login view
    document.getElementById('registerBox').classList.add('hidden');
    document.getElementById('loginBox').classList.remove('hidden');
}

// ==================== LOGIN/LOGOUT ====================
function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username')?.value?.trim();
    const password = document.getElementById('password')?.value;
    
    if (!username || !password) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    // Check if user exists
    const users = JSON.parse(localStorage.getItem('attendanceUsers') || '[]');
    const user = users.find(u => u.username === username);
    
    if (user) {
        // Check password
        const hashedPassword = hashPassword(password);
        if (user.password === hashedPassword) {
            loginSuccess(user, user.teacherName);
        } else {
            showNotification('Invalid password', 'error');
        }
    } else {
        showNotification('User not found. Please register first.', 'error');
        document.getElementById('showRegister').click();
    }
}

function loginSuccess(user, teacherName) {
    appState.isAuthenticated = true;
    appState.teacherName = teacherName;
    appState.currentUser = user.username;
    
    // Save session
    const sessionData = {
        username: user.username,
        teacherName: teacherName,
        expires: new Date().getTime() + SECURITY_CONFIG.sessionTimeout,
        version: SECURITY_CONFIG.dataVersion
    };
    localStorage.setItem('attendanceSession', JSON.stringify(sessionData));
    localStorage.setItem('teacherName', teacherName);
    
    // Show dashboard
    showDashboard();
    
    // Load courses
    loadCourses();
    
    showNotification('Login successful! Welcome ' + teacherName, 'success');
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('attendanceSession');
        appState.isAuthenticated = false;
        
        // Show login screen
        document.getElementById('dashboardScreen').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
        
        // Clear form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.reset();
        
        showNotification('Logged out successfully', 'success');
    }
}

// ==================== PASSWORD TOGGLE ====================
function setupPasswordToggle(toggleId, inputId) {
    const toggleBtn = document.getElementById(toggleId);
    const passwordInput = document.getElementById(inputId);
    
    if (toggleBtn && passwordInput) {
        toggleBtn.onclick = () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                passwordInput.type = 'password';
                toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
            }
        };
    }
}

// ==================== PASSWORD RESET ====================
function setupPasswordReset() {
    const resetLink = document.getElementById('resetPasswordLink');
    const resetModal = document.getElementById('passwordResetModal');
    const cancelResetBtn = document.getElementById('cancelResetBtn');
    const confirmResetBtn = document.getElementById('confirmResetBtn');
    
    if (resetLink) {
        resetLink.onclick = (e) => {
            e.preventDefault();
            resetModal.classList.remove('hidden');
        };
    }
    
    if (cancelResetBtn) {
        cancelResetBtn.onclick = () => {
            resetModal.classList.add('hidden');
            document.getElementById('resetUsername').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        };
    }
    
    if (confirmResetBtn) {
        confirmResetBtn.onclick = () => {
            const username = document.getElementById('resetUsername').value.trim();
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (!username || !newPassword || !confirmPassword) {
                showNotification('Please fill all fields', 'error');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                showNotification('Passwords do not match', 'error');
                return;
            }
            
            // Check password strength
            const strength = checkPasswordStrength(newPassword);
            if (strength === 'weak') {
                showNotification('Password is too weak. Use at least 6 characters', 'warning');
                return;
            }
            
            // Update password
            const users = JSON.parse(localStorage.getItem('attendanceUsers') || '[]');
            const userIndex = users.findIndex(u => u.username === username);
            
            if (userIndex === -1) {
                showNotification('User not found', 'error');
                return;
            }
            
            users[userIndex].password = hashPassword(newPassword);
            users[userIndex].updatedAt = new Date().toISOString();
            
            localStorage.setItem('attendanceUsers', JSON.stringify(users));
            
            resetModal.classList.add('hidden');
            document.getElementById('resetUsername').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            
            showNotification('Password reset successful!', 'success');
        };
    }
    
    // Setup password toggles for reset modal
    setupPasswordToggle('toggleNewPass', 'newPassword');
    setupPasswordToggle('toggleConfirmPass', 'confirmPassword');
}

// ==================== YEAR MANAGEMENT ====================
function setupYearManagement() {
    const addYearBtn = document.getElementById('addYearBtn');
    const delYearBtn = document.getElementById('delYearBtn');
    
    if (addYearBtn) {
        addYearBtn.onclick = () => {
            const yearInput = document.getElementById('newYear');
            const year = yearInput.value.trim();
            
            if (!year) {
                showNotification('Please enter a year', 'error');
                return;
            }
            
            if (!/^\d{4}$/.test(year)) {
                showNotification('Please enter a valid 4-digit year', 'error');
                return;
            }
            
            // Save current year to app state
            appState.currentYear = year;
            
            // Refresh courses display
            loadLiveCourses();
            
            yearInput.value = '';
            showNotification(`Year ${year} added successfully`, 'success');
        };
    }
    
    if (delYearBtn) {
        delYearBtn.onclick = () => {
            const yearInput = document.getElementById('delYear');
            const year = yearInput.value.trim();
            
            if (!year) {
                showNotification('Please enter a year to delete', 'error');
                return;
            }
            
            // Get current user for password verification
            const users = JSON.parse(localStorage.getItem('attendanceUsers') || '[]');
            const currentUser = users.find(u => u.username === appState.currentUser);
            
            if (!currentUser) {
                showNotification('User not found', 'error');
                return;
            }
            
            const password = prompt(`To delete year ${year}, please enter your password:`);
            if (!password) return;
            
            // Verify password
            if (hashPassword(password) !== currentUser.password) {
                showNotification('Incorrect password', 'error');
                return;
            }
            
            // Delete courses for this year
            const originalLength = appState.courses.length;
            appState.courses = appState.courses.filter(course => {
                // For M.A. courses, check differently
                if (course.year === 'M.A.') {
                    return true; // Keep M.A. courses
                }
                return course.year !== year;
            });
            
            const deletedCount = originalLength - appState.courses.length;
            saveCourses();
            loadLiveCourses();
            
            yearInput.value = '';
            showNotification(`Year ${year} deleted. Removed ${deletedCount} courses.`, 'success');
        };
    }
}

// ==================== MODULE MANAGEMENT ====================
function showModule(moduleId) {
    hideAllModules();
    
    const module = document.getElementById(moduleId);
    if (module) {
        module.classList.remove('hidden');
        currentModule = moduleId;
        
        // Initialize module specific content
        switch(moduleId) {
            case 'attendanceModule':
                loadLiveCourses();
                break;
            case 'searchModule':
                populateSearchCourses();
                break;
            case 'dataModule':
                populateImportCourseSelect();
                populateManualCourseSelect();
                break;
        }
    }
}

// ==================== COURSE MANAGEMENT ====================
function loadCourses() {
    const savedCourses = localStorage.getItem('attendanceCourses');
    
    if (savedCourses) {
        try {
            const data = JSON.parse(savedCourses);
            if (data.version === SECURITY_CONFIG.dataVersion) {
                appState.courses = data.courses || [];
            } else {
                appState.courses = migrateData(data);
            }
        } catch (error) {
            console.error('Error loading courses:', error);
            appState.courses = [];
        }
    } else {
        appState.courses = [];
    }
    
    saveCourses();
}

function saveCourses() {
    const data = {
        version: SECURITY_CONFIG.dataVersion,
        courses: appState.courses,
        lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('attendanceCourses', JSON.stringify(data));
}

function loadLiveCourses() {
    const liveCoursesDiv = document.getElementById('liveCourses');
    if (!liveCoursesDiv) return;
    
    liveCoursesDiv.innerHTML = '';
    
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
    appState.courses.forEach(course => {
        const yearDisplay = course.year === 'M.A.' ? 'M.A.' : formatYear(parseInt(course.year), appState.currentYear);
        
        if (!coursesByYear[yearDisplay]) {
            coursesByYear[yearDisplay] = [];
        }
        coursesByYear[yearDisplay].push(course);
    });
    
    // Display courses
    Object.keys(coursesByYear).sort().forEach(year => {
        const yearSection = document.createElement('div');
        yearSection.className = 'year-section';
        yearSection.innerHTML = `<h4>${year}</h4>`;
        
        const coursesGrid = document.createElement('div');
        coursesGrid.className = 'courses-grid';
        
        coursesByYear[year].forEach(course => {
            const courseBtn = document.createElement('button');
            courseBtn.className = 'course-btn';
            courseBtn.innerHTML = `
                <div class="course-code">${course.id}</div>
                <div class="course-name">${course.name}</div>
                ${course.group ? `<div class="course-group">Group ${course.group}</div>` : ''}
            `;
            
            courseBtn.onclick = () => startAttendanceForCourse(course.id);
            
            coursesGrid.appendChild(courseBtn);
        });
        
        yearSection.appendChild(coursesGrid);
        liveCoursesDiv.appendChild(yearSection);
    });
}

function showNewCourseModal() {
    const modal = document.getElementById('newCourseModal');
    const teacherInput = document.getElementById('courseTeacher');
    const yearSelect = document.getElementById('courseYear');
    const groupSection = document.getElementById('groupSection');
    
    if (teacherInput) {
        teacherInput.value = appState.teacherName;
    }
    
    // Show/hide group section based on year selection
    if (yearSelect && groupSection) {
        yearSelect.onchange = function() {
            if (this.value === 'M.A.') {
                groupSection.classList.remove('hidden');
            } else {
                groupSection.classList.add('hidden');
            }
        };
    }
    
    modal.classList.remove('hidden');
}

function createNewCourse() {
    const courseCode = document.getElementById('courseCode').value.trim().toUpperCase();
    const courseName = document.getElementById('courseName').value.trim();
    const year = document.getElementById('courseYear').value;
    const group = document.getElementById('courseGroup').value;
    const teacher = document.getElementById('courseTeacher').value;
    
    // Validation
    if (!courseCode || !courseName || !year) {
        showNotification('Please fill all required fields', 'error');
        return;
    }
    
    // Check if M.A. course needs group
    if (year === 'M.A.' && !group) {
        showNotification('M.A. কোর্সের জন্য অবশ্যই একটি গ্রুপ নির্বাচন করতে হবে', 'error');
        return;
    }
    
    // Check if course already exists
    if (appState.courses.some(c => c.id === courseCode)) {
        showNotification(`Course ${courseCode} already exists`, 'error');
        return;
    }
    
    const newCourse = {
        id: courseCode,
        name: courseName,
        year: year,
        group: year === 'M.A.' ? group : null,
        teacher: teacher,
        created: new Date().toISOString(),
        students: [],
        dates: [],
        attendance: {}
    };
    
    appState.courses.push(newCourse);
    saveCourses();
    
    // Close modal
    document.getElementById('newCourseModal').classList.add('hidden');
    
    // Clear form
    document.getElementById('courseCode').value = '';
    document.getElementById('courseName').value = '';
    document.getElementById('courseYear').value = '';
    document.getElementById('courseGroup').value = '';
    
    // Refresh live courses
    loadLiveCourses();
    
    showNotification(`Course ${courseCode} created successfully`, 'success');
}

// ==================== MANUAL STUDENT ADD ====================
function setupManualStudentAdd() {
    const addStuBtn = document.getElementById('addStuBtn');
    const addStuBtn2 = document.getElementById('addStuBtn2');
    
    if (addStuBtn) {
        addStuBtn.onclick = () => {
            if (!appState.currentCourse) {
                showNotification('Please select a course first', 'error');
                return;
            }
            addStudentToCourse(appState.currentCourse.id, 'stuName', 'stuRoll', 'stuReg');
        };
    }
    
    if (addStuBtn2) {
        addStuBtn2.onclick = () => {
            const courseSelect = document.getElementById('manualCourseSelect');
            const courseId = courseSelect.value;
            
            if (!courseId) {
                showNotification('Please select a course', 'error');
                return;
            }
            
            addStudentToCourse(courseId, 'stuName2', 'stuRoll2', 'stuReg2');
        };
    }
}

function addStudentToCourse(courseId, nameFieldId, rollFieldId, regFieldId) {
    const course = appState.courses.find(c => c.id === courseId);
    if (!course) {
        showNotification('Course not found', 'error');
        return;
    }
    
    const name = document.getElementById(nameFieldId).value.trim();
    const roll = document.getElementById(rollFieldId).value.trim();
    const reg = document.getElementById(regFieldId).value.trim();
    
    if (!name || !roll || !reg) {
        showNotification('Please fill all student information', 'error');
        return;
    }
    
    // Check if student already exists
    if (course.students.some(s => s.id === roll || s.registration === reg)) {
        showNotification('Student with this roll or registration already exists', 'error');
        return;
    }
    
    const newStudent = {
        id: roll,
        name: name,
        registration: reg,
        added: new Date().toISOString()
    };
    
    course.students.push(newStudent);
    saveCourses();
    
    // Clear form
    document.getElementById(nameFieldId).value = '';
    document.getElementById(rollFieldId).value = '';
    document.getElementById(regFieldId).value = '';
    
    showNotification(`Student ${name} added to ${course.id}`, 'success');
}

// ==================== POPULATE COURSE SELECTS ====================
function populateSearchCourses() {
    const searchCourseSelect = document.getElementById('searchCourse');
    if (!searchCourseSelect) return;
    
    searchCourseSelect.innerHTML = '<option value="">Select Course</option>';
    appState.courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = `${course.id} - ${course.name}`;
        searchCourseSelect.appendChild(option);
    });
}

function populateImportCourseSelect() {
    const importSelect = document.getElementById('importCourseSelect');
    if (!importSelect) return;
    
    importSelect.innerHTML = '<option value="">Select Course</option>';
    appState.courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = `${course.id} - ${course.name}`;
        importSelect.appendChild(option);
    });
}

function populateManualCourseSelect() {
    const manualSelect = document.getElementById('manualCourseSelect');
    if (!manualSelect) return;
    
    manualSelect.innerHTML = '<option value="">Select Course</option>';
    appState.courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = `${course.id} - ${course.name}`;
        manualSelect.appendChild(option);
    });
}

// ==================== ATTENDANCE MANAGEMENT ====================
function startAttendanceForCourse(courseId) {
    const course = appState.courses.find(c => c.id === courseId);
    if (!course) {
        showNotification('Course not found', 'error');
        return;
    }
    
    // Check if attendance already taken today
    const today = new Date().toISOString().split('T')[0];
    if (course.dates.includes(today)) {
        showNotification('এই কোর্সে আজকের তারিখে ইতোমধ্যে হাজিরা গ্রহণ সম্পন্ন হয়েছে', 'warning');
        return;
    }
    
    // Check if course has students
    if (course.students.length === 0) {
        showNotification('No students in this course. Please add students first.', 'error');
        return;
    }
    
    // Start attendance process
    appState.currentCourse = course;
    
    // Initialize attendance for today
    course.dates.push(today);
    course.dates.sort();
    
    if (!course.attendance[today]) {
        course.attendance[today] = {};
        // Set all students as absent initially
        course.students.forEach(student => {
            course.attendance[today][student.id] = 'absent';
        });
    }
    
    saveCourses();
    
    // Setup attendance state
    attendanceState = {
        isActive: true,
        currentDate: today,
        studentList: [...course.students],
        currentIndex: 0
    };
    
    // Show attendance popup
    showAttendancePopup();
}

function showAttendancePopup() {
    const popup = document.createElement('div');
    popup.className = 'modal';
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
    
    // Event listeners
    document.getElementById('markPresent').onclick = () => markStudent('present');
    document.getElementById('markAbsent').onclick = () => markStudent('absent');
    document.getElementById('completeAttendance').onclick = completeAttendance;
    document.getElementById('cancelAttendance').onclick = () => {
        popup.remove();
        attendanceState.isActive = false;
    };
}

function showNextStudentInPopup() {
    if (attendanceState.currentIndex >= attendanceState.studentList.length) {
        completeAttendance();
        return;
    }
    
    const student = attendanceState.studentList[attendanceState.currentIndex];
    const studentDisplay = document.getElementById('studentDisplay');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    if (studentDisplay) {
        studentDisplay.innerHTML = `
            <h4>Student ${attendanceState.currentIndex + 1} of ${attendanceState.studentList.length}</h4>
            <p><strong>ID:</strong> ${student.id}</p>
            <p><strong>Name:</strong> ${student.name}</p>
            ${student.registration ? `<p><strong>Registration:</strong> ${student.registration}</p>` : ''}
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
    }
    
    attendanceState.currentIndex++;
    showNextStudentInPopup();
}

function completeAttendance() {
    // Remove popup
    const popup = document.querySelector('.modal');
    if (popup) popup.remove();
    
    attendanceState.isActive = false;
    
    // Show summary popup
    showSummaryPopup();
    
    showNotification('Attendance completed successfully!', 'success');
}

function showSummaryPopup() {
    const popup = document.getElementById('summaryPopup');
    if (popup) {
        popup.classList.remove('hidden');
    }
}

// ==================== SUMMARY & SHARING ====================
function exportAttendanceSummary() {
    const course = appState.currentCourse;
    if (!course) return;
    
    try {
        // Prepare Excel data
        const data = [];
        const today = attendanceState.currentDate || new Date().toISOString().split('T')[0];
        
        // Headers
        data.push(['Attendance Summary', '', '', '']);
        data.push(['Course:', course.id, 'Date:', today]);
        data.push(['Course Name:', course.name, 'Teacher:', course.teacher]);
        data.push(['Year:', formatYear(parseInt(course.year), appState.currentYear), '', '']);
        data.push([]);
        data.push(['Student ID', 'Student Name', 'Registration No', 'Status']);
        
        // Student data
        course.students.forEach(student => {
            const status = course.attendance[today] && course.attendance[today][student.id] === 'present' ? 'Present' : 'Absent';
            data.push([student.id, student.name, student.registration || '', status]);
        });
        
        // Summary
        data.push([]);
        const totalStudents = course.students.length;
        const presentCount = course.students.filter(s => 
            course.attendance[today] && course.attendance[today][s.id] === 'present'
        ).length;
        const absentCount = totalStudents - presentCount;
        
        data.push(['Total Students:', totalStudents]);
        data.push(['Present:', presentCount]);
        data.push(['Absent:', absentCount]);
        data.push(['Percentage:', Math.round((presentCount / totalStudents) * 100) + '%']);
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
        
        // Save file
        const filename = `${course.id}_attendance_${today}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        // Close summary popup
        document.getElementById('summaryPopup').classList.add('hidden');
        
        showNotification(`Attendance saved as ${filename}`, 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showNotification('Failed to export attendance', 'error');
    }
}

function shareAttendance() {
    // Show share options popup
    const sharePopup = document.getElementById('shareOptionsPopup');
    if (sharePopup) {
        sharePopup.classList.remove('hidden');
    }
}

function shareViaEmail() {
    const course = appState.currentCourse;
    if (!course) return;
    
    const today = attendanceState.currentDate || new Date().toLocaleDateString('en-GB');
    const subject = `Attendance Summary - ${course.id} - ${today}`;
    const body = `Please find attached the attendance summary for ${course.id} on ${today}.`;
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function shareViaWhatsApp() {
    const course = appState.currentCourse;
    if (!course) return;
    
    const today = attendanceState.currentDate || new Date().toLocaleDateString('en-GB');
    const text = `Attendance Summary for ${course.id} on ${today}. Please check the attached file.`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function shareViaMessenger() {
    showNotification('Messenger sharing coming soon', 'info');
}

// ==================== SEARCH & CORRECTION ====================
function searchAttendance() {
    const date = document.getElementById('searchDate').value;
    const courseId = document.getElementById('searchCourse').value;
    const searchTerm = document.getElementById('searchStudentId').value.trim().toLowerCase();
    
    if (!date || !courseId) {
        showNotification('Please select date and course', 'error');
        return;
    }
    
    const course = appState.courses.find(c => c.id === courseId);
    if (!course) return;
    
    // Check if date exists
    if (!course.dates.includes(date)) {
        showNotification('No attendance record for this date', 'error');
        return;
    }
    
    const resultsDiv = document.getElementById('searchResults');
    if (!resultsDiv) return;
    
    resultsDiv.innerHTML = '';
    resultsDiv.classList.remove('hidden');
    
    let filteredStudents = course.students;
    if (searchTerm) {
        filteredStudents = filteredStudents.filter(s => 
            s.id.toLowerCase().includes(searchTerm) || 
            s.name.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filteredStudents.length === 0) {
        resultsDiv.innerHTML = '<p>No students found</p>';
        return;
    }
    
    filteredStudents.forEach(student => {
        const status = course.attendance[date] && course.attendance[date][student.id] || 'absent';
        
        const card = document.createElement('div');
        card.className = 'student-card';
        card.innerHTML = `
            <div>
                <strong>${student.id}</strong><br>
                ${student.name}<br>
                <small>${student.registration || ''}</small>
            </div>
            <div>
                <span class="status ${status}">${status.toUpperCase()}</span>
                <button onclick="correctAttendance('${courseId}', '${student.id}', '${date}', 'present')" class="btn btn-sm" style="background: #2ecc71; color: white;">Present</button>
                <button onclick="correctAttendance('${courseId}', '${student.id}', '${date}', 'absent')" class="btn btn-sm" style="background: #e74c3c; color: white;">Absent</button>
            </div>
        `;
        
        resultsDiv.appendChild(card);
    });
}

function correctAttendance(courseId, studentId, date, newStatus) {
    const course = appState.courses.find(c => c.id === courseId);
    if (!course) return;
    
    if (!course.attendance[date]) {
        course.attendance[date] = {};
    }
    
    const oldStatus = course.attendance[date][studentId] || 'absent';
    course.attendance[date][studentId] = newStatus;
    saveCourses();
    
    // Refresh search results
    searchAttendance();
    
    showNotification(`Corrected ${studentId} from ${oldStatus} to ${newStatus}`, 'success');
}

// ==================== DATA MANAGEMENT ====================
function backupData() {
    try {
        const backup = {
            version: SECURITY_CONFIG.dataVersion,
            courses: appState.courses,
            users: JSON.parse(localStorage.getItem('attendanceUsers') || '[]'),
            timestamp: new Date().toISOString(),
            teacherName: appState.teacherName,
            currentYear: appState.currentYear
        };
        
        const blob = new Blob([JSON.stringify(backup, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        showNotification('Backup created successfully', 'success');
        
    } catch (error) {
        console.error('Backup error:', error);
        showNotification('Failed to create backup', 'error');
    }
}

function restoreData(file) {
    if (!confirm('Restore will replace all current data. Continue?')) {
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backup = JSON.parse(e.target.result);
            
            if (!backup.version || !backup.courses) {
                throw new Error('Invalid backup file');
            }
            
            appState.courses = backup.courses;
            if (backup.users) {
                localStorage.setItem('attendanceUsers', JSON.stringify(backup.users));
            }
            if (backup.currentYear) {
                appState.currentYear = backup.currentYear;
            }
            
            saveCourses();
            loadLiveCourses();
            
            showNotification('Data restored successfully', 'success');
            
        } catch (error) {
            console.error('Restore error:', error);
            showNotification('Failed to restore: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (!confirm('WARNING: This will delete ALL data. Are you sure?')) {
        return;
    }
    
    if (prompt('Type "DELETE" to confirm:') !== 'DELETE') {
        showNotification('Deletion cancelled', 'info');
        return;
    }
    
    appState.courses = [];
    localStorage.removeItem('attendanceCourses');
    localStorage.removeItem('attendanceUsers');
    localStorage.removeItem('attendanceSession');
    
    saveCourses();
    loadLiveCourses();
    
    // Logout user
    appState.isAuthenticated = false;
    document.getElementById('dashboardScreen').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    
    showNotification('All data cleared', 'success');
}

// ==================== EVENT LISTENERS SETUP ====================
function setupEventListeners() {
    // Password toggle for login
    setupPasswordToggle('togglePassword', 'password');
    
    // Registration system
    setupRegistration();
    
    // Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Logout Button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Password Reset
    setupPasswordReset();
    
    // Dashboard Modules
    document.getElementById('btnAttendance')?.addEventListener('click', () => showModule('attendanceModule'));
    document.getElementById('btnSearch')?.addEventListener('click', () => showModule('searchModule'));
    document.getElementById('btnData')?.addEventListener('click', () => showModule('dataModule'));
    
    // Attendance Module
    document.getElementById('btnNewCourse')?.addEventListener('click', showNewCourseModal);
    document.getElementById('saveCourseBtn')?.addEventListener('click', createNewCourse);
    document.getElementById('cancelCourseBtn')?.addEventListener('click', () => {
        document.getElementById('newCourseModal').classList.add('hidden');
    });
    
    // Year Management
    setupYearManagement();
    
    // Manual Student Add
    setupManualStudentAdd();
    
    // Summary Popup
    document.getElementById('saveExcelBtn')?.addEventListener('click', exportAttendanceSummary);
    document.getElementById('shareSummaryBtn')?.addEventListener('click', shareAttendance);
    document.getElementById('closeSummaryBtn')?.addEventListener('click', () => {
        document.getElementById('summaryPopup').classList.add('hidden');
    });
    
    // Share Options
    document.getElementById('shareEmailBtn')?.addEventListener('click', shareViaEmail);
    document.getElementById('shareWhatsappBtn')?.addEventListener('click', shareViaWhatsApp);
    document.getElementById('shareMessengerBtn')?.addEventListener('click', shareViaMessenger);
    document.getElementById('closeSharePopupBtn')?.addEventListener('click', () => {
        document.getElementById('shareOptionsPopup').classList.add('hidden');
    });
    
    // Search Module
    document.getElementById('searchAttendanceBtn')?.addEventListener('click', searchAttendance);
    
    // Data Management Module
    document.getElementById('backupDataBtn')?.addEventListener('click', backupData);
    document.getElementById('restoreDataFile')?.addEventListener('change', function(e) {
        if (e.target.files[0]) {
            restoreData(e.target.files[0]);
            e.target.value = '';
        }
    });
    document.getElementById('clearAllDataBtn')?.addEventListener('click', clearAllData);
    
    // CSV Import
    document.getElementById('importCSVFile')?.addEventListener('change', function(e) {
        if (e.target.files[0]) {
            importCSVData(e.target.files[0]);
            e.target.value = '';
        }
    });
    
    // Network Status
    window.addEventListener('online', updateNetStatus);
    window.addEventListener('offline', updateNetStatus);
}

// ==================== CSV IMPORT ====================
function importCSVData(file) {
    const courseId = document.getElementById('importCourseSelect').value;
    if (!courseId) {
        showNotification('Please select a course first', 'error');
        return;
    }
    
    const course = appState.courses.find(c => c.id === courseId);
    if (!course) {
        showNotification('Course not found', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            const lines = content.split('\n');
            let imported = 0;
            let skipped = 0;
            
            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) return;
                
                const parts = trimmed.split(',').map(p => p.trim());
                if (parts.length >= 2) {
                    const [studentId, studentName, ...rest] = parts;
                    
                    // Check if student already exists
                    if (course.students.some(s => s.id === studentId)) {
                        skipped++;
                        return;
                    }
                    
                    const newStudent = {
                        id: studentId,
                        name: studentName,
                        registration: rest[0] || '',
                        added: new Date().toISOString()
                    };
                    
                    course.students.push(newStudent);
                    imported++;
                }
            });
            
            saveCourses();
            showNotification(`Imported ${imported} students, skipped ${skipped} duplicates`, 'success');
            
        } catch (error) {
            console.error('CSV import error:', error);
            showNotification('Failed to import CSV file', 'error');
        }
    };
    reader.readAsText(file);
}

// ==================== INITIALIZE APP ====================
function initializeApp() {
    console.log('Initializing Attendance System v3.0...');
    
    // Initialize network status
    updateNetStatus();
    
    // Show welcome screen
    showWelcomeScreen();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('App initialized successfully');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
