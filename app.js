// attendance-system/app.js
// University of Chittagong - Department of Philosophy
// Attendance Management System
// Version: 2.0
//
// NOTE: This file is a cleaned / fixed version of the original provided file.
// Main fixes applied:
// - Removed duplicate/contradictory functions and event bindings
// - Fixed syntax error in shareViaWhatsApp (unterminated template literal)
// - Removed stray/invalid students.push(...) that referenced undefined variables
// - Replaced undefined references (currentCourse, currentAttendance, currentDate) with appState / attendanceState usage
// - Consolidated login handler and ensured single initialization flow
// - Fixed renderAttendanceTable reference to course and attendanceCourseInfo update
// - Removed duplicate generateExcel & its incorrect event binding
// - Improved CSV import to handle MA group and avoid runtime errors
// - Kept original features and UI hooks intact

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
            if (offlineIndicator) offlineIndicator.style.display = 'none';
        }
    } else {
        if (offlineIndicator) {
            offlineIndicator.style.display = 'block';
            if (onlineIndicator) onlineIndicator.style.display = 'none';
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
    if (e && e.preventDefault) e.preventDefault();

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
    const icon = this && this.querySelector ? this.querySelector('i') : null;
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

    const year = prompt('Enter Year (1, 2, 3, 4, MA):', '1') || '1';
    const teacher = prompt('Enter Teacher Name:', appState.teacherName) || appState.teacherName;

    const newCourse = {
        id: courseId.toUpperCase().trim(),
        name: courseName.trim(),
        year: year.trim(),
        teacher: teacher.trim(),
        created: new Date().toISOString(),
        students: [],
        dates: [],
        attendance: {},
        group: null
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
        courseId: appState.currentCourse ? appState.currentCourse.id : null
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

    // Update attendanceCourseInfo safely
    const attendanceCourseInfoEl = document.getElementById("attendanceCourseInfo");
    if (attendanceCourseInfoEl) {
        attendanceCourseInfoEl.innerText =
            course.year === "MA"
            ? `MA | Group ${course.group || 'N/A'}`
            : course.year;
    }

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
        showNotification('Failed to export: ' + (error.message || error), 'error');
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
    `}]}]}]}]}