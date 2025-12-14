// attendance-system/app.js
// University of Chittagong - Department of Philosophy
// Attendance Management System
// Version: 2.0

// ==================== APP CONFIGURATION ====================
const SECURITY_CONFIG = {
    users: [
        {
            username: 'teacher',
            password: 'philosophy123',
            name: 'Demo Teacher'
        },
        {
            username: 'admin',
            password: 'admin123',
            name: 'System Administrator'
        }
    ],
    sessionTimeout: 60 * 60 * 1000, // 1 hour in milliseconds
    maxBackupFiles: 5,
    dataVersion: '2.0'
};

// ==================== GLOBAL STATE ====================
let appState = {
    isAuthenticated: false,
    courses: [],
    currentCourse: null,
    currentUser: '',
    teacherName: localStorage.getItem('teacherName') || '',
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

// ==================== UTILITY FUNCTIONS ====================
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelectorAll('.notification');
    existing.forEach(n => {
        n.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => n.remove(), 300);
    });

    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    let icon = '';
    switch(type) {
        case 'success': icon = 'check-circle'; break;
        case 'error': icon = 'exclamation-circle'; break;
        case 'warning': icon = 'exclamation-triangle'; break;
        default: icon = 'info-circle';
    }
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function vibrate(pattern = [100]) {
    if ('vibrate' in navigator && appState.online) {
        try {
            navigator.vibrate(pattern);
        } catch (e) {
            console.log('Vibration not supported');
        }
    }
}

function updateNetworkStatus() {
    const onlineIndicator = document.getElementById('onlineIndicator');
    const offlineIndicator = document.getElementById('offlineIndicator');
    
    if (appState.online) {
        if (onlineIndicator) {
            onlineIndicator.style.display = 'block';
            offlineIndicator.style.display = 'none';
        }
    } else {
        if (offlineIndicator) {
            onlineIndicator.style.display = 'none';
            offlineIndicator.style.display = 'block';
        }
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
                console.log('Auto-login successful');
                appState.isAuthenticated = true;
                appState.currentUser = sessionData.username;
                appState.teacherName = sessionData.teacherName || 'Teacher';
                
                // Show dashboard
                showDashboard();
                
                // Load courses
                setTimeout(() => {
                    loadCourses();
                }, 100);
                
                return true;
            } else {
                // Session expired or version mismatch
                localStorage.removeItem('attendanceSession');
                localStorage.removeItem('teacherName');
            }
        }
    } catch (e) {
        console.error('Auto-login error:', e);
        localStorage.removeItem('attendanceSession');
        localStorage.removeItem('teacherName');
    }
    return false;
}

// ==================== SCREEN MANAGEMENT ====================
function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');
    const attendanceScreen = document.getElementById('attendanceScreen');
    const correctionSection = document.getElementById('correctionSection');
    const dataManagementSection = document.getElementById('dataManagementSection');
    
    // Hide all screens
    if (loginScreen) loginScreen.classList.add('hidden');
    if (dashboardScreen) dashboardScreen.classList.add('hidden');
    if (attendanceScreen) attendanceScreen.classList.add('hidden');
    if (correctionSection) correctionSection.classList.add('hidden');
    if (dataManagementSection) dataManagementSection.classList.add('hidden');
    
    // Show dashboard
    if (dashboardScreen) {
        dashboardScreen.classList.remove('hidden');
        
        // Update user info
        const currentUserEl = document.getElementById('currentUser');
        if (currentUserEl) {
            currentUserEl.textContent = appState.teacherName;
        }
    }
}

function showLoginScreen() {
    const dashboardScreen = document.getElementById('dashboardScreen');
    const attendanceScreen = document.getElementById('attendanceScreen');
    const correctionSection = document.getElementById('correctionSection');
    const loginScreen = document.getElementById('loginScreen');
    const dataManagementSection = document.getElementById('dataManagementSection');
    
    if (dashboardScreen) dashboardScreen.classList.add('hidden');
    if (attendanceScreen) attendanceScreen.classList.add('hidden');
    if (correctionSection) correctionSection.classList.add('hidden');
    if (dataManagementSection) dataManagementSection.classList.add('hidden');
    if (loginScreen) loginScreen.classList.remove('hidden');
}

// ==================== LOGIN/LOGOUT ====================
function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username')?.value?.trim();
    const password = document.getElementById('password')?.value;
    const teacherName = document.getElementById('teacherName')?.value?.trim();
    
    // Validate inputs
    if (!username || !password || !teacherName) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    // Check credentials
    const user = SECURITY_CONFIG.users.find(u => 
        u.username === username && u.password === password
    );
    
    if (user) {
        console.log('Login successful for:', username);
        
        // Update app state
        appState.isAuthenticated = true;
        appState.currentUser = username;
        appState.teacherName = teacherName || user.name;
        
        // Save session to localStorage
        const sessionData = {
            username: username,
            teacherName: appState.teacherName,
            expires: new Date().getTime() + SECURITY_CONFIG.sessionTimeout,
            version: SECURITY_CONFIG.dataVersion
        };
        localStorage.setItem('attendanceSession', JSON.stringify(sessionData));
        localStorage.setItem('teacherName', appState.teacherName);
        
        // Show dashboard
        showDashboard();
        
        // Load courses
        loadCourses();
        
        showNotification('Login successful! Welcome ' + appState.teacherName, 'success');
        
    } else {
        console.log('Login failed for:', username);
        showNotification('Invalid username or password', 'error');
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear session
        localStorage.removeItem('attendanceSession');
        appState.isAuthenticated = false;
        
        // Show login screen
        showLoginScreen();
        
        // Clear form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.reset();
        
        showNotification('Logged out successfully', 'success');
    }
}

function togglePasswordVisibility() {
    const input = document.getElementById('password');
    const icon = this.querySelector('i');
    if (input && icon) {
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }
}

// ==================== COURSE MANAGEMENT ====================
function loadCourses() {
    console.log('Loading courses...');
    const savedCourses = localStorage.getItem('attendanceCourses');
    
    if (savedCourses) {
        try {
            const data = JSON.parse(savedCourses);
            // Check data version
            if (data.version === SECURITY_CONFIG.dataVersion) {
                appState.courses = data.courses || [];
            } else {
                // Migrate data or load default
                appState.courses = migrateData(data);
            }
        } catch (error) {
            console.error('Error loading courses:', error);
            loadDemoCourses();
        }
    } else {
        loadDemoCourses();
    }
    
    saveCourses();
    renderCourses();
}

function migrateData(oldData) {
    // Simple migration
    if (Array.isArray(oldData)) {
        return oldData; // Old format was just array
    } else if (oldData.courses) {
        return oldData.courses;
    }
    return [];
}

function loadDemoCourses() {
    console.log('Loading demo courses');
    appState.courses = [
        {
            id: 'PHIL101',
            name: 'Introduction to Philosophy',
            year: '1',
            teacher: 'Dr. Ahmed Hossain',
            created: new Date().toISOString(),
            students: [
                { id: '2023001', name: 'Rahim Ahmed', year: '1', department: 'Philosophy' },
                { id: '2023002', name: 'Karim Khan', year: '1', department: 'Philosophy' },
                { id: '2023003', name: 'Salma Begum', year: '1', department: 'Philosophy' },
                { id: '2023004', name: 'Jamal Uddin', year: '1', department: 'Philosophy' }
            ],
            dates: [],
            attendance: {}
        },
        {
            id: 'PHIL201',
            name: 'Ethics and Moral Philosophy',
            year: '2',
            teacher: 'Prof. Fatima Rahman',
            created: new Date().toISOString(),
            students: [
                { id: '2022001', name: 'Ayesha Akter', year: '2', department: 'Philosophy' },
                { id: '2022002', name: 'Sohel Rana', year: '2', department: 'Philosophy' }
            ],
            dates: [],
            attendance: {}
        }
    ];
}

function saveCourses() {
    const data = {
        version: SECURITY_CONFIG.dataVersion,
        courses: appState.courses,
        lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('attendanceCourses', JSON.stringify(data));
}

function renderCourses() {
    const coursesGrid = document.getElementById('coursesGrid');
    if (!coursesGrid) return;
    
    coursesGrid.innerHTML = '';
    
    if (appState.courses.length === 0) {
        coursesGrid.innerHTML = `
            <div class="empty-courses">
                <i class="fas fa-book"></i>
                <h3>No Courses Found</h3>
                <p>Create your first course to get started</p>
                <button id="addFirstCourseBtn" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Create First Course
                </button>
            </div>
        `;
        
        const addFirstBtn = document.getElementById('addFirstCourseBtn');
        if (addFirstBtn) {
            addFirstBtn.onclick = showAddCourseModal;
        }
        return;
    }
    
    appState.courses.forEach(course => {
        const card = document.createElement('div');
        card.className = 'course-card';
        
        // Calculate attendance stats
        const totalStudents = course.students.length;
        const totalClasses = course.dates.length;
        let totalAttendance = 0;
        
        if (totalClasses > 0) {
            course.students.forEach(student => {
                let presentCount = 0;
                course.dates.forEach(date => {
                    if (course.attendance[date] && course.attendance[date][student.id] === 'present') {
                        presentCount++;
                    }
                });
                totalAttendance += presentCount;
            });
        }
        
        const avgAttendance = totalClasses > 0 ? Math.round((totalAttendance / (totalStudents * totalClasses)) * 100) : 0;
        
        card.innerHTML = `
            <div class="course-header">
                <div>
                    <div class="course-code">${course.id}</div>
                    <div class="course-name">${course.name}</div>
                </div>
                <div class="course-stats">${avgAttendance}%</div>
            </div>
            <div class="course-details">
                <div><strong><i class="fas fa-chalkboard-teacher"></i> Teacher:</strong> ${course.teacher}</div>
                <div><strong><i class="fas fa-users"></i> Students:</strong> ${totalStudents}</div>
                <div><strong><i class="fas fa-calendar-alt"></i> Classes:</strong> ${totalClasses}</div>
            </div>
            <div class="course-actions">
                <button class="course-action-btn" onclick="openCourse('${course.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="course-action-btn delete-course-btn" onclick="deleteCourse('${course.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        coursesGrid.appendChild(card);
    });
}

function showAddCourseModal() {
    const courseId = prompt('Enter Course ID (e.g., PHIL101):');
    if (!courseId) return;
    
    const courseName = prompt('Enter Course Name:');
    if (!courseName) return;
    
    const year = prompt('Enter Year (1, 2, 3, 4):', '1') || '1';
    const teacher = prompt('Enter Teacher Name:', appState.teacherName) || appState.teacherName;
    
    const newCourse = {
        id: courseId.toUpperCase().trim(),
        name: courseName.trim(),
        year: year.trim(),
        teacher: teacher.trim(),
        created: new Date().toISOString(),
        students: [],
        dates: [],
        attendance: {}
    };
    
    // Check if course already exists
    if (appState.courses.some(c => c.id === newCourse.id)) {
        showNotification(`Course ${newCourse.id} already exists`, 'error');
        return;
    }
    
    appState.courses.push(newCourse);
    saveCourses();
    renderCourses();
    
    showNotification(`Course ${courseId} created successfully`, 'success');
}

function deleteCourse(courseId) {
    if (!confirm(`Are you sure you want to delete course ${courseId}? This action cannot be undone.`)) {
        return;
    }
    
    const courseIndex = appState.courses.findIndex(c => c.id === courseId);
    if (courseIndex !== -1) {
        appState.courses.splice(courseIndex, 1);
        saveCourses();
        renderCourses();
        showNotification('Course deleted successfully', 'success');
    }
}

function openCourse(courseId) {
    const course = appState.courses.find(c => c.id === courseId);
    if (!course) {
        showNotification('Course not found', 'error');
        return;
    }
    
    appState.currentCourse = course;
    
    // Hide other screens
    const dashboardScreen = document.getElementById('dashboardScreen');
    const correctionSection = document.getElementById('correctionSection');
    const dataManagementSection = document.getElementById('dataManagementSection');
    
    if (dashboardScreen) dashboardScreen.classList.add('hidden');
    if (correctionSection) correctionSection.classList.add('hidden');
    if (dataManagementSection) dataManagementSection.classList.add('hidden');
    
    // Show attendance screen
    const attendanceScreen = document.getElementById('attendanceScreen');
    if (attendanceScreen) {
        attendanceScreen.classList.remove('hidden');
        
        // Set course info
        const courseTitle = document.getElementById('attendanceCourseTitle');
        const courseInfo = document.getElementById('attendanceCourseInfo');
        const currentCourseTitle = document.getElementById('currentCourseTitle');
        const datesInfo = document.getElementById('attendanceDatesInfo');
        const attendanceUser = document.getElementById('attendanceUser');
        
        if (courseTitle) courseTitle.textContent = course.name;
        if (courseInfo) courseInfo.textContent = `${course.id} | ${course.teacher}`;
        if (currentCourseTitle) currentCourseTitle.textContent = `${course.id} - ${course.name}`;
        if (datesInfo) datesInfo.textContent = `${course.students.length} students | ${course.dates.length} classes`;
        if (attendanceUser) attendanceUser.textContent = appState.teacherName;
        
        // Hide table initially
        const tableContainer = document.getElementById('attendanceTableContainer');
        const exportBtn = document.getElementById('exportExcelBtn');
        const printBtn = document.getElementById('printSheetBtn');
        const shareOptions = document.getElementById('shareOptions');
        
        if (tableContainer) tableContainer.classList.add('hidden');
        if (exportBtn) exportBtn.classList.add('hidden');
        if (printBtn) printBtn.classList.add('hidden');
        if (shareOptions) shareOptions.classList.add('hidden');
    }
}

// ==================== ATTENDANCE MANAGEMENT ====================
function startAttendance() {
    const course = appState.currentCourse;
    if (!course) {
        showNotification('No course selected', 'error');
        return;
    }
    
    if (course.students.length === 0) {
        showNotification('No students in this course', 'error');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // Initialize attendance for today
    if (!course.dates.includes(today)) {
        course.dates.push(today);
        course.dates.sort();
    }
    
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
    
    showNextStudent();
}

function showNextStudent() {
    if (!attendanceState.isActive) return;
    
    if (attendanceState.currentIndex >= attendanceState.studentList.length) {
        completeAttendance();
        return;
    }
    
    const student = attendanceState.studentList[attendanceState.currentIndex];
    
    // Update popup
    const studentIdEl = document.getElementById('popupStudentId');
    const studentNameEl = document.getElementById('popupStudentName');
    const studentDetailsEl = document.getElementById('popupStudentDetails');
    
    if (studentIdEl) studentIdEl.textContent = student.id;
    if (studentNameEl) studentNameEl.textContent = student.name;
    if (studentDetailsEl) studentDetailsEl.textContent = `${student.year} Year | ${student.department}`;
    
    // Update progress
    const total = attendanceState.studentList.length;
    const current = attendanceState.currentIndex + 1;
    const percent = Math.round((current / total) * 100);
    
    const currentProgressEl = document.getElementById('currentProgress');
    const progressPercentageEl = document.getElementById('progressPercentage');
    const progressFillEl = document.getElementById('progressFill');
    
    if (currentProgressEl) currentProgressEl.textContent = `${current}/${total}`;
    if (progressPercentageEl) progressPercentageEl.textContent = `${percent}%`;
    if (progressFillEl) progressFillEl.style.width = `${percent}%`;
    
    // Show popup
    const popupOverlay = document.getElementById('attendancePopupOverlay');
    if (popupOverlay) popupOverlay.classList.remove('hidden');
}

function markAttendance(status) {
    if (!attendanceState.isActive) return;
    
    const student = attendanceState.studentList[attendanceState.currentIndex];
    const course = appState.currentCourse;
    
    if (course && attendanceState.currentDate) {
        const oldStatus = course.attendance[attendanceState.currentDate][student.id] || 'absent';
        course.attendance[attendanceState.currentDate][student.id] = status;
        
        // Vibrate based on status
        vibrate(status === 'present' ? [50] : [100, 50, 100]);
        
        // Show quick correction
        showQuickCorrection(student.id, student.name, status, oldStatus);
        
        saveCourses();
        
        // Move to next student
        attendanceState.currentIndex++;
        
        if (attendanceState.currentIndex < attendanceState.studentList.length) {
            setTimeout(showNextStudent, 300);
        } else {
            completeAttendance();
        }
    }
}

function completeAttendance() {
    const popupOverlay = document.getElementById('attendancePopupOverlay');
    if (popupOverlay) popupOverlay.classList.add('hidden');
    
    attendanceState.isActive = false;
    
    // Show table
    const tableContainer = document.getElementById('attendanceTableContainer');
    const exportBtn = document.getElementById('exportExcelBtn');
    const printBtn = document.getElementById('printSheetBtn');
    
    if (tableContainer) tableContainer.classList.remove('hidden');
    if (exportBtn) exportBtn.classList.remove('hidden');
    if (printBtn) printBtn.classList.remove('hidden');
    
    renderAttendanceTable();
    showNotification('Attendance completed!', 'success');
}

// ==================== QUICK CORRECTION ====================
function showQuickCorrection(studentId, studentName, status, oldStatus) {
    LAST_ATTENDANCE = { 
        studentId, 
        studentName, 
        status, 
        oldStatus,
        date: attendanceState.currentDate,
        courseId: appState.currentCourse.id
    };
    
    const statusText = status === 'present' ? 'Present ✓' : 'Absent ✗';
    const quickCorrectionText = document.getElementById('quickCorrectionText');
    if (quickCorrectionText) {
        quickCorrectionText.textContent = `${studentId} - ${studentName} marked as ${statusText}`;
    }
    
    const quickCorrection = document.getElementById('quickCorrection');
    if (quickCorrection) {
        quickCorrection.classList.remove('hidden');
        
        // Auto hide after 10 seconds
        setTimeout(() => {
            if (quickCorrection && !quickCorrection.classList.contains('hidden')) {
                quickCorrection.classList.add('hidden');
            }
        }, 10000);
    }
}

function undoLastAttendance() {
    if (!LAST_ATTENDANCE || !appState.currentCourse) return;
    
    const { studentId, oldStatus, date, courseId } = LAST_ATTENDANCE;
    
    if (appState.currentCourse.id !== courseId) {
        showNotification('Cannot undo - different course', 'error');
        return;
    }
    
    const course = appState.currentCourse;
    
    if (course.attendance && course.attendance[date] && course.attendance[date][studentId] !== undefined) {
        // Restore old status
        course.attendance[date][studentId] = oldStatus;
        
        saveCourses();
        renderAttendanceTable();
        showNotification(`Undo successful - ${studentId} restored to ${oldStatus}`, 'success');
        vibrate([100, 50, 100]);
    }
    
    const quickCorrection = document.getElementById('quickCorrection');
    if (quickCorrection) quickCorrection.classList.add('hidden');
    
    LAST_ATTENDANCE = null;
}

function hideQuickCorrection() {
    const quickCorrection = document.getElementById('quickCorrection');
    if (quickCorrection) quickCorrection.classList.add('hidden');
}

// ==================== ATTENDANCE TABLE RENDERING ====================
function renderAttendanceTable() {
    const course = appState.currentCourse;
    if (!course) return;
    
    const header = document.getElementById('attendanceTableHeader');
    const body = document.getElementById('attendanceTableBody');
    
    if (!header || !body) return;
    
    // Clear existing
    header.innerHTML = '';
    body.innerHTML = '';
    
    // Create header
    let headerHTML = `
        <th class="sticky-left">
            <div>Student ID</div>
            <div style="font-weight: normal; font-size: 0.9rem;">Name</div>
        </th>
    `;
    
    course.dates.forEach(date => {
        const d = new Date(date);
        headerHTML += `
            <th>
                <div style="font-size: 0.8rem; font-weight: bold;">${d.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                <div style="font-size: 0.7rem; font-weight: normal;">${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
            </th>
        `;
    });
    
    headerHTML += '<th class="sticky-right">Avg</th>';
    header.innerHTML = headerHTML;
    
    // Create rows
    course.students.forEach(student => {
        const row = document.createElement('tr');
        let presentCount = 0;
        
        // Student info cell
        let rowHTML = `
            <td class="sticky-left">
                <div style="font-weight: bold;">${student.id}</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">${student.name}</div>
            </td>
        `;
        
        // Attendance cells
        course.dates.forEach(date => {
            const status = course.attendance && course.attendance[date] ? 
                (course.attendance[date][student.id] || 'absent') : 'absent';
            
            if (status === 'present') presentCount++;
            
            const cellClass = status === 'present' ? 'present-cell' : 'absent-cell';
            const symbol = status === 'present' ? '✓' : '✗';
            
            rowHTML += `<td class="${cellClass}">${symbol}</td>`;
        });
        
        // Average cell
        const average = course.dates.length > 0 
            ? Math.round((presentCount / course.dates.length) * 100)
            : 0;
        
        const avgColor = average >= 75 ? '#27ae60' : average >= 50 ? '#f39c12' : '#e74c3c';
        
        rowHTML += `
            <td class="sticky-right">
                <span style="color: ${avgColor}; font-weight: bold;">${average}%</span>
            </td>
        `;
        
        row.innerHTML = rowHTML;
        body.appendChild(row);
    });
}

// ==================== EXPORT TO EXCEL ====================
function exportToExcel() {
    const course = appState.currentCourse;
    if (!course) return;
    
    try {
        // Show loading
        const btn = document.getElementById('exportExcelBtn');
        if (!btn) return;
        
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        btn.disabled = true;
        
        // Prepare data
        const data = [];
        
        // Headers
        const headers = ['Student ID', 'Student Name', 'Year', 'Department'];
        course.dates.forEach(date => {
            const d = new Date(date);
            headers.push(d.toLocaleDateString('en-GB'));
        });
        headers.push('Present', 'Absent', 'Attendance %');
        data.push(headers);
        
        // Student rows
        course.students.forEach(student => {
            const row = [student.id, student.name, student.year, student.department];
            let presentCount = 0;
            let absentCount = 0;
            
            course.dates.forEach(date => {
                const status = course.attendance && course.attendance[date] ? 
                    (course.attendance[date][student.id] || 'absent') : 'absent';
                
                row.push(status === 'present' ? 'P' : 'A');
                if (status === 'present') presentCount++;
                else absentCount++;
            });
            
            const totalClasses = course.dates.length;
            const percentage = totalClasses > 0 
                ? ((presentCount / totalClasses) * 100).toFixed(2)
                : '0.00';
            
            row.push(presentCount, absentCount, percentage + '%');
            data.push(row);
        });
        
        // Summary row
        const summaryRow = ['SUMMARY', '', '', '', ...Array(course.dates.length).fill('')];
        const totalStudents = course.students.length;
        const totalClasses = course.dates.length;
        let totalPresents = 0;
        
        course.dates.forEach(date => {
            let dayPresents = 0;
            course.students.forEach(student => {
                if (course.attendance && course.attendance[date] && 
                    course.attendance[date][student.id] === 'present') {
                    dayPresents++;
                }
            });
            totalPresents += dayPresents;
        });
        
        const overallPercentage = totalClasses > 0 && totalStudents > 0 
            ? ((totalPresents / (totalStudents * totalClasses)) * 100).toFixed(2)
            : '0.00';
        
        summaryRow.push('', '', `Overall: ${overallPercentage}%`);
        data.push(summaryRow);
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Style columns
        const wscols = [
            {wch: 12}, // Student ID
            {wch: 25}, // Name
            {wch: 6},  // Year
            {wch: 15}, // Department
            ...Array(course.dates.length).fill({wch: 8}), // Dates
            {wch: 8},  // Present
            {wch: 8},  // Absent
            {wch: 12}  // Percentage
        ];
        ws['!cols'] = wscols;
        
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
        
        // Save file
        const today = new Date().toISOString().split('T')[0];
        const filename = `${course.id}_${course.year}_${today}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        showNotification(`Excel file "${filename}" downloaded`, 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showNotification('Failed to export: ' + error.message, 'error');
    } finally {
        const btn = document.getElementById('exportExcelBtn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-file-excel"></i> Excel Sheet';
            btn.disabled = false;
        }
    }
}

// ==================== PRINT FUNCTION ====================
function printAttendance() {
    const course = appState.currentCourse;
    if (!course) return;
    
    // Create print view
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showNotification('Please allow popups to print', 'error');
        return;
    }
    
    printWindow.document.write(`
        <html>
        <head>
            <title>Attendance Sheet - ${course.id}</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 20px; 
                    color: #333;
                }
                .print-header { 
                    text-align: center; 
                    margin-bottom: 30px;
                    border-bottom: 3px solid #2c3e50;
                    padding-bottom: 15px;
                }
                .print-header h1 { 
                    color: #2c3e50; 
                    margin: 0 0 10px 0;
                }
                .course-info { 
                    display: flex; 
                    justify-content: space-between; 
                    margin: 20px 0; 
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 5px;
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 20px;
                    font-size: 12px;
                }
                th, td { 
                    border: 1px solid #ddd; 
                    padding: 8px; 
                    text-align: center; 
                }
                th { 
                    background: #2c3e50; 
                    color: white; 
                    font-weight: bold;
                }
                .present { 
                    background: #d5f4e6; 
                    color: #27ae60;
                    font-weight: bold;
                }
                .absent { 
                    background: #fadbd8; 
                    color: #e74c3c;
                    font-weight: bold;
                }
                .summary-row { 
                    background: #34495e; 
                    color: white; 
                    font-weight: bold;
                }
                @media print {
                    @page { margin: 0.5cm; }
                    body { margin: 0.5cm; }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>University of Chittagong</h1>
                <h2>Department of Philosophy</h2>
                <h3>Attendance Sheet</h3>
            </div>
            
            <div class="course-info">
                <div>
                    <strong>Course:</strong> ${course.id} - ${course.name}<br>
                    <strong>Teacher:</strong> ${course.teacher}<br>
                    <strong>Year:</strong> ${course.year}
                </div>
                <div>
                    <strong>Printed:</strong> ${new Date().toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}<br>
                    <strong>Students:</strong> ${course.students.length}<br>
                    <strong>Classes:</strong> ${course.dates.length}
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th rowspan="2">SL</th>
                        <th rowspan="2">Student ID</th>
                        <th rowspan="2">Name</th>
    `);
    
    // Add dates in two rows
    course.dates.forEach((date, index) => {
        const d = new Date(date);
        const day = d.toLocaleDateString('en-GB', { weekday: 'short' });
        const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        printWindow.document.write(`<th colspan="2">${day}<br>${dateStr}</th>`);
    });
    
    printWindow.document.write(`<th colspan="3">Summary</th></tr><tr>`);
    
    // Second header row
    course.dates.forEach(() => {
        printWindow.document.write(`<th>P</th><th>A</th>`);
    });
    
    printWindow.document.write(`<th>Total</th><th>Present</th><th>%</th></tr></thead><tbody>`);
    
    // Add student rows
    course.students.forEach((student, index) => {
        printWindow.document.write(`<tr><td>${index + 1}</td><td>${student.id}</td><td>${student.name}</td>`);
        
        let presentCount = 0;
        course.dates.forEach(date => {
            const status = course.attendance && course.attendance[date] ? 
                (course.attendance[date][student.id] || 'absent') : 'absent';
            
            if (status === 'present') {
                printWindow.document.write(`<td class="present">✓</td><td class="absent"></td>`);
                presentCount++;
            } else {
                printWindow.document.write(`<td class="present"></td><td class="absent">✗</td>`);
            }
        });
        
        const totalClasses = course.dates.length;
        const percentage = totalClasses > 0 
            ? Math.round((presentCount / totalClasses) * 100)
            : 0;
        
        printWindow.document.write(`
            <td>${totalClasses}</td>
            <td>${presentCount}</td>
            <td><strong>${percentage}%</strong></td>
        </tr>`);
    });
    
    // Summary row
    const totalStudents = course.students.length;
    const totalClasses = course.dates.length;
    let totalPresents = 0;
    
    course.dates.forEach(date => {
        let dayPresents = 0;
        course.students.forEach(student => {
            if (course.attendance && course.attendance[date] && 
                course.attendance[date][student.id] === 'present') {
                dayPresents++;
            }
        });
        totalPresents += dayPresents;
    });
    
    const overallPercentage = totalClasses > 0 && totalStudents > 0 
        ? Math.round((totalPresents / (totalStudents * totalClasses)) * 100)
        : 0;
    
    printWindow.document.write(`
        <tr class="summary-row">
            <td colspan="3"><strong>TOTAL</strong></td>
    `);
    
    course.dates.forEach(date => {
        let dayPresents = 0;
        course.students.forEach(student => {
            if (course.attendance && course.attendance[date] && 
                course.attendance[date][student.id] === 'present') {
                dayPresents++;
            }
        });
        const dayAbsents = totalStudents - dayPresents;
        printWindow.document.write(`<td>${dayPresents}</td><td>${dayAbsents}</td>`);
    });
    
    printWindow.document.write(`
            <td>${totalStudents * totalClasses}</td>
            <td>${totalPresents}</td>
            <td><strong>${overallPercentage}%</strong></td>
        </tr>
    `);
    
    printWindow.document.write('</tbody></table></body></html>');
    printWindow.document.close();
    
    // Print after a short delay to ensure content is loaded
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

// ==================== SEARCH & CORRECTION ====================
function toggleCorrectionSection() {
    const correctionSection = document.getElementById('correctionSection');
    if (!correctionSection) return;
    
    const isVisible = !correctionSection.classList.contains('hidden');
    
    if (isVisible) {
        correctionSection.classList.add('hidden');
    } else {
        correctionSection.classList.remove('hidden');
        const dataManagementSection = document.getElementById('dataManagementSection');
        if (dataManagementSection) dataManagementSection.classList.add('hidden');
        populateSearchCourses();
    }
}

function searchAttendance() {
    const dateInput = document.getElementById('searchDate');
    const courseSelect = document.getElementById('searchCourse');
    const studentIdInput = document.getElementById('searchStudentId');
    
    if (!dateInput || !courseSelect || !studentIdInput) return;
    
    const date = dateInput.value;
    const courseId = courseSelect.value;
    const searchTerm = studentIdInput.value.trim().toLowerCase();
    
    if (!date || !courseId) {
        showNotification('Please select date and course', 'error');
        return;
    }
    
    const course = appState.courses.find(c => c.id === courseId);
    if (!course) return;
    
    // Check if date exists in course
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
        resultsDiv.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #7f8c8d;">
                <i class="fas fa-search"></i>
                <p>No students found matching "${searchTerm}"</p>
            </div>
        `;
        return;
    }
    
    // Show date info
    const dateObj = new Date(date);
    resultsDiv.innerHTML += `
        <div style="background: #3498db; color: white; padding: 10px 15px; border-radius: 5px; margin-bottom: 15px;">
            <strong>Date:</strong> ${dateObj.toLocaleDateString('en-GB', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })}
            <br><strong>Course:</strong> ${course.id} - ${course.name}
        </div>
    `;
    
    filteredStudents.forEach(student => {
        const status = course.attendance && course.attendance[date] ? 
            (course.attendance[date][student.id] || 'absent') : 'absent';
        
        const card = document.createElement('div');
        card.className = `student-result-card ${status === 'present' ? '' : 'absent'}`;
        
        card.innerHTML = `
            <div class="student-result-header">
                <div>
                    <div style="font-weight: bold; color: #2c3e50; font-size: 1.1rem;">${student.id}</div>
                    <div style="color: #5d6d7e; margin: 5px 0;">${student.name}</div>
                    <div style="font-size: 0.85rem; color: #7f8c8d;">
                        ${student.year} Year | ${student.department}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: ${status === 'present' ? '#27ae60' : '#e74c3c'}">
                        ${status.toUpperCase()}
                    </div>
                </div>
            </div>
            <div class="student-result-actions">
                <button onclick="correctStudentAttendance('${courseId}', '${student.id}', '${date}', 'present')" 
                    class="btn btn-success" style="padding: 5px 10px; font-size: 0.9rem;">
                    <i class="fas fa-check"></i> Mark Present
                </button>
                <button onclick="correctStudentAttendance('${courseId}', '${student.id}', '${date}', 'absent')" 
                    class="btn btn-danger" style="padding: 5px 10px; font-size: 0.9rem;">
                    <i class="fas fa-times"></i> Mark Absent
                </button>
            </div>
        `;
        
        resultsDiv.appendChild(card);
    });
}

function correctStudentAttendance(courseId, studentId, date, newStatus) {
    const course = appState.courses.find(c => c.id === courseId);
    if (!course) return;
    
    if (!course.attendance[date]) {
        course.attendance[date] = {};
    }
    
    const oldStatus = course.attendance[date][studentId] || 'absent';
    course.attendance[date][studentId] = newStatus;
    saveCourses();
    
    // Update the displayed result
    searchAttendance();
    
    showNotification(`Corrected ${studentId} from ${oldStatus} to ${newStatus}`, 'success');
    vibrate([100, 50, 100]);
}

function populateSearchCourses() {
    const select = document.getElementById('searchCourse');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select Course</option>';
    
    appState.courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = `${course.id} - ${course.name}`;
        select.appendChild(option);
    });
}

// ==================== DATA MANAGEMENT ====================
function toggleDataManagement() {
    const dataSection = document.getElementById('dataManagementSection');
    if (!dataSection) return;
    
    const isVisible = !dataSection.classList.contains('hidden');
    
    if (isVisible) {
        dataSection.classList.add('hidden');
    } else {
        dataSection.classList.remove('hidden');
        const correctionSection = document.getElementById('correctionSection');
        if (correctionSection) correctionSection.classList.add('hidden');
        populateImportCourseSelect();
    }
}

function backupData() {
    try {
        const backup = {
            version: SECURITY_CONFIG.dataVersion,
            courses: appState.courses,
            timestamp: new Date().toISOString(),
            teacherName: appState.teacherName,
            totalCourses: appState.courses.length,
            totalStudents: appState.courses.reduce((sum, course) => sum + course.students.length, 0)
        };
        
        const blob = new Blob([JSON.stringify(backup, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        const today = new Date().toISOString().split('T')[0];
        const filename = `attendance-backup-${today}.json`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification(`Backup saved as ${filename}`, 'success');
        
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
            
            // Validate backup file
            if (!backup.version || !backup.courses || !Array.isArray(backup.courses)) {
                throw new Error('Invalid backup file format');
            }
            
            if (backup.version !== SECURITY_CONFIG.dataVersion) {
                if (!confirm(`Backup version (${backup.version}) differs from current (${SECURITY_CONFIG.dataVersion}). Continue anyway?`)) {
                    return;
                }
            }
            
            appState.courses = backup.courses;
            if (backup.teacherName) {
                appState.teacherName = backup.teacherName;
                localStorage.setItem('teacherName', backup.teacherName);
            }
            
            saveCourses();
            renderCourses();
            
            showNotification(`Data restored successfully (${backup.courses.length} courses)`, 'success');
            
        } catch (error) {
            console.error('Restore error:', error);
            showNotification('Failed to restore: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (!confirm('WARNING: This will delete ALL data including courses, students, and attendance records. This action cannot be undone. Are you sure?')) {
        return;
    }
    
    if (!confirm('FINAL WARNING: All data will be permanently deleted. Type "DELETE" to confirm.')) {
        return;
    }
    
    const userInput = prompt('Type "DELETE" to confirm permanent deletion:');
    if (userInput !== 'DELETE') {
        showNotification('Deletion cancelled', 'info');
        return;
    }
    
    appState.courses = [];
    localStorage.removeItem('attendanceCourses');
    localStorage.removeItem('teacherName');
    
    renderCourses();
    showNotification('All data has been cleared', 'success');
}

function populateImportCourseSelect() {
    const select = document.getElementById('importCourseSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select Course</option>';
    
    appState.courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = `${course.id} - ${course.name}`;
        select.appendChild(option);
    });
}

async function importStudentsFromCSV(file, courseId) {
    try {
        const course = appState.courses.find(c => c.id === courseId);
        if (!course) {
            showNotification('Course not found', 'error');
            return;
        }
        
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length === 0) {
            showNotification('CSV file is empty', 'error');
            return;
        }
        
        const students = [];
        let importedCount = 0;
        let errorCount = 0;
        
        // Process each line (skip header if present)
        const startIndex = lines[0].toLowerCase().includes('id') ? 1 : 0;
        
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Handle CSV values (simple comma split for now)
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            
            if (values.length >= 2) {
                const [id, name] = values;
                const year = values[2] || course.year;
                const department = values[3] || 'Philosophy';
                
                if (id && name) {
                    // Check for duplicate ID
                    if (!course.students.some(s => s.id === id)) {
                        students.push({
                            id: id,
                            name: name,
                            year: year,
                            department: department
                        });
                        importedCount++;
                    } else {
                        console.warn(`Duplicate student ID: ${id}`);
                        errorCount++;
                    }
                } else {
                    errorCount++;
                }
            } else {
                errorCount++;
            }
        }
        
        if (importedCount > 0) {
            // Merge with existing students
            course.students = [...course.students, ...students];
            saveCourses();
            
            if (appState.currentCourse && appState.currentCourse.id === courseId) {
                renderAttendanceTable();
            }
            
            let message = `Imported ${importedCount} students`;
            if (errorCount > 0) {
                message += ` (${errorCount} errors)`;
            }
            
            showNotification(message, 'success');
        } else {
            showNotification('No valid students found in CSV', 'error');
        }
        
    } catch (error) {
        console.error('CSV import error:', error);
        showNotification('Failed to import CSV: ' + error.message, 'error');
    }
}

// ==================== SHARE FUNCTIONS ====================
function shareViaEmail() {
    const course = appState.currentCourse;
    if (!course) return;
    
    const today = new Date().toLocaleDateString('en-GB');
    const subject = `Attendance Report - ${course.id} - ${today}`;
    const body = `
Attendance Report
================

Course: ${course.id} - ${course.name}
Teacher: ${appState.teacherName}
Date: ${today}
Total Students: ${course.students.length}
Total Classes: ${course.dates.length}

Attendance Summary:
${course.dates.map(date => {
    const dateObj = new Date(date);
    let presentCount = 0;
    course.students.forEach(student => {
        if (course.attendance[date] && course.attendance[date][student.id] === 'present') {
            presentCount++;
        }
    });
    const percentage = Math.round((presentCount / course.students.length) * 100);
    return `${dateObj.toLocaleDateString('en-GB')}: ${presentCount}/${course.students.length} (${percentage}%)`;
}).join('\n')}

Generated by: Attendance System - Department of Philosophy
University of Chittagong
            `.trim();
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function shareViaWhatsApp() {
    const course = appState.currentCourse;
    if (!course) return;
    
    const today = new Date().toLocaleDateString('en-GB');
    const text = `*Attendance Report*\n\n*Course:* ${course.id} - ${course.name}\n*Teacher:* ${appState.teacherName}\n*Date:* ${today}\n*Students:* ${course.students.length}\n*Classes:* ${course.dates.length}\n\nView full report in Attendance System`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

async function copyToClipboard() {
    const course = appState.currentCourse;
    if (!course) return;
    
    const today = new Date().toLocaleDateString('en-GB');
    const text = `Attendance Report: ${course.id} - ${course.name}\nTeacher: ${appState.teacherName}\nDate: ${today}\nStudents: ${course.students.length}\nClasses: ${course.dates.length}`;
    
    try {
        await navigator.clipboard.writeText(text);
        showNotification('Copied to clipboard', 'success');
    } catch (err) {
        console.error('Failed to copy:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Copied to clipboard', 'success');
    }
}

function hideShareOptions() {
    const shareOptions = document.getElementById('shareOptions');
    if (shareOptions) shareOptions.classList.add('hidden');
}

// ==================== EVENT LISTENERS SETUP ====================
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
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
    
    // Password Toggle
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', togglePasswordVisibility);
    }
    
    // Dashboard Navigation
    const backToDashboardBtn = document.getElementById('backToDashboardBtn');
    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener('click', showDashboard);
    }
    
    const addCourseBtn = document.getElementById('addCourseBtn');
    if (addCourseBtn) {
        addCourseBtn.addEventListener('click', showAddCourseModal);
    }
    
    const searchCorrectionBtn = document.getElementById('searchCorrectionBtn');
    if (searchCorrectionBtn) {
        searchCorrectionBtn.addEventListener('click', toggleCorrectionSection);
    }
    
    const dataManagementBtn = document.getElementById('dataManagementBtn');
    if (dataManagementBtn) {
        dataManagementBtn.addEventListener('click', toggleDataManagement);
    }
    
    // Attendance Controls
    const attendanceStartBtn = document.getElementById('attendanceStartBtn');
    if (attendanceStartBtn) {
        attendanceStartBtn.addEventListener('click', startAttendance);
    }
    
    // Stop Attendance Button
    const stopAttendanceBtn = document.getElementById('stopAttendanceBtn');
    if (stopAttendanceBtn) {
        stopAttendanceBtn.addEventListener('click', function() {
            const popupOverlay = document.getElementById('attendancePopupOverlay');
            if (popupOverlay) popupOverlay.classList.add('hidden');
            attendanceState.isActive = false;
            showNotification('Attendance stopped', 'info');
        });
    }
    
    // Attendance Buttons (Popup)
    const presentBtn = document.getElementById('presentBtn');
    if (presentBtn) {
        presentBtn.addEventListener('click', function() {
            markAttendance('present');
        });
    }
    
    const absentBtn = document.getElementById('absentBtn');
    if (absentBtn) {
        absentBtn.addEventListener('click', function() {
            markAttendance('absent');
        });
    }
    
    // Export/Print
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportToExcel);
    }
    
    const printSheetBtn = document.getElementById('printSheetBtn');
    if (printSheetBtn) {
        printSheetBtn.addEventListener('click', printAttendance);
    }
    
    // Share Options
    const shareAttendanceBtn = document.getElementById('shareAttendanceBtn');
    if (shareAttendanceBtn) {
        shareAttendanceBtn.addEventListener('click', function() {
            const shareOptions = document.getElementById('shareOptions');
            if (shareOptions) shareOptions.classList.remove('hidden');
        });
    }
    
    const shareEmailBtn = document.getElementById('shareEmailBtn');
    if (shareEmailBtn) {
        shareEmailBtn.addEventListener('click', shareViaEmail);
    }
    
    const shareWhatsappBtn = document.getElementById('shareWhatsappBtn');
    if (shareWhatsappBtn) {
        shareWhatsappBtn.addEventListener('click', shareViaWhatsApp);
    }
    
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', copyToClipboard);
    }
    
    const closeShareBtn = document.getElementById('closeShareBtn');
    if (closeShareBtn) {
        closeShareBtn.addEventListener('click', hideShareOptions);
    }
    
    // Quick Correction
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) {
        undoBtn.addEventListener('click', undoLastAttendance);
    }
    
    const dismissQuickBtn = document.getElementById('dismissQuickBtn');
    if (dismissQuickBtn) {
        dismissQuickBtn.addEventListener('click', hideQuickCorrection);
    }
    
    // Search & Correction
    const searchAttendanceBtn = document.getElementById('searchAttendanceBtn');
    if (searchAttendanceBtn) {
        searchAttendanceBtn.addEventListener('click', searchAttendance);
    }
    
    const closeCorrectionBtn = document.getElementById('closeCorrectionBtn');
    if (closeCorrectionBtn) {
        closeCorrectionBtn.addEventListener('click', function() {
            const correctionSection = document.getElementById('correctionSection');
            const searchResults = document.getElementById('searchResults');
            
            if (correctionSection) correctionSection.classList.add('hidden');
            if (searchResults) searchResults.classList.add('hidden');
        });
    }
    
    // Data Management
    const backupDataBtn = document.getElementById('backupDataBtn');
    if (backupDataBtn) {
        backupDataBtn.addEventListener('click', backupData);
    }
    
    const restoreDataFile = document.getElementById('restoreDataFile');
    if (restoreDataFile) {
        restoreDataFile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                restoreData(file);
                e.target.value = '';
            }
        });
    }
    
    const clearAllDataBtn = document.getElementById('clearAllDataBtn');
    if (clearAllDataBtn) {
        clearAllDataBtn.addEventListener('click', clearAllData);
    }
    
    const importCSVFile = document.getElementById('importCSVFile');
    if (importCSVFile) {
        importCSVFile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const courseId = document.getElementById('importCourseSelect')?.value;
            
            if (!courseId) {
                showNotification('Please select a course first', 'error');
                e.target.value = '';
                return;
            }
            
            if (file) {
                importStudentsFromCSV(file, courseId);
                e.target.value = '';
            }
        });
    }
    
    const closeDataManagementBtn = document.getElementById('closeDataManagementBtn');
    if (closeDataManagementBtn) {
        closeDataManagementBtn.addEventListener('click', function() {
            const dataManagementSection = document.getElementById('dataManagementSection');
            if (dataManagementSection) dataManagementSection.classList.add('hidden');
        });
    }
    
    console.log('All event listeners setup complete');
}

// ==================== ESSENTIAL LISTENERS ====================
function setupEssentialListeners() {
    console.log('Setting up essential listeners...');
    
    // Network Status
    window.addEventListener('online', () => {
        appState.online = true;
        updateNetworkStatus();
        showNotification('Back online', 'success');
    });

    window.addEventListener('offline', () => {
        appState.online = false;
        updateNetworkStatus();
        showNotification('Working offline', 'info');
    });
    
    // PWA Install
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        if (!window.matchMedia('(display-mode: standalone)').matches) {
            setTimeout(() => {
                const installPrompt = document.getElementById('installPrompt');
                if (installPrompt) {
                    installPrompt.classList.remove('hidden');
                }
            }, 3000);
        }
    });
    
    // Install Prompt Buttons
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    showNotification('App installed successfully!', 'success');
                }
                deferredPrompt = null;
                const installPrompt = document.getElementById('installPrompt');
                if (installPrompt) installPrompt.classList.add('hidden');
            }
        });
    }
    
    const dismissInstallBtn = document.getElementById('dismissInstallBtn');
    if (dismissInstallBtn) {
        dismissInstallBtn.addEventListener('click', () => {
            const installPrompt = document.getElementById('installPrompt');
            if (installPrompt) installPrompt.classList.add('hidden');
        });
    }
    
    updateNetworkStatus();
}

// ==================== GLOBAL FUNCTIONS (for onclick attributes) ====================
// Make functions available globally for onclick attributes
window.markAttendance = markAttendance;
window.undoLastAttendance = undoLastAttendance;
window.hideQuickCorrection = hideQuickCorrection;
window.correctStudentAttendance = correctStudentAttendance;
window.openCourse = openCourse;
window.deleteCourse = deleteCourse;
window.showAddCourseModal = showAddCourseModal;
window.shareViaEmail = shareViaEmail;
window.shareViaWhatsApp = shareViaWhatsApp;
window.copyToClipboard = copyToClipboard;
window.hideShareOptions = hideShareOptions;

// ==================== HELPER FUNCTIONS ====================
function bindButtons() {
    const ids = [
        "exportExcelBtn",
        "printSheetBtn",
        "shareAttendanceBtn",
        "attendanceStartBtn"
    ];

    ids.forEach(id => {
        if (!document.getElementById(id)) {
            console.warn(id + " not found");
        }
    });
}

// ==================== INITIALIZE APP ====================
function initializeApp() {
    console.log('Initializing app...');
    
    // Setup essential listeners first
    setupEssentialListeners();
    
    // Check auto-login
    const isLoggedIn = checkAutoLogin();
    
    if (!isLoggedIn) {
        // Show login screen if not auto-logged in
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) {
            loginScreen.classList.remove('hidden');
        }
        
        // Setup login form listeners
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
        
        const togglePassword = document.getElementById('togglePassword');
        if (togglePassword) {
            togglePassword.addEventListener('click', togglePasswordVisibility);
        }
    }
    
    // Setup other event listeners
    setupEventListeners();
    
    console.log('App initialized successfully');
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
