// ==========================================================
// 0. GLOBAL CONFIGURATION & INITIALIZATION
// ==========================================================

// Firebase Config - HARDCODED AS REQUESTED
const firebaseConfig = {
    apiKey: "AIzaSyAXoFBFwxVHZs-pxdZWKv-k0eAFPrDzmtE",
    authDomain: "hue4u-fe4ad.firebaseapp.com",
    projectId: "hue4u-fe4ad",
    storageBucket: "hue4u-fe4ad.firebasestorage.app" // Ensure this matches your actual bucket, usually projectId.appspot.com
};

// Determine app ID for Firestore paths (using your project ID as a fallback)
const appId = firebaseConfig.projectId;

// Initialize Firebase App
const firebaseApp = firebase.initializeApp(firebaseConfig);

// Firebase Services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Google Cloud Vision API Key - HARDCODED AS REQUESTED
const VISION_API_KEY = "AIzaSyAXoFBFwxVHZs-pxdZWKv-k0eAFPrDzmtE"; // Using the same key as Firebase API Key as provided

// Global variable to indicate if OpenCV is ready
// This is necessary because opencv.js loads asynchronously and needs a way to signal readiness.
let opencvIsReady = false;

// Define onOpenCvReady globally so HTML can call it immediately
// This function is called by the <script> tag for opencv.js once it's loaded.
window.onOpenCvReady = function() {
    console.log('OpenCV.js script loaded. Checking for cv object and imread function...');

    // Poll for the 'cv' object and its 'imread' function
    // This is more robust than a single setTimeout as cv.imread might not be immediately available
    const checkOpenCV = () => {
        if (typeof cv !== 'undefined' && typeof cv.imread === 'function') {
            console.log('OpenCV.js is fully ready! cv object and imread function are available.');
            opencvIsReady = true; // Set the flag to true
            // Update message if on app.html
            if (document.getElementById('image-load-message')) {
                document.getElementById('image-load-message').innerText = "OpenCV ready. Upload or capture an image to begin.";
            }
        } else {
            console.log('OpenCV.js not fully initialized yet. Retrying...');
            setTimeout(checkOpenCV, 100); // Re-check every 100ms
        }
    };
    checkOpenCV(); // Start checking
};

// Utility function to wait for OpenCV to be ready
// This function returns a Promise that resolves when opencvIsReady is true.
async function waitForOpenCV() {
    if (opencvIsReady) {
        console.log("OpenCV is already ready.");
        return;
    }
    console.log("Waiting for OpenCV to become ready...");
    if (document.getElementById('image-load-message')) {
        document.getElementById('image-load-message').innerText = "Loading OpenCV... Please wait.";
    }

    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
            if (opencvIsReady) {
                clearInterval(checkInterval);
                console.log("OpenCV is now ready for use.");
                resolve();
            }
        }, 100); // Check every 100ms

        // Add a timeout to reject the promise if OpenCV never becomes ready
        setTimeout(() => {
            if (!opencvIsReady) {
                clearInterval(checkInterval);
                const errorMessage = "OpenCV.js failed to initialize within a reasonable time (10 seconds).";
                console.error(errorMessage);
                if (document.getElementById('image-load-message')) {
                    document.getElementById('image-load-message').innerText = "Error: OpenCV library failed to load. Please check your network connection or the opencv.js file.";
                }
                reject(new Error(errorMessage));
            }
        }, 10000); // 10 seconds timeout
    });
}


// Firebase Auth Listener (runs once Firebase is initialized)
// This will handle redirects and data loading based on user auth state.
auth.onAuthStateChanged(user => {
    if (user) {
        console.log("Auth state changed: User is logged in.", user.uid);
        if (window.location.pathname.includes('app.html')) {
            // Load user data regardless of OpenCV readiness, as requested by the user.
            // OpenCV readiness will be handled within image processing functions.
            loadUserProfile(user); // Moved function definition to below
            loadHistory(user); // Moved function definition to below
        }
    } else {
        console.log("Auth state changed: No user logged in.");
        // If not logged in, redirect to index.html (only if on app.html)
        if (window.location.pathname.includes('app.html')) {
            window.location.href = "index.html";
        }
    }
});


// ==========================================================
// 1. INDEX.HTML (Login/Signup Page) Specific Logic
// ==========================================================

// DOM Elements for index.html (declared here but assigned inside DOMContentLoaded or dynamically)
let authMessageDiv;
let medicalReportInput;
let medicalReportFilenameDisplay;
let medicalReportUploadBox;

// This ensures general index.html elements are loaded before JavaScript tries to access them.
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('index.html')) {
        authMessageDiv = document.getElementById("auth-message");
        if (!authMessageDiv) {
            console.warn("Auth message div not found in DOM at DOMContentLoaded. Creating one.");
            authMessageDiv = document.createElement('p');
            authMessageDiv.id = "auth-message";
            authMessageDiv.className = "text-center text-sm mb-4 text-red-600 hidden";
            const loginForm = document.getElementById('login-form');
            if (loginForm) {
                loginForm.parentNode.insertBefore(authMessageDiv, loginForm);
            } else {
                document.body.appendChild(authMessageDiv);
            }
        }
    }
});

// Function to activate file upload listeners on the signup form
// This function is called only when the signup tab is clicked.
function activateSignupFormInteractions() {
    console.log("[index.html] Attempting to activate signup form interactions...");
    medicalReportInput = document.getElementById("medical-report-input");
    medicalReportFilenameDisplay = document.getElementById("medical-report-filename");
    medicalReportUploadBox = document.getElementById("medical-report-upload-box");

    if (medicalReportUploadBox && medicalReportInput && medicalReportFilenameDisplay) {
        console.log("[index.html] Medical report upload elements found for dynamic activation.");

        medicalReportUploadBox.removeEventListener("click", handleMedicalReportUploadClick);
        medicalReportInput.removeEventListener("change", handleMedicalReportInputChange);

        medicalReportUploadBox.addEventListener("click", handleMedicalReportUploadClick);
        medicalReportInput.addEventListener("change", handleMedicalReportInputChange);
        console.log("[index.html] Medical report upload listeners attached.");
    } else {
        console.warn("[index.html] Medical report upload elements NOT found during dynamic activation. Check IDs or HTML structure.");
    }
}

// Event handler for medical report upload box click
function handleMedicalReportUploadClick() {
    console.log("[index.html] Medical report upload box clicked.");
    if (medicalReportInput) {
        medicalReportInput.click();
    } else {
        console.error("[index.html] medicalReportInput is null when trying to click.");
    }
}

// Event handler for medical report input change
function handleMedicalReportInputChange() {
    console.log("[index.html] File input change detected.");
    if (medicalReportInput && medicalReportFilenameDisplay && medicalReportUploadBox) {
        if (medicalReportInput.files.length > 0) {
            medicalReportFilenameDisplay.innerText = medicalReportInput.files[0].name;
            medicalReportUploadBox.classList.add('has-file');
            console.log(`[index.html] Selected file: ${medicalReportInput.files[0].name}`);
        } else {
            medicalReportFilenameDisplay.innerText = "Click to upload file";
            medicalReportUploadBox.classList.remove('has-file');
            console.log("[index.html] No file selected.");
        }
    } else {
        console.error("[index.html] One or more medical report elements are null during change handling.");
    }
}

// Function to display auth messages
function showAuthMessage(message, isError = true) {
    if (!authMessageDiv) {
        authMessageDiv = document.getElementById("auth-message");
        if (!authMessageDiv) {
            console.error("Critical: authMessageDiv still not found. Cannot display message.");
            console.error(`Message (fallback): ${message}`);
            return;
        }
    }
    authMessageDiv.innerText = message;
    authMessageDiv.classList.remove("hidden");
    authMessageDiv.classList.toggle("text-red-600", isError);
    authMessageDiv.classList.toggle("text-green-600", !isError);
}

// Login Function (called from index.html)
async function login() {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    try {
        await auth.signInWithEmailAndPassword(email, password);
        window.location.href = "app.html";
    } catch (err) {
        console.error("Login failed:", err);
        showAuthMessage("Login failed: " + err.message, true);
    }
}

// Signup Function (called from index.html)
async function signup() {
    if (!medicalReportInput) {
        console.error("medicalReportInput not initialized. DOM not ready or signup form not activated?");
        showAuthMessage("Please click 'Sign Up' tab first and ensure form is visible.", true);
        return;
    }

    const name = document.getElementById("signup-name").value;
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const phone = document.getElementById("signup-phone").value;
    const deficiencyType = document.getElementById("deficiency-dropdown").value;
    const medicalReportFile = medicalReportInput.files[0];

    if (password.length < 6) {
        showAuthMessage("Password must be at least 6 characters long.", true);
        return;
    }

    showAuthMessage("Creating account...", false);
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        let medicalReportUrl = null;
        let ocrExtractedDeficiency = null;

        if (medicalReportFile) {
            showAuthMessage("Uploading medical report...", false);
            const storageRef = storage.ref(`artifacts/${appId}/users/${user.uid}/medical_reports/${medicalReportFile.name}`);
            const snapshot = await storageRef.put(medicalReportFile);
            medicalReportUrl = await snapshot.ref.getDownloadURL();
            showAuthMessage("Medical report uploaded. Analyzing...", false);

            ocrExtractedDeficiency = await analyzeMedicalReport(medicalReportFile);
            if (ocrExtractedDeficiency && ocrExtractedDeficiency !== "unknown" && ocrExtractedDeficiency !== "error") {
                showAuthMessage(`Medical report analyzed. Detected: ${ocrExtractedDeficiency}.`, false);
            } else {
                showAuthMessage("Could not auto-detect deficiency from report. Using selected value.", false);
            }
        }

        await db.collection(`artifacts/${appId}/users`).doc(user.uid).set({
            name: name,
            email: email,
            phone: phone,
            colorDeficiencyType: deficiencyType,
            medicalReportUrl: medicalReportUrl,
            ocrExtractedDeficiency: ocrExtractedDeficiency,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showAuthMessage("Account created successfully! Please log in.", false);
        document.getElementById("login-tab").click();

    } catch (err) {
        console.error("Signup failed:", err);
        showAuthMessage("Signup failed: " + err.message, true);
    }
}

// Google Login (called from index.html)
async function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        const userDocRef = db.collection(`artifacts/${appId}/users`).doc(user.uid);
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) {
            await userDocRef.set({
                name: user.displayName,
                email: user.email,
                colorDeficiencyType: "normal",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        window.location.href = "app.html";
    } catch (err) {
        console.error("Google login failed:", err);
        showAuthMessage("Google login failed: " + err.message, true);
    }
}

// Helper to convert File object to Base64 string
async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// OCR Function for Medical Reports (using Google Cloud Vision API)
async function analyzeMedicalReport(file) {
    showAuthMessage("Analyzing medical report with OCR...", false);
    try {
        const fileType = file.type;
        let base64Content;

        if (fileType.match('image/jpeg|image/png')) {
            base64Content = await fileToBase64(file);
        } else if (fileType === 'application/pdf') {
            base64Content = await fileToBase64(file);
        } else {
            throw new Error("Unsupported file type for OCR. Please upload JPG, PNG, or PDF.");
        }

        const requestBody = {
            requests: [{
                image: { content: base64Content },
                features: [{ type: "TEXT_DETECTION" }]
            }]
        };

        const response = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Vision API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const fullText = data.responses[0]?.fullTextAnnotation?.text || "";

        console.log("OCR Full Text:", fullText);

        const lowerCaseText = fullText.toLowerCase();
        if (lowerCaseText.includes("protanopia") || lowerCaseText.includes("protanomaly")) {
            return "protanopia";
        } else if (lowerCaseText.includes("deuteranopia") || lowerCaseText.includes("deuteranomaly")) {
            return "deuteranopia";
        } else if (lowerCaseText.includes("tritanopia") || lowerCaseText.includes("tritanomaly")) {
            return "tritanopia";
        } else if (lowerCaseText.includes("achromatopsia") || lowerCaseText.includes("monochromacy")) {
            return "achromatopsia";
        } else if (lowerCaseText.includes("color blindness") || lowerCaseText.includes("color vision deficiency")) {
            return "other";
        }
        return "unknown";

    } catch (error) {
        console.error("OCR analysis failed:", error);
        showAuthMessage(`OCR failed: ${error.message}`, true);
        return "error";
    }
}


// ==========================================================
// 2. APP.HTML (Main Application Page) Specific Logic
// ==========================================================

// DOM Elements for app.html (declared here but assigned inside DOMContentLoaded for app.html)
let fileInput;
let uploadBox;
let cameraButton;
let liveVideo;
let captureButton;
let stopCameraButton;
let cameraSection;
let imagePreviewCanvas;
let processedOutputCanvas;
let imageLoadMessage;
let eyedropperButton;
let colorNameDisplay;
let colorSwatch;
let analysisResultsText;
let dominantColorResult;
let descriptionResult;
let toggleCorrectedViewButton;
let userProfileDetailsDiv;
let deficiencyDisplaySpan;
let historyDiv;
let logoutButton;

let currentStream; // To manage camera stream
let isEyedropperActive = false;
let currentImageMat = null; // To store the OpenCV Mat of the current image
let currentUserData = null; // To store the current user's profile data


// Load History from Firestore (Moved function definition here)
async function loadHistory(user) {
    if (!user || !db) {
        if (historyDiv) historyDiv.innerHTML = "<p class='text-gray-500'>Please log in to see history.</p>";
        return;
    }
    try {
        const snapshot = await db.collection(`artifacts/${appId}/users/${user.uid}/history`)
            .orderBy("timestamp", "desc")
            .limit(10)
            .get();

        if (snapshot.empty) {
            if (historyDiv) historyDiv.innerHTML = "<p class='text-gray-500'>No history found. Analyze an image!</p>";
            return;
        }

        if (historyDiv) {
            historyDiv.innerHTML = snapshot.docs.map(doc => {
                const data = doc.data();
                const date = data.timestamp ? data.timestamp.toDate().toLocaleString() : 'N/A';
                return `<div class="history-item">
                            <p><strong>Color:</strong> ${data.color}</p>
                            <p><strong>Description:</strong> ${data.description.substring(0, 50)}...</p>
                            <p><strong>Vision Mode:</strong> ${data.deficiency}</p>
                            <p class="text-xs text-gray-500">${date}</p>
                        </div>`;
            }).join("");
        }
    } catch (error) {
        console.error("Error loading history:", error);
        // This is a common error if Firestore Security Rules are not set correctly.
        // Make sure your Firebase Firestore Rules allow authenticated users to read their own history:
        // match /artifacts/{appId}/users/{userId}/history/{historyDoc} {
        //   allow read: if request.auth != null && request.auth.uid == userId;
        // }
        if (historyDiv) historyDiv.innerHTML = "<p class='text-red-500'>Error loading history. Make sure your Firestore rules allow read access for authenticated users to 'artifacts/YOUR_APP_ID/users/{userId}/history'.</p>";
    }
}

// Load User Profile from Firestore (Moved function definition here)
async function loadUserProfile(user) {
    if (!user || !db) {
        if (userProfileDetailsDiv) userProfileDetailsDiv.innerHTML = "<p>Not logged in</p>";
        return;
    }
    try {
        const userDoc = await db.collection(`artifacts/${appId}/users`).doc(user.uid).get();
        if (userDoc.exists) {
            currentUserData = userDoc.data();
            if (userProfileDetailsDiv) {
                userProfileDetailsDiv.innerHTML = `
                    <p class="text-xl font-bold">${currentUserData.name || user.email}</p>
                    <p class="text-sm text-gray-600">${currentUserData.email}</p>
                    ${currentUserData.phone ? `<p class="text-sm text-gray-600">Phone: ${currentUserData.phone}</p>` : ''}
                    ${currentUserData.medicalReportUrl ? `<p class="text-sm"><a href="${currentUserData.medicalReportUrl}" target="_blank" class="text-blue-500 hover:underline">View Medical Report</a></p>` : ''}
                `;
            }
            if (deficiencyDisplaySpan) deficiencyDisplaySpan.innerText = currentUserData.colorDeficiencyType || "N/A";
            applyUIPersonalization(currentUserData.colorDeficiencyType);
        } else {
            if (userProfileDetailsDiv) userProfileDetailsDiv.innerHTML = "<p>User profile not found. Please complete signup.</p>";
            if (deficiencyDisplaySpan) deficiencyDisplaySpan.innerText = "N/A";
        }
    } catch (error) {
        console.error("Error loading user profile:", error);
        // This is a common error if Firestore Security Rules are not set correctly.
        // Make sure your Firebase Firestore Rules allow authenticated users to read their own profile:
        // match /artifacts/{appId}/users/{userId} {
        //   allow read: if request.auth != null && request.auth.uid == userId;
        // }
        if (userProfileDetailsDiv) userProfileDetailsDiv.innerHTML = "<p class='text-red-500'>Error loading profile. Make sure your Firestore rules allow read access for authenticated users to 'artifacts/YOUR_APP_ID/users/{userId}'.</p>";
    }
}


// This ensures all HTML elements are loaded before JavaScript tries to access them.
document.addEventListener('DOMContentLoaded', () => {
    // Only proceed if on app.html
    if (window.location.pathname.includes('app.html')) {
        // Assign DOM elements for app.html
        fileInput = document.getElementById("file-input");
        uploadBox = document.getElementById("upload-box");
        cameraButton = document.getElementById("camera-button");
        liveVideo = document.getElementById("live-video");
        captureButton = document.getElementById("capture-button");
        stopCameraButton = document.getElementById("stop-camera-button");
        cameraSection = document.getElementById("camera-section");
        imagePreviewCanvas = document.getElementById("image-preview-canvas");
        processedOutputCanvas = document.getElementById("processed-output-canvas");
        imageLoadMessage = document.getElementById("image-load-message");
        eyedropperButton = document.getElementById("eyedropper-button");
        colorNameDisplay = document.getElementById("color-name-display");
        colorSwatch = document.getElementById("color-swatch");
        analysisResultsText = document.getElementById("analysis-results-text");
        dominantColorResult = document.getElementById("dominant-color-result");
        descriptionResult = document.getElementById("description-result");
        toggleCorrectedViewButton = document.getElementById("toggle-corrected-view-button");
        userProfileDetailsDiv = document.getElementById("user-profile-details");
        deficiencyDisplaySpan = document.getElementById("deficiency-display");
        historyDiv = document.getElementById("history");
        logoutButton = document.getElementById("logout-button");

        // Attach event listeners for app.html
        if (uploadBox) uploadBox.addEventListener("click", () => fileInput.click());

        if (fileInput) fileInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.match('image/jpeg|image/png')) {
                console.warn("Invalid file type uploaded. Please upload a JPEG or PNG image.");
                if (imageLoadMessage) imageLoadMessage.innerText = "Error: Please upload a JPEG or PNG image.";
                return;
            }

            if (imageLoadMessage) imageLoadMessage.innerText = "Loading image...";
            resetCanvasAndResults();

            try {
                const dataUrl = URL.createObjectURL(file);
                await loadImageToCanvas(dataUrl, 'image-preview-canvas'); // Load to original canvas

                // Critical: Check if cv and cv.imread are defined BEFORE calling it
                if (typeof cv === 'undefined' || typeof cv.imread !== 'function') {
                    if (imageLoadMessage) imageLoadMessage.innerText = "OpenCV is not fully ready. Please wait a moment or try again.";
                    console.error("OpenCV not ready when trying to read image.");
                    // You can optionally add a retry mechanism here if you want to delay and try again.
                    // For now, it will show the message and stop.
                    return;
                }

                // Ensure currentImageMat is deleted before assigning a new one
                if (currentImageMat) {
                    currentImageMat.delete(); // Delete the old Mat if it exists
                    currentImageMat = null;
                }
                currentImageMat = cv.imread(imagePreviewCanvas); // This line might throw error if OpenCV not fully ready
                console.log("Image loaded into OpenCV Mat.");

                if (imageLoadMessage) imageLoadMessage.innerText = "Image loaded. Analyzing...";

                const base64Image = await fileToBase64(file);
                await analyzeImageFull(base64Image); // Perform full analysis
                if (toggleCorrectedViewButton) toggleCorrectedViewButton.classList.remove('hidden'); // Show toggle button after first analysis

            } catch (error) {
                console.error("Image processing error:", error);
                if (imageLoadMessage) imageLoadMessage.innerText = `Error: ${error.message}`;
                if (dominantColorResult) dominantColorResult.innerHTML = `Dominant Color: <span class="font-medium text-red-600">Error</span>`;
                if (descriptionResult) descriptionResult.innerHTML = `Description: <span class="font-medium text-red-600">Error</span>`;
            } finally {
                if (fileInput) fileInput.value = ''; // Clear file input
            }
        });

        if (cameraButton) cameraButton.addEventListener("click", async () => {
            resetCanvasAndResults();
            if (imageLoadMessage) imageLoadMessage.innerText = "Starting camera...";
            if (cameraSection) cameraSection.classList.remove('hidden');
            if (imagePreviewCanvas) imagePreviewCanvas.classList.add('hidden'); // Hide canvas when camera is active
            if (processedOutputCanvas) processedOutputCanvas.classList.add('hidden');
            try {
                currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (liveVideo) liveVideo.srcObject = currentStream;
                if (liveVideo) await liveVideo.play();
                if (imageLoadMessage) imageLoadMessage.innerText = "Camera active. Capture an image.";
            } catch (err) {
                console.error("Camera access denied or failed:", err);
                if (imageLoadMessage) imageLoadMessage.innerText = "Could not access camera. Please allow permissions.";
                if (cameraSection) cameraSection.classList.add('hidden'); // Hide camera section on error
                if (imagePreviewCanvas) imagePreviewCanvas.classList.remove('hidden'); // Show canvas again
            }
        });

        if (captureButton) captureButton.addEventListener("click", async () => {
            if (!liveVideo || !liveVideo.srcObject) return;
            if (imageLoadMessage) imageLoadMessage.innerText = "Capturing image...";
            resetCanvasAndResults();

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = liveVideo.videoWidth;
            tempCanvas.height = liveVideo.videoHeight;
            const ctx = tempCanvas.getContext('2d');
            ctx.drawImage(liveVideo, 0, 0, tempCanvas.width, tempCanvas.height);

            stopCamera(); // Stop camera after capture

            try {
                const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.9);
                await loadImageToCanvas(dataUrl, 'image-preview-canvas'); // Load to original canvas

                // Critical: Check if cv and cv.imread are defined BEFORE calling it
                if (typeof cv === 'undefined' || typeof cv.imread !== 'function') {
                    if (imageLoadMessage) imageLoadMessage.innerText = "OpenCV is not fully ready. Please wait a moment or try again.";
                    console.error("OpenCV not ready when trying to read image.");
                    return;
                }

                // Ensure currentImageMat is deleted before assigning a new one
                if (currentImageMat) {
                    currentImageMat.delete(); // Delete the old Mat if it exists
                    currentImageMat = null;
                }
                currentImageMat = cv.imread(imagePreviewCanvas); // This line might throw error if OpenCV not fully ready
                console.log("Captured image loaded into OpenCV Mat.");

                if (imageLoadMessage) imageLoadMessage.innerText = "Image captured. Analyzing...";

                const base64Image = dataUrl.split(',')[1];
                await analyzeImageFull(base64Image); // Perform full analysis
                if (toggleCorrectedViewButton) toggleCorrectedViewButton.classList.remove('hidden'); // Show toggle button after first analysis

            } catch (error) {
                console.error("Image capture/analysis error:", error);
                if (imageLoadMessage) imageLoadMessage.innerText = `Error: ${error.message}`;
                if (dominantColorResult) dominantColorResult.innerHTML = `Dominant Color: <span class="font-medium text-red-600">Error</span>`;
                if (descriptionResult) descriptionResult.innerHTML = `Description: <span class="font-medium text-red-600">Error</span>`;
            } finally {
                if (fileInput) fileInput.value = ''; // Clear file input
            }
        });

        if (stopCameraButton) stopCameraButton.addEventListener("click", stopCamera);

        if (logoutButton) logoutButton.addEventListener("click", async () => {
            try {
                await auth.signOut();
                window.location.href = "index.html";
            } catch (err) {
                console.error("Logout failed:", err);
            }
        });

        // ==========================================================
        // UPDATED EYEDROPPER LOGIC START
        // ==========================================================
        if (eyedropperButton) eyedropperButton.addEventListener("click", () => {
            if (!imagePreviewCanvas) {
                console.warn("Eyedropper: imagePreviewCanvas not found.");
                return;
            }
            // Ensure OpenCV is ready before activating eyedropper that relies on Mat
            if (!opencvIsReady || !currentImageMat) {
                 if (imageLoadMessage) imageLoadMessage.innerText = "Please wait for OpenCV to load or load an image first.";
                 console.warn("Eyedropper: OpenCV not ready or no image loaded.");
                 return;
            }

            // If the processed canvas is visible, switch back to original for eyedropper
            // The eyedropper works on 'imagePreviewCanvas', so make sure it's visible
            if (processedOutputCanvas && !processedOutputCanvas.classList.contains('hidden')) {
                processedOutputCanvas.classList.add('hidden');
                imagePreviewCanvas.classList.remove('hidden');
                if (imageLoadMessage) imageLoadMessage.innerText = "Switched to original view for eyedropper.";
            }

            isEyedropperActive = !isEyedropperActive;
            imagePreviewCanvas.classList.toggle('eyedropper-active', isEyedropperActive);
            if (colorNameDisplay) colorNameDisplay.innerText = isEyedropperActive ? "Click on image" : "Hover/Click for color";
            if (!isEyedropperActive) {
                if (colorSwatch) colorSwatch.style.backgroundColor = 'transparent';
                if (colorNameDisplay) colorNameDisplay.innerText = "Hover/Click for color";
            }
        });

        if (imagePreviewCanvas) imagePreviewCanvas.addEventListener('mousemove', (e) => {
            if (!isEyedropperActive || !currentImageMat || !opencvIsReady) return;
            // Prevent execution if the canvas is hidden (e.g., processed view is active)
            if (imagePreviewCanvas.classList.contains('hidden')) {
                // This warning should now ideally not appear if the button logic correctly switches views
                console.warn("Eyedropper: imagePreviewCanvas is hidden. Cannot get pixel data.");
                return;
            }

            const rect = imagePreviewCanvas.getBoundingClientRect();
            const scaleX = imagePreviewCanvas.width / rect.width;
            const scaleY = imagePreviewCanvas.height / rect.height;

            const x = Math.floor((e.clientX - rect.left) * scaleX);
            const y = Math.floor((e.clientY - rect.top) * scaleY);

            if (x < 0 || x >= imagePreviewCanvas.width || y < 0 || y >= imagePreviewCanvas.height) return;

            let pixel = currentImageMat.ucharPtr(y, x);
            let r = pixel[0];
            let g = pixel[1];
            let b = pixel[2];

            const originalColorName = getColorName(r, g, b);
            if (colorSwatch) colorSwatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

            if (currentUserData && currentUserData.colorDeficiencyType && currentUserData.colorDeficiencyType !== 'normal') {
                const simulatedRgb = simulateColorPerception(r, g, b, currentUserData.colorDeficiencyType);
                const simulatedColorName = getColorName(simulatedRgb.r, simulatedRgb.g, simulatedRgb.b);
                if (colorNameDisplay) colorNameDisplay.innerText = `Original: ${originalColorName} | Perceived: ${simulatedColorName}`;
            } else {
                if (colorNameDisplay) colorNameDisplay.innerText = `Color: ${originalColorName} (RGB: ${r},${g},${b})`;
            }
        });

        if (imagePreviewCanvas) imagePreviewCanvas.addEventListener('click', (e) => {
            if (!isEyedropperActive || !currentImageMat || !opencvIsReady) return;
            // Prevent execution if the canvas is hidden
            if (imagePreviewCanvas.classList.contains('hidden')) {
                console.warn("Eyedropper: imagePreviewCanvas is hidden. Cannot get pixel data on click.");
                return;
            }

            const rect = imagePreviewCanvas.getBoundingClientRect();
            const scaleX = imagePreviewCanvas.width / rect.width;
            const scaleY = imagePreviewCanvas.height / rect.height;

            const x = Math.floor((e.clientX - rect.left) * scaleX);
            const y = Math.floor((e.clientY - rect.top) * scaleY);

            if (x < 0 || x >= imagePreviewCanvas.width || y < 0 || y >= imagePreviewCanvas.height) return;

            let pixel = currentImageMat.ucharPtr(y, x);
            let r = pixel[0];
            let g = pixel[1];
            let b = pixel[2];

            const originalColorName = getColorName(r, g, b);
            if (colorSwatch) colorSwatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

            let speechText = `Original color is ${originalColorName}.`;

            if (currentUserData && currentUserData.colorDeficiencyType && currentUserData.colorDeficiencyType !== 'normal') {
                const simulatedRgb = simulateColorPerception(r, g, b, currentUserData.colorDeficiencyType);
                const simulatedColorName = getColorName(simulatedRgb.r, simulatedRgb.g, simulatedRgb.b);
                if (colorNameDisplay) colorNameDisplay.innerText = `Original: ${originalColorName} | Perceived: ${simulatedColorName}`;
                speechText += ` You might perceive it as ${simulatedColorName}.`;
            } else {
                if (colorNameDisplay) colorNameDisplay.innerText = `Color: ${originalColorName} (RGB: ${r},${g},${b})`;
            }
            speak(speechText);
        });
        // ==========================================================
        // UPDATED EYEDROPPER LOGIC END
        // ==========================================================

        if (toggleCorrectedViewButton) toggleCorrectedViewButton.addEventListener("click", async () => {
            if (!currentImageMat) {
                console.warn("Toggle Corrected View: No image loaded.");
                if (imageLoadMessage) imageLoadMessage.innerText = "Please load an image first.";
                return;
            }

            // Await OpenCV to be ready here
            // This is crucial for operations requiring OpenCV Mat manipulations.
            try {
                await waitForOpenCV();
            } catch (error) {
                console.error("OpenCV not ready for color correction:", error);
                if (imageLoadMessage) imageLoadMessage.innerText = "Error: OpenCV not ready for color correction.";
                return;
            }

            if (processedOutputCanvas && imagePreviewCanvas) {
                if (processedOutputCanvas.classList.contains('hidden')) {
                    if (imageLoadMessage) imageLoadMessage.innerText = "Applying color correction...";
                    // Create a clone to ensure the original is preserved and for safe manipulation
                    // This helps prevent "Mat instance already deleted" errors if currentImageMat is shared.
                    const srcMatForCorrection = currentImageMat.clone();
                    let processedMat = null;

                    try {processedMat = applyColorCorrection(srcMatForCorrection, currentUserData.colorDeficiencyType);
                        cv.imshow(processedOutputCanvas, processedMat);
                    } catch (error) {
                        console.error("Error during color correction:", error);
                        if (imageLoadMessage) imageLoadMessage.innerText = `Error applying correction: ${error.message}`;
                    } finally {
                        if (processedMat) processedMat.delete(); // Delete processedMat after imshow
                        if (srcMatForCorrection) srcMatForCorrection.delete(); // Delete clone after use
                    }

                    imagePreviewCanvas.classList.add('hidden');
                    processedOutputCanvas.classList.remove('hidden');
                    if (imageLoadMessage) imageLoadMessage.innerText = "Showing corrected view.";
                } else {
                    imagePreviewCanvas.classList.remove('hidden');
                    processedOutputCanvas.classList.add('hidden');
                    if (imageLoadMessage) imageLoadMessage.innerText = "Showing original view.";
                }
            }
        });
    }
});


// ==========================================================
// COMMON / HELPER FUNCTIONS
// ==========================================================

// Resets canvases and result displays
function resetCanvasAndResults() {
    if (imagePreviewCanvas && processedOutputCanvas) {
        const ctxOriginal = imagePreviewCanvas.getContext('2d');
        ctxOriginal.clearRect(0, 0, imagePreviewCanvas.width, imagePreviewCanvas.height);
        imagePreviewCanvas.width = 0;
        imagePreviewCanvas.height = 0;

        const ctxProcessed = processedOutputCanvas.getContext('2d');
        ctxProcessed.clearRect(0, 0, processedOutputCanvas.width, processedOutputCanvas.height);
        processedOutputCanvas.width = 0;
        processedOutputCanvas.height = 0;
        processedOutputCanvas.classList.add('hidden');
    }

    if (dominantColorResult) dominantColorResult.innerHTML = `Dominant Color: <span class="font-medium text-gray-600">N/A</span>`;
    if (descriptionResult) descriptionResult.innerHTML = `Description: <span class="font-medium text-gray-600">N/A</span>`;
    if (colorSwatch) colorSwatch.style.backgroundColor = 'transparent';
    if (colorNameDisplay) colorNameDisplay.innerText = "Hover/Click for color";
    if (toggleCorrectedViewButton) toggleCorrectedViewButton.classList.add('hidden');
    // ONLY delete currentImageMat here if it's explicitly done with and a new image is being loaded,
    // or if the app is truly resetting its image state completely.
    // In this specific reset, it's already handled before a new currentImageMat assignment.
}

// Loads an image URL onto a specified canvas
async function loadImageToCanvas(dataUrl, canvasId) {
    return new Promise((resolve, reject) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            reject(new Error(`Canvas with ID ${canvasId} not found.`));
            return;
        }
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            const maxWidth = 800;
            const maxHeight = 600;
            let newWidth = img.naturalWidth;
            let newHeight = img.naturalHeight;

            // Maintain aspect ratio
            if (newWidth > maxWidth) {
                newHeight = newHeight * (maxWidth / newWidth);
                newWidth = maxWidth;
            }
            if (newHeight > maxHeight) {
                newWidth = newWidth * (maxHeight / newHeight);
                newHeight = maxHeight;
            }

            canvas.width = newWidth;
            canvas.height = newHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            resolve();
        };
        img.onerror = (error) => {
            console.error("Image loading error:", error);
            reject(new Error("Failed to load image."));
        };
        img.src = dataUrl;
    });
}

// Stops the camera stream
function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        if (liveVideo) liveVideo.srcObject = null;
    }
    if (cameraSection) cameraSection.classList.add('hidden');
    if (imagePreviewCanvas) imagePreviewCanvas.classList.remove('hidden');
    if (imageLoadMessage) imageLoadMessage.innerText = "Camera stopped. Upload or capture an image to begin.";
}

// Converts a PNG file to a JPEG base64 string with a white background
async function convertPngToJpeg(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.drawImage(img, 0, 0);

                const jpegBase64 = canvas.toDataURL('image/jpeg', 0.9);
                resolve(jpegBase64.split(",")[1]);
            };
            img.onerror = reject;
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Google Vision API Function (now for both dominant color AND description)
async function analyzeImageFull(base64Image) {
    try {
        const requestBody = {
            requests: [{
                image: { content: base64Image },
                features: [
                    { type: "IMAGE_PROPERTIES" },
                    { type: "LABEL_DETECTION" },
                    { type: "OBJECT_LOCALIZATION" }
                ]
            }]
        };

        const response = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            // Crucial: This is the error that's preventing color and description.
            // Check your API key, its restrictions in Google Cloud Console,
            // and your network connection (firewall/proxy).
            throw new Error(`Vision API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log("Full Vision API Response:", JSON.stringify(data, null, 2));

        const responseData = data.responses[0];

        let dominantColorName = "N/A";
        const colors = responseData.imagePropertiesAnnotation?.dominantColors?.colors;
        if (colors && colors.length > 0) {
            const bestColor = findBestColor(colors);
            const rgbValues = {
                r: Math.max(0, Math.min(255, (bestColor.red > 1 && bestColor.red <= 255) ? Math.round(bestColor.red) : Math.round(bestColor.red * 255) || 0)),
                g: Math.max(0, Math.min(255, (bestColor.green > 1 && bestColor.green <= 255) ? Math.round(bestColor.green) : Math.round(bestColor.green * 255) || 0)),
                b: Math.max(0, Math.min(255, (bestColor.blue > 1 && bestColor.blue <= 255) ? Math.round(bestColor.blue) : Math.round(bestColor.blue * 255) || 0))
            };
            dominantColorName = getColorName(rgbValues.r, rgbValues.g, rgbValues.b);
        }
        if (dominantColorResult) dominantColorResult.innerHTML = `Dominant Color: <span class="font-medium text-gray-800">${dominantColorName}</span>`;

        let description = "No specific description available.";
        const labels = responseData.labelAnnotations?.map(label => label.description) || [];
        const objects = responseData.localizedObjectAnnotations?.map(obj => obj.name) || [];

        let combinedDescription = [];
        if (labels.length > 0) {
            combinedDescription.push(`Labels: ${labels.join(", ")}.`);
        }
        if (objects.length > 0) {
            combinedDescription.push(`Objects: ${objects.join(", ")}.`);
        }

        if (combinedDescription.length > 0) {
            description = combinedDescription.join(" ");
        }
        if (descriptionResult) descriptionResult.innerHTML = `Description: <span class="font-medium text-gray-800">${description}</span>`;

        const user = auth.currentUser;
        if (user) {
            await saveToHistory(user, dominantColorName, description, currentUserData ? currentUserData.colorDeficiencyType : 'N/A');
        }

    } catch (error) {
        console.error("Image analysis failed in analyzeImageFull:", error);
        if (dominantColorResult) dominantColorResult.innerHTML = `Dominant Color: <span class="font-medium text-red-600">Error</span>`;
        if (descriptionResult) descriptionResult.innerHTML = `Description: <span class="font-medium text-red-600">Error: ${error.message}</span>`;
    }
}

// Refined `findBestColor` to prioritize chromatic colors more aggressively
function findBestColor(colors) {
    const isAchromatic = (r, g, b, tolerance = 20) => {
        const diffRG = Math.abs(r - g);
        const diffRB = Math.abs(r - b);
        const diffGB = Math.abs(g - b);
        return diffRG < tolerance && diffRB < tolerance && diffGB < tolerance;
    };

    const isPureWhiteOrBlack = (r, g, b, threshold = 20) => {
        if (r > 255 - threshold && g > 255 - threshold && b > 255 - threshold) return true;
        if (r < threshold && g < threshold && b < threshold) return true;
        return false;
    };

    let bestChromaticColor = null;
    let highestChromaticPixelFraction = 0;

    for (const apiColor of colors) {
        const r = typeof apiColor.color.red === 'number' ? ((apiColor.color.red > 1 && apiColor.color.red <= 255) ? apiColor.color.red : apiColor.color.red * 255) : 0;
        const g = typeof apiColor.color.green === 'number' ? ((apiColor.color.green > 1 && apiColor.color.green <= 255) ? apiColor.color.green : apiColor.color.green * 255) : 0;
        const b = typeof apiColor.color.blue === 'number' ? ((apiColor.color.blue > 1 && apiColor.color.blue <= 255) ? apiColor.color.blue : apiColor.color.blue * 255) : 0;

        const currentRgb = {
            r: Math.round(r),
            g: Math.round(g),
            b: Math.round(b)
        };
        const pixelFraction = apiColor.pixelFraction || 0;

        if (!isAchromatic(currentRgb.r, currentRgb.g, currentRgb.b) &&
            !isPureWhiteOrBlack(currentRgb.r, currentRgb.g, currentRgb.b) &&
            pixelFraction > 0.02
        ) {
            if (pixelFraction > highestChromaticPixelFraction) {
                bestChromaticColor = apiColor.color;
                highestChromaticPixelFraction = pixelFraction;
            }
        }
    }

    if (bestChromaticColor) {
        return bestChromaticColor;
    }

    // Fallback: If no good chromatic color, return the most dominant color from API
    return colors[0].color;
}

// Maps RGB to a human-readable color name
function getColorName(r, g, b) {
    const colorNames = [
        { name: "Red", r: 255, g: 0, b: 0 },
        { name: "Green", r: 0, g: 128, b: 0 },
        { name: "Blue", r: 0, g: 0, b: 255 },
        { name: "Yellow", r: 255, g: 255, b: 0 },
        { name: "Cyan", r: 0, g: 255, b: 255 },
        { name: "Magenta", r: 255, g: 0, b: 255 },
        { name: "White", r: 255, g: 255, b: 255 },
        { name: "Black", r: 0, g: 0, b: 0 },
        { name: "Gray", r: 128, g: 128, b: 128 },
        { name: "Orange", r: 255, g: 165, b: 0 },
        { name: "Purple", r: 128, g: 0, b: 128 },
        { name: "Brown", r: 165, g: 42, b: 42 },
        { name: "Pink", r: 255, g: 192, b: 203 },
        { name: "Lime Green", r: 50, g: 205, b: 50 },
        { name: "Teal", r: 0, g: 128, b: 128 },
        { name: "Navy Blue", r: 0, g: 0, b: 128 },
        { name: "Maroon", r: 128, g: 0, b: 0 },
        { name: "Olive Green", r: 128, g: 128, b: 0 },
        { name: "Aqua", r: 0, g: 255, b: 255 },
        { name: "Silver", r: 192, g: 192, b: 192 },
        { name: "Gold", r: 255, g: 215, b: 0 },
        { name: "Indigo", r: 75, g: 0, b: 130 },
        { name: "Violet", r: 238, g: 130, b: 238 },
        { name: "Turquoise", r: 64, g: 224, b: 208 },
        { name: "Beige", r: 245, g: 245, b: 220 },
        { name: "Salmon", r: 250, g: 128, b: 114 },
        { name: "Khaki", r: 240, g: 230, b: 140 },
        { name: "Crimson", r: 220, g: 20, b: 60 },
        { name: "Dark Green", r: 0, g: 100, b: 0 },
        { name: "Dark Blue", r: 0, g: 0, b: 139 },
        { name: "Light Blue", r: 173, g: 216, b: 230 },
        { name: "Light Green", r: 144, g: 238, b: 144 },
        { name: "Light Gray", r: 211, g: 211, b: 211 },
        { name: "Dark Gray", r: 169, g: 169, b: 169 },
        { name: "Charcoal", r: 54, g: 69, b: 79 },
        { name: "Steel Blue", r: 70, g: 130, b: 180 },
        { name: "Sky Blue", r: 135, g: 206, b: 235 },
        { name: "Royal Blue", r: 65, g: 105, b: 225 },
        { name: "Forest Green", r: 34, g: 139, b: 34 },
        { name: "Spring Green", r: 0, g: 255, b: 127 },
        { name: "Medium Sea Green", r: 60, g: 179, b: 113 },
        { name: "Dodger Blue", r: 30, g: 144, b: 255 },
        { name: "Deep Sky Blue", r: 0, g: 191, b: 255 },
        { name: "Chocolate", r: 210, g: 105, b: 30 },
        { name: "Saddle Brown", r: 139, g: 69, b: 19 },
        { name: "Firebrick", r: 178, g: 34, b: 34 },
        { name: "Indian Red", r: 205, g: 92, b: 92 },
        { name: "Hot Pink", r: 255, g: 105, b: 180 },
        { name: "Deep Pink", r: 255, g: 20, b: 147 },
        { name: "Medium Violet Red", r: 199, g: 21, b: 133 },
        { name: "Dark Orchid", r: 153, g: 50, b: 204 },
        { name: "Dark Violet", r: 148, g: 0, b: 211 },
        { name: "Medium Purple", r: 147, g: 112, b: 219 },
        { name: "Plum", r: 221, g: 160, b: 221 },
        { name: "Lavender", r: 230, g: 230, b: 250 },
        { name: "Thistle", r: 216, g: 191, b: 216 }
    ];

    let minDistance = Infinity;
    let closestColorName = "Unknown Color";

    for (const color of colorNames) {
        const distance = Math.sqrt(
            Math.pow(r - color.r, 2) +
            Math.pow(g - color.g, 2) +
            Math.pow(b - color.b, 2)
        );

        if (distance < minDistance) {
            minDistance = distance;
            closestColorName = color.name;
        }
    }
    return closestColorName;
}

// Voice Output
// ... (rest of your script.js code)

// Voice Output
function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    } else {
        console.warn("Web Speech API not supported in this browser.");
    }
}

// Speak the analysis results
function speakAnalysisResults() {
    // Safely get the values of dominantColorResult and descriptionResult
    // by checking if the elements exist and then getting their innerText or querySelector's innerText.
    const dominant = dominantColorResult ? dominantColorResult.querySelector('span')?.innerText : 'N/A';
    const description = descriptionResult ? descriptionResult.querySelector('span')?.innerText : 'N/A';

    let textToSpeak = `The dominant color is ${dominant}. ${description}`;
    speak(textToSpeak);
}

// ... (rest of your script.js code)

// Save to Firestore History
async function saveToHistory(user, color, description, deficiency) {
    if (!user || !db) {
        console.warn("No user or Firestore not initialized, cannot save to history.");
        return;
    }
    try {
        await db.collection(`artifacts/${appId}/users/${user.uid}/history`).add({
            userId: user.uid,
            color,
            description,
            deficiency,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("History saved!");
        loadHistory(user);
    } catch (error) {
        console.error("Error saving to history:", error);
    }
}


// Apply UI personalization based on deficiency (simple CSS class toggle)
function applyUIPersonalization(deficiencyType) {
    const body = document.body;
    body.classList.remove('theme-protanopia', 'theme-deuteranopia', 'theme-tritanopia', 'theme-achromatopsia');
    if (deficiencyType && deficiencyType !== 'normal') {
        body.classList.add(`theme-${deficiencyType}`);
    }
}

// ==========================================================
// OpenCV.js Specific Functions (CORE IMAGE PROCESSING)
// ==========================================================

// Function to simulate color perception (simplified for common types)
function simulateColorPerception(r, g, b, deficiencyType) {
    let R = r / 255.0;
    let G = g / 255.0;
    let B = b / 255.0;

    let simulatedR = R;
    let simulatedG = G;
    let simulatedB = B;

    switch (deficiencyType) {
        case 'protanopia':
            simulatedR = (0.567 * R) + (0.433 * G) + (0.000 * B);
            simulatedG = (0.558 * R) + (0.442 * G) + (0.000 * B);
            simulatedB = (0.000 * R) + (0.242 * G) + (0.758 * B);
            break;
        case 'deuteranopia':
            simulatedR = (0.625 * R) + (0.375 * G) + (0.000 * B);
            simulatedG = (0.700 * R) + (0.300 * G) + (0.000 * B);
            simulatedB = (0.000 * R) + (0.000 * G) + (1.000 * B);
            break;
        case 'tritanopia':
            simulatedR = (0.950 * R) + (0.050 * G) + (0.000 * B);
            simulatedG = (0.000 * R) + (0.433 * G) + (0.567 * B);
            simulatedB = (0.000 * R) + (0.475 * G) + (0.525 * B);
            break;
        case 'achromatopsia':
            let avg = (R + G + B) / 3;
            simulatedR = avg;
            simulatedG = avg;
            simulatedB = avg;
            break;
        default:
            break;
    }

    return {
        r: Math.round(Math.max(0, Math.min(255, simulatedR * 255))),
        g: Math.round(Math.max(0, Math.min(255, simulatedG * 255))),
        b: Math.round(Math.max(0, Math.min(255, simulatedB * 255)))
    };
}

// Applies a full image color correction/simulation using OpenCV.js
function applyColorCorrection(srcMat, deficiencyType) {
    if (!opencvIsReady) {
        console.error("OpenCV.js not ready for color correction!");
        return srcMat.clone(); // Return a clone of original if not ready, to avoid breaking flow
    }

    let destMat = new cv.Mat();
    let R_channel = new cv.Mat();
    let G_channel = new cv.Mat();
    let B_channel = new cv.Mat();
    let channels = new cv.MatVector();

    // Ensure srcMat is not deleted inside this function if it's managed externally
    // Convert to float for accurate calculations
    srcMat.convertTo(srcMat, cv.CV_32FC3, 1.0 / 255.0);

    cv.split(srcMat, channels);
    R_channel = channels.get(0);
    G_channel = channels.get(1);
    B_channel = channels.get(2);

    switch (deficiencyType) {
        case 'protanopia':
            cv.addWeighted(R_channel, 0.567, G_channel, 0.433, 0, R_channel);
            cv.addWeighted(R_channel, 0.558, G_channel, 0.442, 0, G_channel);
            break;
        case 'deuteranopia':
            cv.addWeighted(R_channel, 0.625, G_channel, 0.375, 0, R_channel);
            cv.addWeighted(R_channel, 0.700, G_channel, 0.300, 0, G_channel);
            break;
        case 'tritanopia':
            cv.addWeighted(R_channel, 0.950, G_channel, 0.050, 0, R_channel);
            cv.addWeighted(G_channel, 0.433, B_channel, 0.567, 0, G_channel);
            cv.addWeighted(G_channel, 0.475, B_channel, 0.525, 0, B_channel);
            break;
        case 'achromatopsia':
            // Achromatopsia is a grayscale conversion.
            // Ensure destMat is initialized correctly for this path.
            cv.cvtColor(srcMat, destMat, cv.COLOR_RGB2GRAY);
            cv.cvtColor(destMat, destMat, cv.COLOR_GRAY2RGB);
            break;
        default:
            srcMat.copyTo(destMat); // If no specific deficiency, just copy
            break;
    }

    if (deficiencyType !== 'achromatopsia') { // Only merge if not converted to grayscale
        channels.set(0, R_channel);
        channels.set(1, G_channel);
        channels.set(2, B_channel);
        cv.merge(channels, destMat);
    }

    // Convert back to 8-bit unsigned integers for display
    destMat.convertTo(destMat, cv.CV_8UC3, 255.0);

    // Clean up temporary Mats created in this function
    R_channel.delete(); G_channel.delete(); B_channel.delete(); channels.delete();
    // srcMat.delete(); // DO NOT delete srcMat here as it's passed in from outside and managed there

    return destMat;
}

// Export functions to global scope for HTML to call
window.login = login;
window.signup = signup;
window.googleLogin = googleLogin;
window.speakAnalysisResults = speakAnalysisResults;
window.activateSignupFormInteractions = activateSignupFormInteractions;