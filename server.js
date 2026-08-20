const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');

const app = express();

const PORT = 3000;

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json());

// Serve all frontend files from the same folder
app.use(express.static(__dirname));

// Explicitly serve script.js
app.get('/script.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'script.js'));
});


// ======================================================
// EXCEL UPLOAD
// ======================================================

const upload = multer({
    storage: multer.memoryStorage()
});


// ======================================================
// SQLITE DATABASE
// ======================================================

const db = new Database(
    path.join(__dirname, 'medicines.db')
);


// ======================================================
// CREATE MEDICINES TABLE
// ======================================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand_name TEXT NOT NULL UNIQUE,
        composition TEXT,
        box_location TEXT NOT NULL
    )
`).run();


// ======================================================
// GET ALL MEDICINES
// ======================================================

app.get('/medicines', (req, res) => {

    try {

        const medicines = db.prepare(`
            SELECT *
            FROM medicines
            ORDER BY brand_name ASC
        `).all();

        res.json(medicines);

    } catch (error) {

        console.error('GET /medicines error:', error);

        res.status(500).json({
            message: 'Could not load medicines'
        });

    }

});


// ======================================================
// ADD ONE MEDICINE
// ======================================================

app.post('/medicines', (req, res) => {

    try {

        const {
            brand_name,
            composition,
            box_location
        } = req.body;


        if (!brand_name || !box_location) {

            return res.status(400).json({
                message: 'Brand name and box location are required'
            });

        }


        // --------------------------------------------------
        // CHECK DUPLICATE
        // --------------------------------------------------

        const existing = db.prepare(`
            SELECT id
            FROM medicines
            WHERE LOWER(TRIM(brand_name))
                = LOWER(TRIM(?))
        `).get(brand_name);


        if (existing) {

            return res.status(409).json({
                message: 'Medicine already exists'
            });

        }


        // --------------------------------------------------
        // INSERT
        // --------------------------------------------------

        const result = db.prepare(`
            INSERT INTO medicines
            (
                brand_name,
                composition,
                box_location
            )
            VALUES (?, ?, ?)
        `).run(
            brand_name.trim(),
            composition ? composition.trim() : '',
            box_location.trim().toUpperCase()
        );


        res.json({
            id: result.lastInsertRowid,
            message: 'Medicine added successfully'
        });


    } catch (error) {

        console.error('POST /medicines error:', error);

        res.status(500).json({
            message: 'Could not add medicine'
        });

    }

});


// ======================================================
// NORMALIZE EXCEL HEADER
// ======================================================

function normalizeHeader(header) {

    return String(header || '')
        .toLowerCase()
        .trim()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '');

}


// ======================================================
// FIND COLUMN
// ======================================================

function findColumn(row, aliases) {

    const keys = Object.keys(row);

    const normalizedAliases =
        aliases.map(normalizeHeader);


    for (const key of keys) {

        const normalizedKey =
            normalizeHeader(key);


        if (
            normalizedAliases.includes(normalizedKey)
        ) {

            return key;

        }

    }


    return null;

}


// ======================================================
// GET COLUMN VALUE
// ======================================================

function getValue(row, aliases) {

    const column =
        findColumn(row, aliases);


    if (!column) {
        return '';
    }


    return String(
        row[column] ?? ''
    ).trim();

}


// ======================================================
// EXCEL UPLOAD
// ======================================================

app.post(
    '/medicines/upload',
    upload.single('file'),
    (req, res) => {

        try {

            // --------------------------------------------------
            // CHECK FILE
            // --------------------------------------------------

            if (!req.file) {

                return res.status(400).json({
                    message:
                        'Please upload an Excel file'
                });

            }


            console.log(
                '\n======================================'
            );

            console.log(
                'Excel file received:',
                req.file.originalname
            );

            console.log(
                '======================================'
            );


            // --------------------------------------------------
            // READ EXCEL
            // --------------------------------------------------

            const workbook =
                XLSX.read(
                    req.file.buffer,
                    {
                        type: 'buffer'
                    }
                );


            if (
                !workbook.SheetNames ||
                workbook.SheetNames.length === 0
            ) {

                return res.status(400).json({
                    message:
                        'Excel file does not contain a worksheet'
                });

            }


            const sheetName =
                workbook.SheetNames[0];


            const worksheet =
                workbook.Sheets[sheetName];


            const rows =
                XLSX.utils.sheet_to_json(
                    worksheet,
                    {
                        defval: ''
                    }
                );


            // --------------------------------------------------
            // EMPTY EXCEL
            // --------------------------------------------------

            if (rows.length === 0) {

                return res.status(400).json({
                    message:
                        'Excel file is empty'
                });

            }


            // --------------------------------------------------
            // HEADERS
            // --------------------------------------------------

            const headers =
                Object.keys(rows[0]);


            console.log(
                'Excel columns:',
                headers
            );


            // ==================================================
            // BRAND / MEDICINE ALIASES
            // ==================================================

            const brandAliases = [

                'brand_name',
                'brand name',
                'brand',

                'medicine_name',
                'medicine name',
                'medicine',

                'tablet_name',
                'tablet name',
                'tablet',

                'drug_name',
                'drug name',
                'drug',

                'product_name',
                'product name',
                'product',

                'item_name',
                'item name',
                'item',

                'medicine title',
                'tablet title',
                'product title',
                'drug title'

            ];


            // ==================================================
            // COMPOSITION ALIASES
            // ==================================================

            const compositionAliases = [

                'composition',

                'composition_salt',
                'composition salt',

                'composition/salt',

                'salt',

                'salt_name',
                'salt name',

                'active_ingredient',
                'active ingredient',

                'active_ingredients',
                'active ingredients',

                'ingredient',
                'ingredients',

                'medicine_composition',
                'medicine composition',

                'tablet_composition',
                'tablet composition',

                'drug_composition',
                'drug composition'

            ];


            // ==================================================
            // LOCATION ALIASES
            // ==================================================

            const locationAliases = [

                'box_location',
                'box location',

                'box',
                'box_no',
                'box no',
                'box_number',
                'box number',

                'rack',
                'rack_location',
                'rack location',
                'rack_no',
                'rack no',
                'rack_number',
                'rack number',

                'rack/box location',
                'rack box location',
                'rack_box_location',
                'rack/box',
                'rack box',

                'storage_location',
                'storage location',

                'storage_bin',
                'storage bin',

                'shelf',
                'shelf_location',
                'shelf location',

                'bin',
                'bin_location',
                'bin location',

                'position',

                'location',

                'location_code',
                'location code',

                'cabinet',
                'cabinet location'

            ];


            // ==================================================
            // DETECT COLUMNS
            // ==================================================

            const brandColumn =
                findColumn(
                    rows[0],
                    brandAliases
                );


            const compositionColumn =
                findColumn(
                    rows[0],
                    compositionAliases
                );


            const locationColumn =
                findColumn(
                    rows[0],
                    locationAliases
                );


            console.log(
                'Detected brand column:',
                brandColumn
            );

            console.log(
                'Detected composition column:',
                compositionColumn
            );

            console.log(
                'Detected location column:',
                locationColumn
            );


            // ==================================================
            // REQUIRE BRAND + LOCATION
            // ==================================================

            if (
                !brandColumn ||
                !locationColumn
            ) {

                return res.status(400).json({

                    message:
                        'Could not recognize the medicine/brand and box/rack/location columns.',

                    detectedColumns:
                        headers,

                    recognizedBrandColumn:
                        brandColumn,

                    recognizedLocationColumn:
                        locationColumn,

                    recognizedCompositionColumn:
                        compositionColumn

                });

            }


            // ==================================================
            // COUNTERS
            // ==================================================

            let added = 0;
            let duplicates = 0;
            let skipped = 0;


            // Track duplicates inside current Excel
            const excelMedicines =
                new Set();


            // ==================================================
            // PROCESS EACH ROW
            // ==================================================

            for (const row of rows) {

                const brandName =
                    getValue(
                        row,
                        brandAliases
                    );


                const composition =
                    getValue(
                        row,
                        compositionAliases
                    );


                const boxLocation =
                    getValue(
                        row,
                        locationAliases
                    );


                console.log({
                    brandName,
                    composition,
                    boxLocation
                });


                // ------------------------------------------------
                // SKIP INCOMPLETE ROW
                // ------------------------------------------------

                if (
                    !brandName ||
                    !boxLocation
                ) {

                    skipped++;

                    continue;

                }


                // ------------------------------------------------
                // NORMALIZE LOCATION
                // ------------------------------------------------

                const finalLocation =
                    boxLocation
                        .trim()
                        .toUpperCase();


                // ------------------------------------------------
                // DUPLICATE KEY
                // ------------------------------------------------

                const medicineKey =
                    brandName
                        .trim()
                        .toLowerCase();


                // ------------------------------------------------
                // DUPLICATE INSIDE EXCEL
                // ------------------------------------------------

                if (
                    excelMedicines.has(
                        medicineKey
                    )
                ) {

                    duplicates++;

                    continue;

                }


                excelMedicines.add(
                    medicineKey
                );


                // ------------------------------------------------
                // CHECK DATABASE
                // ------------------------------------------------

                const existing =
                    db.prepare(`
                        SELECT id
                        FROM medicines
                        WHERE LOWER(TRIM(brand_name))
                            = LOWER(TRIM(?))
                    `).get(
                        brandName
                    );


                // ------------------------------------------------
                // ALREADY EXISTS
                // ------------------------------------------------

                if (existing) {

                    duplicates++;

                    continue;

                }


                // ------------------------------------------------
                // INSERT
                // ------------------------------------------------

                db.prepare(`
                    INSERT INTO medicines
                    (
                        brand_name,
                        composition,
                        box_location
                    )
                    VALUES (?, ?, ?)
                `).run(
                    brandName.trim(),
                    composition.trim(),
                    finalLocation
                );


                added++;

            }


            // ==================================================
            // RESULT
            // ==================================================

            console.log(
                '======================================'
            );

            console.log(
                'Excel import completed'
            );

            console.log(
                'Added:',
                added
            );

            console.log(
                'Duplicates:',
                duplicates
            );

            console.log(
                'Skipped:',
                skipped
            );

            console.log(
                '======================================'
            );


            res.json({

                message:
                    'Excel processed successfully',

                added:
                    added,

                duplicatesIgnored:
                    duplicates,

                skipped:
                    skipped

            });


        } catch (error) {

            console.error(
                'Excel upload error:',
                error
            );


            res.status(500).json({

                message:
                    'Error processing Excel file',

                error:
                    error.message

            });

        }

    }
);


// ======================================================
// SERVE INDEX.HTML
// ======================================================

app.get('/', (req, res) => {

    res.sendFile(
        path.join(__dirname, 'index.html')
    );

});


// ======================================================
// TEST SCRIPT.JS ROUTE
// ======================================================

app.get('/test-script', (req, res) => {

    res.json({
        success: true,
        scriptPath: path.join(__dirname, 'script.js'),
        message: 'Server can access script.js'
    });

});


// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, () => {

    console.log(
        `Server running on http://localhost:${PORT}`
    );

});