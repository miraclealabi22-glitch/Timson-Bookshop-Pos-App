document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    const toggleButtons = document.querySelectorAll('.password-toggle');
    const alertContainer = document.getElementById('alertContainer');

    const passwordField = document.getElementById('password');
    const confirmPasswordField = document.getElementById('confirmPassword');

    // 1. Toggle Password Visibility Show/Hide
    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            const icon = button.querySelector('i');

            if (targetInput.type === 'password') {
                targetInput.type = 'text';
                icon.classList.remove('bi-eye');
                icon.classList.add('bi-eye-slash');
            } else {
                targetInput.type = 'password';
                icon.classList.remove('bi-eye-slash');
                icon.classList.add('bi-eye');
            }
        });
    });

    // Custom Validation logic for matching passwords
    function validatePasswords() {
        if (confirmPasswordField.value !== passwordField.value && confirmPasswordField.value !== '') {
            confirmPasswordField.setCustomValidity("Passwords do not match");
        } else {
            confirmPasswordField.setCustomValidity("");
        }
    }

    passwordField.addEventListener('input', validatePasswords);
    confirmPasswordField.addEventListener('input', validatePasswords);

    // 2. Form Submission & Validation Handler
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Clear previous alerts
        alertContainer.innerHTML = '';

        validatePasswords(); // run one last time before checkValidity

        // Check native HTML5 form validity
        if (!signupForm.checkValidity()) {
            e.stopPropagation();
            signupForm.classList.add('was-validated');
            return;
        }

        signupForm.classList.add('was-validated');

        // Gather Data for Firebase (Conceptual Prep)
        const formData = {
            fullName: document.getElementById('fullName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            businessName: document.getElementById('businessName').value.trim(),
            role: document.getElementById('userRole').value,
            password: passwordField.value
        };

        // UI Loading State Transition
        const btnText = document.getElementById('btnText');
        const btnSpinner = document.getElementById('btnSpinner');
        // directly grab the create-account button by its new id
        const submitBtn = document.getElementById('createBtn');

        submitBtn.disabled = true;
        btnText.textContent = 'Creating Account...';
        btnSpinner.classList.remove('d-none');

        try {
            // Real Firebase account creation
            const { getAuth, createUserWithEmailAndPassword, updateProfile } = await import("https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js");
            const auth = getAuth();
            const userCred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            await updateProfile(userCred.user, { displayName: formData.fullName });
            showAlert('success', 'Account successfully created! Redirecting to dashboard...');
            signupForm.reset();
            signupForm.classList.remove('was-validated');
            setTimeout(() => { window.location.href = '../timson-pos-admin/admin-dashboard.html'; }, 1000);
        } catch (error) {
            // Error Scenario Handling
            showAlert('danger', error.message || 'Failed to create account. Please try again.');
        } finally {
            // Restore UI Button State
            submitBtn.disabled = false;
            btnText.textContent = 'Create Account';
            btnSpinner.classList.add('d-none');
        }
    });

    // Helper for Bootstrap Alerts
    function showAlert(type, message) {
        const icon = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show d-flex align-items-center" role="alert">
                <i class="bi ${icon} me-2 fs-5"></i>
                <div>${message}</div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        alertContainer.innerHTML = alertHtml;
    }
});
