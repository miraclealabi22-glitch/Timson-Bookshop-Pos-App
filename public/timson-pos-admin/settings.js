document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('settingsForm');
    const nameInput = document.getElementById('settingName');
    const emailInput = document.getElementById('settingEmail');
    const alertContainer = document.getElementById('settingsAlert');

    // load current user data
    import("https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js").then(({getAuth, onAuthStateChanged})=>{
        const auth = getAuth();
        onAuthStateChanged(auth, user => {
            if (user) {
                nameInput.value = user.displayName || '';
                emailInput.value = user.email || '';
            }
        });
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        import("https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js").then(({getAuth, updateProfile})=>{
            const auth = getAuth();
            const user = auth.currentUser;
            if (user) {
                updateProfile(user, { displayName: nameInput.value })
                    .then(() => {
                        alertContainer.innerHTML = `<div class="alert alert-success">Profile updated.</div>`;
                    })
                    .catch(err => {
                        alertContainer.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
                    });
            }
        });
    });
});