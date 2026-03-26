document.addEventListener("DOMContentLoaded", function () {
    // Firebase authentication setup for user profile across all admin pages
    (function setupFirebaseAuth(){
        import("https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js").then(({initializeApp})=>{
            import("https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js").then(({getAuth,onAuthStateChanged})=>{
                const firebaseConfig = {
                    apiKey: "AIzaSyACgmBzV74SwJLVyUCMdN1xOxZjMI4UgCg",
                    authDomain: "posapp-ed05a.firebaseapp.com",
                    projectId: "posapp-ed05a",
                    storageBucket: "posapp-ed05a.firebasestorage.app",
                    messagingSenderId: "486175914054",
                    appId: "1:486175914054:web:b2f7d71ae98c451f417247"
                };
                const app = initializeApp(firebaseConfig);
                const auth = getAuth(app);
                onAuthStateChanged(auth, user => {
                    if (user) {
                        const picContainer = document.getElementById('profilePics');
                        let imgSrc = user.photoURL;
                        if (!imgSrc) {
                            const nameForAvatar = encodeURIComponent(user.displayName || user.email || 'User');
                            imgSrc = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=4361ee&color=fff`;
                        }
                        if (picContainer) {
                            picContainer.innerHTML = `<img src="${imgSrc}" alt="User Profile" class="rounded-circle" width="36" height="36">`;
                        }
                        const nameSpan = document.querySelector('.user-profile span');
                        if (nameSpan) {
                            nameSpan.textContent = user.displayName || user.email || 'Admin';
                        }
                        // panel update if exists
                        const panelPic = document.getElementById('panelPic');
                        const panelName = document.getElementById('panelName');
                        const panelEmail = document.getElementById('panelEmail');
                        if (panelPic) {
                            panelPic.innerHTML = `<img src="${imgSrc}" alt="Profile" class="rounded-circle" width="48" height="48">`;
                        }
                        if (panelName) panelName.textContent = user.displayName || 'User';
                        if (panelEmail) panelEmail.textContent = user.email || '';
                    } else {
                        window.location.href = '../timson-pos-login/index.html';
                    }
                });
            });
        });
    })();

    // 1. Sidebar Toggle Logic
    const sidebarCollapse = document.getElementById('sidebarCollapse');
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');

    if (sidebarCollapse) {
        sidebarCollapse.addEventListener('click', function () {
            sidebar.classList.toggle('active');
            content.classList.toggle('active');

            // Toggle overlay on mobile
            if (window.innerWidth <= 991.98) {
                document.body.classList.toggle('sidebar-open');
            }
        });
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function (e) {
        if (window.innerWidth <= 991.98 && document.body.classList.contains('sidebar-open')) {
            if (!sidebar.contains(e.target) && !sidebarCollapse.contains(e.target)) {
                sidebar.classList.remove('active');
                content.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
        }
    });

    // Handle window resize
    window.addEventListener('resize', function () {
        if (window.innerWidth > 991.98) {
            sidebar.classList.remove('active');
            content.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        }
    });

    // 2. Chart.js Implementation for Sales Chart
    const ctx = document.getElementById('salesChart');
    let salesChart;

    if (ctx) {
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = '#64748b'; // Tailwind slate-500

        const initChart = (type) => {
            let labels, data;

            // Mock Data depending on selected filter
            if (type === 'daily') {
                labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                data = [1200, 1900, 1500, 2200, 1800, 2800, 2450];
            } else if (type === 'weekly') {
                labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
                data = [8500, 11200, 9800, 14500];
            } else {
                labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                data = [45000, 52000, 48000, 61000, 59000, 68000, 72000, 70000, 75000, 82000, 91000, 110000];
            }

            // Destroy existing chart if it exists
            if (salesChart) {
                salesChart.destroy();
            }

            salesChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Gross Sales',
                        data: data,
                        backgroundColor: 'rgba(67, 97, 238, 0.1)',
                        borderColor: '#4361ee', // Primary color
                        borderWidth: 3,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#4361ee',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4 // Smooth curves
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: '#111827', // Tailwind gray-900
                            padding: 12,
                            titleFont: { size: 13, weight: '500', family: "'Inter', sans-serif" },
                            bodyFont: { size: 14, weight: 'bold', family: "'Inter', sans-serif" },
                            displayColors: false,
                            cornerRadius: 8,
                            callbacks: {
                                label: function (context) {
                                    return '₦' + context.parsed.y.toLocaleString();
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                borderDash: [4, 4],
                                color: '#e2e8f0', // Tailwind slate-200
                                drawBorder: false
                            },
                            ticks: {
                                padding: 10,
                                callback: function (value) {
                                    if (value >= 1000) return '₦' + (value / 1000) + 'k';
                                    return '₦' + value;
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false,
                                drawBorder: false
                            },
                            ticks: {
                                padding: 10,
                                font: {
                                    weight: '500'
                                }
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index',
                    },
                }
            });
        };

        // Initialize with default 'weekly' data
        initChart('weekly');

        // Handle Filter Change
        const chartFilter = document.getElementById('chartFilter');
        if (chartFilter) {
            chartFilter.addEventListener('change', (e) => {
                initChart(e.target.value);
            });
        }

        // Logout button logic (fires across all admin pages)
        const logoutBtnElem = document.getElementById('logoutBtn');
        if (logoutBtnElem) {
            logoutBtnElem.addEventListener('click', (e) => {
                e.preventDefault();
                import("https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js").then(({getAuth, signOut}) => {
                    const auth = getAuth();
                    signOut(auth).then(() => {
                        window.location.href = '../timson-pos-login/index.html';
                    });
                });
            });
        }
    }
});
