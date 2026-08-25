document.addEventListener('DOMContentLoaded', () => {

    // ===============================================================
    // BACKEND
    // ===============================================================

    const IS_LOCAL =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

    const API_BASE_URL = IS_LOCAL
        ? 'http://localhost:3000'
        : '';

    // Local:
    // http://localhost:3000/medicines
    //
    // Vercel:
    // /api/medicines

    const MEDICINES_API = IS_LOCAL
        ? `${API_BASE_URL}/medicines`
        : '/api/medicines';

    // Local:
    // http://localhost:3000/medicines/upload
    //
    // Vercel:
    // /api/upload

    const UPLOAD_API = IS_LOCAL
        ? `${API_BASE_URL}/medicines/upload`
        : '/api/upload';


    // ===============================================================
    // GEMINI API KEY - DEVELOPER ONLY
    // ===============================================================
    //
    // Keep this empty for now.
    // Gemini AI will show a proper configuration message until
    // the developer configures the key.
    //
    // IMPORTANT:
    // Do NOT put a production Gemini API key in frontend code.
    // A frontend key is visible to users.

    const GEMINI_API_KEY = '';


    // ===============================================================
    // BOX VALIDATION
    // ===============================================================

    const boxRegex = /^[A-Za-z][0-9]+$/;


    // ===============================================================
    // INVENTORY
    // ===============================================================

    async function fetchAllInventory() {

        const response = await fetch(
            MEDICINES_API
        );

        if (!response.ok) {

            throw new Error(
                'Could not load inventory from database.'
            );

        }

        return await response.json();

    }


    async function findByBrand(query) {

        const response = await fetch(
            MEDICINES_API
        );

        if (!response.ok) {

            throw new Error(
                'Search failed.'
            );

        }

        const medicines =
            await response.json();

        const search =
            query.toLowerCase();

        return medicines.filter(item =>
            item.brand_name &&
            item.brand_name
                .toLowerCase()
                .includes(search)
        );

    }


    async function findByComposition(query) {

        const response = await fetch(
            MEDICINES_API
        );

        if (!response.ok) {

            throw new Error(
                'Search failed.'
            );

        }

        const medicines =
            await response.json();

        const search =
            query.toLowerCase();

        return medicines.filter(item =>
            item.composition &&
            item.composition
                .toLowerCase()
                .includes(search)
        );

    }


    async function findExactBrand(brandName) {

        const response = await fetch(
            MEDICINES_API
        );

        if (!response.ok) {

            throw new Error(
                'Duplicate check failed.'
            );

        }

        const medicines =
            await response.json();

        return medicines.filter(item =>
            item.brand_name &&
            item.brand_name.toLowerCase() ===
            brandName.toLowerCase()
        );

    }


    async function insertMedicine(record) {

        const response =
            await fetch(
                MEDICINES_API,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify(record)
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            if (response.status === 409) {

                throw new Error(
                    'Medicine already exists'
                );

            }

            throw new Error(
                data.message ||
                'Insert failed.'
            );

        }

        return data;

    }


    // ===============================================================
    // GEMINI API
    // ===============================================================

    async function callGemini(promptText) {

        const apiKey =
            GEMINI_API_KEY.trim();


        if (!apiKey) {

            throw new Error(
                'Gemini AI is not configured. Please ask the developer to configure the Gemini API key.'
            );

        }


        const response =
            await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify({

                            contents: [
                                {
                                    parts: [
                                        {
                                            text:
                                                promptText
                                        }
                                    ]
                                }
                            ]

                        })
                }
            );


        if (!response.ok) {

            throw new Error(
                'Failed to connect to Gemini API. Check your API key.'
            );

        }


        const data =
            await response.json();


        if (
            !data.candidates ||
            !data.candidates[0] ||
            !data.candidates[0].content ||
            !data.candidates[0].content.parts
        ) {

            throw new Error(
                'Gemini returned an unexpected response.'
            );

        }


        return data
            .candidates[0]
            .content
            .parts
            .map(part => part.text || '')
            .join('')
            .trim();

    }


    // ===============================================================
    // AI FILL
    // ===============================================================

    const aiFillBtn =
        document.getElementById(
            'aiFillBtn'
        );


    if (aiFillBtn) {

        aiFillBtn.addEventListener(
            'click',
            async () => {

                const brandName =
                    document
                        .getElementById(
                            'brandName'
                        )
                        .value
                        .trim();


                if (!brandName) {

                    alert(
                        'Please enter a Brand Name first.'
                    );

                    return;

                }


                const btn =
                    document.getElementById(
                        'aiFillBtn'
                    );


                const originalText =
                    btn.textContent;


                btn.textContent =
                    'Thinking...';

                btn.disabled =
                    true;


                try {

                    const prompt =
                        `Give only the active salt and strength composition for the medical tablet brand "${brandName}". Keep it concise (e.g., "Paracetamol 500mg"). Do not include extra text.`;


                    const composition =
                        await callGemini(
                            prompt
                        );


                    document.getElementById(
                        'composition'
                    ).value =
                        composition;


                } catch (error) {

                    alert(
                        error.message
                    );

                } finally {

                    btn.textContent =
                        originalText;

                    btn.disabled =
                        false;

                }

            }
        );

    }


    // ===============================================================
    // SEARCH
    // ===============================================================

    const searchInput =
        document.getElementById(
            'searchInput'
        );


    const searchResults =
        document.getElementById(
            'searchResults'
        );


    let searchTimeout;


    if (searchInput) {

        searchInput.addEventListener(
            'input',
            () => {

                clearTimeout(
                    searchTimeout
                );


                searchTimeout =
                    setTimeout(
                        performSearch,
                        400
                    );

            }
        );

    }


    async function performSearch() {

        const query =
            searchInput.value
                .trim()
                .toLowerCase();


        if (query === '') {

            searchResults.innerHTML = `
                <p class="text-sm text-slate-400 italic">
                    Start typing to search inventory...
                </p>
            `;

            return;

        }


        searchResults.innerHTML = `
            <div class="p-4 bg-slate-50 text-slate-500 rounded-xl text-sm">
                Searching...
            </div>
        `;


        let brandMatches = [];


        // ===========================================================
        // SEARCH BRAND
        // ===========================================================

        try {

            brandMatches =
                await findByBrand(
                    query
                );

        } catch (error) {

            searchResults.innerHTML = `
                <div class="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium">
                    ${escapeHtml(error.message)}
                </div>
            `;

            return;

        }


        if (brandMatches.length > 0) {

            renderResults(
                brandMatches,
                '✓ Brand Match Found',
                'bg-blue-50',
                'text-emerald-600',
                'bg-blue-600'
            );

            return;

        }


        // ===========================================================
        // SEARCH COMPOSITION
        // ===========================================================

        let compMatches = [];


        try {

            compMatches =
                await findByComposition(
                    query
                );

        } catch (error) {

            searchResults.innerHTML = `
                <div class="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium">
                    ${escapeHtml(error.message)}
                </div>
            `;

            return;

        }


        if (compMatches.length > 0) {

            renderResults(
                compMatches,
                '⚠️ Composition Match Found',
                'bg-amber-50/50',
                'text-amber-700',
                'bg-amber-600'
            );

            return;

        }


        // ===========================================================
        // GEMINI FALLBACK
        // ===========================================================

        searchResults.innerHTML = `
            <div class="p-4 bg-purple-50 text-purple-800 rounded-xl text-sm">
                🤖 Searching composition via Gemini AI...
            </div>
        `;


        try {

            const prompt =
                `For the medicine brand or query "${query}", what is its generic active salt composition? Return ONLY the composition string (e.g., "Paracetamol 500mg"). If it's not a medicine, return "UNKNOWN".`;


            const detectedComposition =
                await callGemini(
                    prompt
                );


            if (
                detectedComposition
                    .toUpperCase() ===
                    'UNKNOWN' ||
                !detectedComposition
            ) {

                searchResults.innerHTML = `
                    <div class="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium">
                        No records found for "${escapeHtml(query)}".
                    </div>
                `;

                return;

            }


            const aiMatches =
                await findByComposition(
                    detectedComposition
                );


            if (aiMatches.length > 0) {

                searchResults.innerHTML = `

                    <div class="p-3 bg-purple-50 border border-purple-200 rounded-xl mb-2">

                        <p class="text-xs font-semibold text-purple-900">

                            ✨ AI Identified Salt:

                            <span class="underline">
                                ${escapeHtml(
                                    detectedComposition
                                )}
                            </span>

                        </p>

                        <p class="text-xs text-purple-700 mt-0.5">
                            Found alternative brands in stock with this composition:
                        </p>

                    </div>


                    ${aiMatches.map(item => `

                        <div class="p-4 bg-purple-50/30 border border-purple-100 rounded-xl flex justify-between items-center gap-3 shadow-xs">

                            <div class="overflow-hidden">

                                <h3 class="font-bold text-slate-900 text-base truncate">
                                    ${escapeHtml(
                                        item.brand_name
                                    )}
                                </h3>

                                <p class="text-xs text-purple-700 mt-0.5">
                                    Salt:
                                    ${escapeHtml(
                                        item.composition ||
                                        'Not available'
                                    )}
                                </p>

                            </div>


                            <div class="bg-purple-600 text-white px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap shadow-sm">

                                📍
                                ${escapeHtml(
                                    item.box_location
                                )}

                            </div>

                        </div>

                    `).join('')}

                `;

            } else {

                searchResults.innerHTML = `
                    <div class="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium">

                        AI identified salt as
                        "${escapeHtml(detectedComposition)}",
                        but no matching boxes are in stock.

                    </div>
                `;

            }


        } catch (error) {

            searchResults.innerHTML = `
                <div class="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium">

                    Exact brand not found locally.

                    <br>

                    AI Error:
                    ${escapeHtml(error.message)}

                </div>
            `;

        }

    }


    // ===============================================================
    // RENDER SEARCH RESULTS
    // ===============================================================

    function renderResults(
        items,
        headerText,
        cardBg,
        headerColor,
        badgeColor
    ) {

        searchResults.innerHTML = `

            <p class="text-xs font-semibold ${headerColor} mb-2 uppercase tracking-wide">
                ${headerText}
            </p>


            ${items.map(item => `

                <div class="p-4 ${cardBg} border border-slate-200 rounded-xl flex justify-between items-center gap-3 shadow-xs">

                    <div class="overflow-hidden">

                        <h3 class="font-bold text-slate-900 text-base truncate">
                            ${escapeHtml(
                                item.brand_name
                            )}
                        </h3>


                        <p class="text-xs text-slate-500 mt-0.5">

                            Composition:

                            <span class="font-medium text-slate-700">
                                ${escapeHtml(
                                    item.composition ||
                                    'Not available'
                                )}
                            </span>

                        </p>

                    </div>


                    <div class="${badgeColor} text-white px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap shadow-sm">

                        📍
                        ${escapeHtml(
                            item.box_location
                        )}

                    </div>

                </div>

            `).join('')}

        `;

    }


    // ===============================================================
    // ESCAPE HTML
    // ===============================================================

    function escapeHtml(value) {

        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

    }


    // ===============================================================
    // MANUAL FORM
    // ===============================================================

    const manualForm =
        document.getElementById(
            'manualForm'
        );


    if (manualForm) {

        manualForm.addEventListener(
            'submit',
            async (e) => {

                e.preventDefault();


                const brandName =
                    document
                        .getElementById(
                            'brandName'
                        )
                        .value
                        .trim();


                const composition =
                    document
                        .getElementById(
                            'composition'
                        )
                        .value
                        .trim();


                const boxLocation =
                    document
                        .getElementById(
                            'boxLocation'
                        )
                        .value
                        .trim()
                        .toUpperCase();


                // ------------------------------------------------
                // VALIDATE BOX
                // ------------------------------------------------

                if (!boxRegex.test(boxLocation)) {

                    alert(
                        'Invalid Box Location format! It must start with an alphabet followed by numbers (e.g., A1, B12).'
                    );

                    return;

                }


                const submitBtn =
                    e.target.querySelector(
                        'button[type="submit"]'
                    );


                const originalBtnText =
                    submitBtn.textContent;


                submitBtn.disabled =
                    true;

                submitBtn.textContent =
                    'Saving...';


                try {

                    // ------------------------------------------------
                    // DUPLICATE CHECK
                    // ------------------------------------------------

                    const existing =
                        await findExactBrand(
                            brandName
                        );


                    const isDuplicate =
                        existing.some(
                            item =>
                                item.brand_name
                                    .toLowerCase() ===
                                brandName.toLowerCase()
                        );


                    if (isDuplicate) {

                        alert(
                            `⚠️ WARNING: The brand "${brandName}" already exists in the inventory.`
                        );

                        return;

                    }


                    // ------------------------------------------------
                    // INSERT
                    // ------------------------------------------------

                    await insertMedicine({

                        brand_name:
                            brandName,

                        composition:
                            composition,

                        box_location:
                            boxLocation

                    });


                    alert(
                        'Tablet details saved successfully!'
                    );


                    e.target.reset();


                    searchInput.value =
                        '';


                    searchResults.innerHTML = `
                        <p class="text-sm text-slate-400 italic">
                            Start typing to search inventory...
                        </p>
                    `;


                } catch (error) {

                    alert(
                        error.message
                    );

                } finally {

                    submitBtn.disabled =
                        false;

                    submitBtn.textContent =
                        originalBtnText;

                }

            }
        );

    }


    // ===============================================================
    // EXCEL UPLOAD
    // ===============================================================

    const fileInput =
        document.getElementById(
            'excelFile'
        );


    const removeFileBtn =
        document.getElementById(
            'removeFileBtn'
        );


    const uploadBtn =
        document.getElementById(
            'uploadBtn'
        );


    // ===============================================================
    // SHOW REMOVE BUTTON
    // ===============================================================

    if (fileInput) {

        fileInput.addEventListener(
            'change',
            () => {

                if (
                    fileInput.files.length > 0
                ) {

                    removeFileBtn.classList.remove(
                        'hidden'
                    );

                } else {

                    removeFileBtn.classList.add(
                        'hidden'
                    );

                }

            }
        );

    }


    // ===============================================================
    // REMOVE SELECTED FILE
    // ===============================================================

    if (removeFileBtn) {

        removeFileBtn.addEventListener(
            'click',
            () => {

                fileInput.value =
                    '';

                removeFileBtn.classList.add(
                    'hidden'
                );

            }
        );

    }


    // ===============================================================
    // PROCESS & IMPORT EXCEL
    // ===============================================================

    if (uploadBtn) {

        uploadBtn.addEventListener(
            'click',
            async () => {

                if (
                    !fileInput.files.length
                ) {

                    alert(
                        'Please select an Excel file first.'
                    );

                    return;

                }


                const file =
                    fileInput.files[0];


                uploadBtn.disabled =
                    true;

                uploadBtn.textContent =
                    'Processing...';


                try {

                    const formData =
                        new FormData();


                    formData.append(
                        'file',
                        file
                    );


                    const response =
                        await fetch(
                            UPLOAD_API,
                            {
                                method: 'POST',
                                body: formData
                            }
                        );


                    const result =
                        await response.json();


                    if (!response.ok) {

                        let message =
                            result.message ||
                            'Excel upload failed.';


                        if (
                            result.detectedColumns
                        ) {

                            message +=
                                `\n\nDetected columns:\n${result.detectedColumns.join(', ')}`;

                        }


                        throw new Error(
                            message
                        );

                    }


                    alert(
                        `Excel processed successfully!\n\nAdded: ${result.added}\nDuplicates ignored: ${result.duplicatesIgnored}\nSkipped: ${result.skipped || 0}`
                    );


                    // Clear selected file

                    fileInput.value =
                        '';

                    removeFileBtn.classList.add(
                        'hidden'
                    );


                } catch (error) {

                    alert(
                        'Error processing file:\n' +
                        error.message
                    );

                } finally {

                    uploadBtn.disabled =
                        false;

                    uploadBtn.textContent =
                        'Process & Import Excel';

                }

            }
        );

    }


    // ===============================================================
    // PAGE READY CHECK
    // ===============================================================

    console.log(
        'Smart Pharmacy application loaded successfully.'
    );

    console.log(
        'Backend:',
        IS_LOCAL
            ? API_BASE_URL
            : 'Vercel API'
    );

});