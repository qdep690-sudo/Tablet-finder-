document.addEventListener('DOMContentLoaded', () => {

    // ==========================================================
    // API URL
    // ==========================================================

    const API_BASE_URL =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3000'
            : '';


    // ==========================================================
    // GEMINI
    // ==========================================================

    const GEMINI_API_KEY = '';


    // ==========================================================
    // BOX VALIDATION
    // ==========================================================

    const boxRegex = /^[A-Za-z][0-9]+$/;


    // ==========================================================
    // SEARCH CACHE
    // ==========================================================

    const searchCache = new Map();


    // ==========================================================
    // API URL
    // ==========================================================

    function getMedicinesUrl(search = '') {

        const url =
            API_BASE_URL
                ? `${API_BASE_URL}/medicines`
                : '/api/medicines';

        if (!search) {
            return url;
        }

        return `${url}?search=${encodeURIComponent(search)}`;

    }


    // ==========================================================
    // UPLOAD URL
    // ==========================================================

    function getUploadUrl() {

        return API_BASE_URL
            ? `${API_BASE_URL}/medicines/upload`
            : '/api/upload';

    }


    // ==========================================================
    // ESCAPE HTML
    // ==========================================================

    function escapeHtml(value) {

        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

    }


    // ==========================================================
    // SEARCH DATABASE
    // ONE REQUEST ONLY
    // ==========================================================

    async function searchMedicines(query) {

        const search =
            query
                .trim()
                .toLowerCase();


        if (!search) {
            return [];
        }


        // ------------------------------------------------------
        // CHECK CACHE
        // ------------------------------------------------------

        if (
            searchCache.has(search)
        ) {

            return searchCache.get(search);

        }


        // ------------------------------------------------------
        // TURSO SEARCH
        // ------------------------------------------------------

        const response =
            await fetch(
                getMedicinesUrl(search)
            );


        if (!response.ok) {

            throw new Error(
                'Search failed.'
            );

        }


        const results =
            await response.json();


        // ------------------------------------------------------
        // SAVE CACHE
        // ------------------------------------------------------

        searchCache.set(
            search,
            results
        );


        return results;

    }


    // ==========================================================
    // EXACT BRAND CHECK
    // ==========================================================

    async function findExactBrand(
        brandName
    ) {

        const results =
            await searchMedicines(
                brandName
            );


        return results.filter(item =>

            item.brand_name &&
            item.brand_name
                .toLowerCase()
                ===
            brandName
                .toLowerCase()

        );

    }


    // ==========================================================
    // ADD MEDICINE
    // ==========================================================

    async function insertMedicine(
        record
    ) {

        const url =
            API_BASE_URL
                ? `${API_BASE_URL}/medicines`
                : '/api/medicines';


        const response =
            await fetch(
                url,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify(
                            record
                        )
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            if (
                response.status === 409
            ) {

                throw new Error(
                    'Medicine already exists'
                );

            }


            throw new Error(
                data.message ||
                'Insert failed.'
            );

        }


        // Clear cache because
        // database changed.

        searchCache.clear();


        return data;

    }


    // ==========================================================
    // GEMINI
    // ==========================================================

    async function callGemini(
        promptText
    ) {

        const apiKey =
            GEMINI_API_KEY.trim();


        if (!apiKey) {

            throw new Error(
                'Gemini AI is not configured.'
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
                'Failed to connect to Gemini API.'
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
            .map(
                part =>
                    part.text || ''
            )
            .join('')
            .trim();

    }


    // ==========================================================
    // AI FILL
    // ==========================================================

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


                const originalText =
                    aiFillBtn.textContent;


                aiFillBtn.textContent =
                    'Thinking...';

                aiFillBtn.disabled =
                    true;


                try {

                    const prompt =
                        `Give only the active salt and strength composition for the medical tablet brand "${brandName}". Keep it concise. Do not include extra text.`;


                    const composition =
                        await callGemini(
                            prompt
                        );


                    document
                        .getElementById(
                            'composition'
                        )
                        .value =
                        composition;


                } catch (error) {

                    alert(
                        error.message
                    );

                } finally {

                    aiFillBtn.textContent =
                        originalText;

                    aiFillBtn.disabled =
                        false;

                }

            }
        );

    }


    // ==========================================================
    // SEARCH BOX
    // ==========================================================

    const searchInput =
        document.getElementById(
            'searchInput'
        );


    const searchResults =
        document.getElementById(
            'searchResults'
        );


    let searchTimeout = null;

    let latestSearchNumber = 0;


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
                        100
                    );

            }
        );

    }


    // ==========================================================
    // PERFORM SEARCH
    // ==========================================================

    async function performSearch() {

        const query =
            searchInput
                .value
                .trim();


        const searchNumber =
            ++latestSearchNumber;


        if (!query) {

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


        try {

            // ==================================================
            // ONE DATABASE REQUEST
            // ==================================================

            const results =
                await searchMedicines(
                    query
                );


            // Ignore old request

            if (
                searchNumber !==
                latestSearchNumber
            ) {

                return;

            }


            // ==================================================
            // RESULTS FOUND
            // ==================================================

            if (
                results.length > 0
            ) {

                renderResults(
                    results,
                    '✓ Match Found',
                    'bg-blue-50',
                    'text-emerald-600',
                    'bg-blue-600'
                );

                return;

            }


            // ==================================================
            // GEMINI ONLY AFTER 3 CHARACTERS
            // ==================================================

            if (
                query.length < 3
            ) {

                searchResults.innerHTML = `
                    <div class="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium">
                        No records found for "${escapeHtml(query)}".
                    </div>
                `;

                return;

            }


            searchResults.innerHTML = `
                <div class="p-4 bg-purple-50 text-purple-800 rounded-xl text-sm">
                    🤖 Searching composition via Gemini AI...
                </div>
            `;


            try {

                const prompt =
                    `For the medicine brand or query "${query}", what is its generic active salt composition? Return ONLY the composition string. If it is not a medicine, return "UNKNOWN".`;


                const detectedComposition =
                    await callGemini(
                        prompt
                    );


                if (
                    !detectedComposition ||
                    detectedComposition
                        .toUpperCase()
                        === 'UNKNOWN'
                ) {

                    searchResults.innerHTML = `
                        <div class="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium">
                            No records found for "${escapeHtml(query)}".
                        </div>
                    `;

                    return;

                }


                // Search Turso ONE more time
                // only when Gemini is actually needed.

                const aiResults =
                    await searchMedicines(
                        detectedComposition
                    );


                if (
                    aiResults.length > 0
                ) {

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
                                Found alternative brands in stock:
                            </p>

                        </div>

                        ${aiResults.map(
                            item => `

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

                        `
                        ).join('')}

                    `;

                } else {

                    searchResults.innerHTML = `

                        <div class="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium">

                            No matching medicine found in stock.

                        </div>

                    `;

                }


            } catch (error) {

                searchResults.innerHTML = `
                    <div class="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium">
                        No local record found.
                    </div>
                `;

            }


        } catch (error) {

            searchResults.innerHTML = `
                <div class="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium">
                    ${escapeHtml(
                        error.message
                    )}
                </div>
            `;

        }

    }


    // ==========================================================
    // RENDER RESULTS
    // ==========================================================

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

            ${items.map(
                item => `

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

            `
            ).join('')}

        `;

    }


    // ==========================================================
    // MANUAL FORM
    // ==========================================================

    const manualForm =
        document.getElementById(
            'manualForm'
        );


    if (manualForm) {

        manualForm.addEventListener(
            'submit',
            async e => {

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


                if (!brandName) {

                    alert(
                        'Please enter a Brand Name.'
                    );

                    return;

                }


                if (
                    !boxRegex.test(
                        boxLocation
                    )
                ) {

                    alert(
                        'Invalid Box Location format! It must start with an alphabet followed by numbers (e.g., A1, B12).'
                    );

                    return;

                }


                const submitBtn =
                    e.target.querySelector(
                        'button[type="submit"]'
                    );


                const originalText =
                    submitBtn.textContent;


                submitBtn.disabled =
                    true;

                submitBtn.textContent =
                    'Saving...';


                try {

                    const existing =
                        await findExactBrand(
                            brandName
                        );


                    if (
                        existing.some(
                            item =>
                                item.brand_name
                                    .toLowerCase()
                                ===
                                brandName
                                    .toLowerCase()
                        )
                    ) {

                        alert(
                            `⚠️ WARNING: The brand "${brandName}" already exists in the inventory.`
                        );

                        return;

                    }


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

                    searchInput.value = '';

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
                        originalText;

                }

            }
        );

    }


    // ==========================================================
    // EXCEL UPLOAD
    // ==========================================================

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


    if (removeFileBtn) {

        removeFileBtn.addEventListener(
            'click',
            () => {

                fileInput.value = '';

                removeFileBtn.classList.add(
                    'hidden'
                );

            }
        );

    }


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
                            getUploadUrl(),
                            {
                                method: 'POST',
                                body:
                                    formData
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
                                `\n\nDetected columns:\n${
                                    result
                                        .detectedColumns
                                        .join(', ')
                                }`;

                        }


                        throw new Error(
                            message
                        );

                    }


                    // Clear cache because
                    // Excel changed database.

                    searchCache.clear();


                    alert(
                        `Excel processed successfully!\n\n` +
                        `Added: ${
                            result.added || 0
                        }\n` +
                        `Duplicates ignored: ${
                            result.duplicatesIgnored || 0
                        }\n` +
                        `Skipped: ${
                            result.skipped || 0
                        }`
                    );


                    fileInput.value = '';


                    if (
                        removeFileBtn
                    ) {

                        removeFileBtn.classList.add(
                            'hidden'
                        );

                    }


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


    // ==========================================================
    // READY
    // ==========================================================

    console.log(
        'Smart Pharmacy application loaded successfully.'
    );

});