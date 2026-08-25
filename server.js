require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const { createClient } = require('@libsql/client');

const app = express();

const PORT = process.env.PORT || 3000;

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json());

// Serve frontend files locally
app.use(express.static(__dirname));


// ======================================================
// TURSO DATABASE
// ======================================================

if (!process.env.TURSO_DATABASE_URL) {
    console.error('ERROR: TURSO_DATABASE_URL is missing.');
}

if (!process.env.TURSO_AUTH_TOKEN) {
    console.error('ERROR: TURSO_AUTH_TOKEN is missing.');
}

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});


// ======================================================
// CREATE MEDICINES TABLE
// ======================================================

async function initializeDatabase() {

    await db.execute(`
        CREATE TABLE IF NOT EXISTS medicines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand_name TEXT NOT NULL UNIQUE,
            composition TEXT,
            box_location TEXT NOT NULL
        )
    `);

    console.log('Turso database connected.');
    console.log('Medicines table ready.');

}


// ======================================================
// EXCEL UPLOAD
// ======================================================

const upload = multer({
    storage: multer.memoryStorage()
});


// ======================================================
// GET ALL MEDICINES
// ======================================================

app.get('/medicines', async (req, res) => {

    try {

        const result = await db.execute(`
            SELECT
                id,
                brand_name,
                composition,
                box_location
            FROM medicines
            ORDER BY brand_name ASC
        `);

        res.json(result.rows);

    } catch (error) {

        console.error('GET /medicines error:', error);

        res.status(500).json({
            message: 'Could not load medicines',
            error: error.message
        });

    }

});


// ======================================================
// ADD ONE MEDICINE
// ======================================================

app.post('/medicines', async (req, res) => {

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


        const cleanBrandName =
            String(brand_name).trim();

        const cleanComposition =
            composition
                ? String(composition).trim()
                : '';

        const cleanBoxLocation =
            String(box_location)
                .trim()
                .toUpperCase();


        // --------------------------------------------------
        // CHECK DUPLICATE
        // --------------------------------------------------

        const existing =
            await db.execute({
                sql: `
                    SELECT id
                    FROM medicines
                    WHERE LOWER(TRIM(brand_name))
                        = LOWER(TRIM(?))
                    LIMIT 1
                `,
                args: [cleanBrandName]
            });


        if (existing.rows.length > 0) {

            return res.status(409).json({
                message: 'Medicine already exists'
            });

        }


        // --------------------------------------------------
        // INSERT
        // --------------------------------------------------

        const result =
            await db.execute({
                sql: `
                    INSERT INTO medicines
                    (
                        brand_name,
                        composition,
                        box_location
                    )
                    VALUES (?, ?, ?)
                `,
                args: [
                    cleanBrandName,
                    cleanComposition,
                    cleanBoxLocation
                ]
            });


        res.json({
    id: Number(result.lastInsertRowid),
    message: 'Medicine added successfully'
});


    } catch (error) {

        console.error('POST /medicines error:', error);

        res.status(500).json({
            message: 'Could not add medicine',
            error: error.message
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
            normalizedAliases.includes(
                normalizedKey
            )
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
        findColumn(
            row,
            aliases
        );


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
    async (req, res) => {

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


            // Track duplicates in current Excel
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


                const finalLocation =
                    boxLocation
                        .trim()
                        .toUpperCase();


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
                // CHECK TURSO DATABASE
                // ------------------------------------------------

                const existing =
                    await db.execute({
                        sql: `
                            SELECT id
                            FROM medicines
                            WHERE LOWER(TRIM(brand_name))
                                = LOWER(TRIM(?))
                            LIMIT 1
                        `,
                        args: [brandName]
                    });


                // ------------------------------------------------
                // ALREADY EXISTS
                // ------------------------------------------------

                if (existing.rows.length > 0) {

                    duplicates++;

                    continue;

                }


                // ------------------------------------------------
                // INSERT INTO TURSO
                // ------------------------------------------------

                await db.execute({
                    sql: `
                        INSERT INTO medicines
                        (
                            brand_name,
                            composition,
                            box_location
                        )
                        VALUES (?, ?, ?)
                    `,
                    args: [
                        brandName.trim(),
                        composition.trim(),
                        finalLocation
                    ]
                });


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
// TEST TURSO CONNECTION
// ======================================================

app.get('/test-turso', async (req, res) => {

    try {

        const result =
            await db.execute(`
                SELECT COUNT(*) AS count
                FROM medicines
            `);

        res.json({
            success: true,
            database: 'Turso',
            medicineCount: result.rows[0].count
        });

    } catch (error) {

        console.error(
            'Turso connection test failed:',
            error
        );

        res.status(500).json({
            success: false,
            message: 'Turso connection failed',
            error: error.message
        });

    }

});


// ======================================================
// START SERVER
// ======================================================

async function startServer() {

    try {

        await initializeDatabase();

        app.listen(PORT, () => {

            console.log(
                `Server running on http://localhost:${PORT}`
            );

        });

    } catch (error) {

        console.error(
            'Failed to start server:',
            error
        );

        process.exit(1);

    }

}


startServer();