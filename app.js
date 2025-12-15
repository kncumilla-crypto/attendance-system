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
    online: navigator.onLine
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

// ==================== LOGIN/LOGOUT ====================
function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username')?.value?.trim();
    const password = document.getElementById('password')?.value;
    const teacherName = document.getElementById('teacherName')?.value?.trim();
    
    if (!username || !password || !teacherName) {
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
            loginSuccess(user, teacherName);
        } else {
            showNotification('Invalid password', 'error');
        }
    } else {
        // Create new user
        const newUser = {
            username: username,
            password: hashPassword(password),
            teacherName: teacherName,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        localStorage.setItem('attendanceUsers', JSON.stringify(users));
        
        loginSuccess(newUser, teacherName);
        showNotification('New account created successfully!', 'success');
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
        if (!coursesByYear[course.year]) {
            coursesByYear[course.year] = [];
        }
        coursesByYear[course.year].push(course);
    });
    
    // Display courses
    Object.keys(coursesByYear).sort().forEach(year => {
        const yearSection = document.createElement('div');
        yearSection.className = 'year-section';
        yearSection.innerHTML = `<h4>Year ${year === 'M.A.' ? 'M.A.' : year}</h4>`;
        
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
    
    // Show attendance popup (you'll need to implement this UI)
    showAttendancePopup();
}

function showAttendancePopup() {
    // Create and show attendance popup UI
    // This is a simplified version - you'll need to implement the full UI
    
    const popup = document.createElement('div');
    popup.className = 'attendance-popup';
    popup.innerHTML = `
        <div class="popup-header">
            <h3>Taking Attendance</h3>
            <button class="close-popup">&times;</button>
        </div>
        <div class="popup-body">
            <div id="currentStudentInfo"></div>
            <div class="attendance-buttons">
                <button id="markPresent">Present ✓</button>
                <button id="markAbsent">Absent ✗</button>
            </div>
            <div class="progress">
                <div id="progressBar"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Show first student
    showNextStudentInPopup();
}

function completeAttendance() {
    // Remove popup
    const popup = document.querySelector('.attendance-popup');
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
        const today = new Date().toISOString().split('T')[0];
        
        // Headers
        data.push(['Attendance Summary', '', '', '']);
        data.push(['Course:', course.id, 'Date:', today]);
        data.push(['Course Name:', course.name, 'Teacher:', course.teacher]);
        data.push([]);
        data.push(['Student ID', 'Student Name', 'Status']);
        
        // Student data
        course.students.forEach(student => {
            const status = course.attendance[today] && course.attendance[today][student.id] === 'present' ? 'Present' : 'Absent';
            data.push([student.id, student.name, status]);
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
    
    const today = new Date().toLocaleDateString('en-GB');
    const subject = `Attendance Summary - ${course.id} - ${today}`;
    const body = `Please find attached the attendance summary for ${course.id} on ${today}.`;
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function shareViaWhatsApp() {
    const course = appState.currentCourse;
    if (!course) return;
    
    const today = new Date().toLocaleDateString('en-GB');
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
                ${student.name}
            </div>
            <div>
                <span class="status ${status}">${status.toUpperCase()}</span>
                <button onclick="correctAttendance('${courseId}', '${student.id}', '${date}', 'present')">Present</button>
                <button onclick="correctAttendance('${courseId}', '${student.id}', '${date}', 'absent')">Absent</button>
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
            teacherName: appState.teacherName
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
    
    saveCourses();
    loadLiveCourses();
    
    showNotification('All data cleared', 'success');
}

// ==================== EVENT LISTENERS SETUP ====================
function setupEventListeners() {
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
    
    // Network Status
    window.addEventListener('online', () => {
        appState.online = true;
        showNotification('Back online', 'success');
    });
    
    window.addEventListener('offline', () => {
        appState.online = false;
        showNotification('Working offline', 'info');
    });
}

// ==================== INITIALIZE APP ====================
function initializeApp() {
    console.log('Initializing Attendance System v3.0...');
    
    // Show welcome screen
    showWelcomeScreen();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('App initialized successfully');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
