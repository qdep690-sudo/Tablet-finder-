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
// DATABASE INITIALIZATION
// ======================================================

let databaseInitialized = false;

async function initializeDatabase() {

    if (databaseInitialized) {
        return;
    }

    // --------------------------------------------------
    // CREATE TABLE
    // --------------------------------------------------

    await db.execute(`
        CREATE TABLE IF NOT EXISTS medicines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand_name TEXT NOT NULL UNIQUE,
            composition TEXT,
            box_location TEXT NOT NULL
        )
    `);


    // --------------------------------------------------
    // DATABASE INDEXES
    // --------------------------------------------------

    await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_medicines_composition
        ON medicines(composition)
    `);

    await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_medicines_box_location
        ON medicines(box_location)
    `);

    databaseInitialized = true;

    console.log('Turso database connected.');
    console.log('Medicines table ready.');
    console.log('Database indexes ready.');
}


// ======================================================
// EXCEL UPLOAD
// ======================================================

const upload = multer({
    storage: multer.memoryStorage()
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
        new Set(
            aliases.map(normalizeHeader)
        );

    for (const key of keys) {

        const normalizedKey =
            normalizeHeader(key);

        if (
            normalizedAliases.has(
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
// EXCEL COLUMN ALIASES
// ======================================================

const brandAliases = [

    'brand_name',
    'brand name',
    'brand',
    'brandname',

    'medicine_name',
    'medicine name',
    'medicine',
    'medicinename',

    'tablet_name',
    'tablet name',
    'tablet',
    'tabletname',

    'drug_name',
    'drug name',
    'drug',
    'drugname',

    'product_name',
    'product name',
    'product',
    'productname',

    'item_name',
    'item name',
    'item',
    'itemname',

    'medicine title',
    'tablet title',
    'product title',
    'drug title',

    'medicine brand',
    'tablet brand',
    'drug brand',
    'product brand',

    'medicine description',
    'tablet description',
    'drug description',
    'product description',

    'name'
];


const compositionAliases = [

    'composition',
    'composition_name',
    'composition name',

    'composition_salt',
    'composition salt',

    'composition/salt',

    'salt',
    'salt_name',
    'salt name',
    'saltname',

    'active_ingredient',
    'active ingredient',

    'active_ingredients',
    'active ingredients',

    'activeingredient',
    'activeingredients',

    'ingredient',
    'ingredients',

    'ingredient_name',
    'ingredient name',

    'generic',
    'generic_name',
    'generic name',

    'medicine_composition',
    'medicine composition',

    'tablet_composition',
    'tablet composition',

    'drug_composition',
    'drug composition',

    'product_composition',
    'product composition',

    'salt_details',
    'salt details',

    'composition_details',
    'composition details'
];


const locationAliases = [

    'box_location',
    'box location',

    'box',
    'box_no',
    'box no',

    'box_number',
    'box number',
    'boxnumber',

    'box_code',
    'box code',

    'rack',
    'rack_location',
    'rack location',

    'rack_no',
    'rack no',

    'rack_number',
    'rack number',
    'racknumber',

    'rack_code',
    'rack code',

    'rack/box',
    'rack box',

    'rack/box location',
    'rack box location',

    'rack_box_location',

    'storage',
    'storage_location',
    'storage location',

    'storage_bin',
    'storage bin',

    'storage_position',
    'storage position',

    'storage_place',
    'storage place',

    'shelf',
    'shelf_location',
    'shelf location',

    'shelf_no',
    'shelf no',

    'shelf_number',
    'shelf number',

    'bin',
    'bin_location',
    'bin location',

    'bin_no',
    'bin no',

    'bin_number',
    'bin number',

    'position',
    'position_code',
    'position code',

    'location',
    'location_code',
    'location code',

    'location_name',
    'location name',

    'cabinet',
    'cabinet_location',
    'cabinet location',

    'storage_location_code',
    'storage location code',

    'storage_location_name',
    'storage location name'
];


// ======================================================
// GET NEXT MEDICINE ID
// ======================================================

async function getNextMedicineId() {

    const result = await db.execute(`
        SELECT COALESCE(MAX(id), 0) + 1 AS next_id
        FROM medicines
    `);

    return Number(
        result.rows[0].next_id
    );
}


// ======================================================
// GET MEDICINES
// ======================================================

app.get('/medicines', async (req, res) => {

    try {

        await initializeDatabase();

        const search =
            String(
                req.query.search || ''
            )
                .trim()
                .toLowerCase();


        // ==================================================
        // SEARCH
        // ==================================================

        if (search) {

            const searchPattern =
                `%${search}%`;

            const result =
                await db.execute({

                    sql: `
                        SELECT
                            id,
                            brand_name,
                            composition,
                            box_location
                        FROM medicines
                        WHERE
                            LOWER(brand_name) LIKE ?
                            OR
                            LOWER(composition) LIKE ?
                        ORDER BY brand_name ASC
                        LIMIT 50
                    `,

                    args: [
                        searchPattern,
                        searchPattern
                    ]

                });


            const medicines =
                result.rows.map(row => ({

                    id:
                        Number(row.id),

                    brand_name:
                        row.brand_name || '',

                    composition:
                        row.composition || '',

                    box_location:
                        row.box_location || ''

                }));


            return res.json(
                medicines
            );

        }


        // ==================================================
        // GET ALL
        // ==================================================

        const result =
            await db.execute(`
                SELECT
                    id,
                    brand_name,
                    composition,
                    box_location
                FROM medicines
                ORDER BY brand_name ASC
            `);


        const medicines =
            result.rows.map(row => ({

                id:
                    Number(row.id),

                brand_name:
                    row.brand_name || '',

                composition:
                    row.composition || '',

                box_location:
                    row.box_location || ''

            }));


        return res.json(
            medicines
        );


    } catch (error) {

        console.error(
            'GET /medicines error:',
            error
        );


        return res.status(500).json({

            message:
                'Could not load medicines',

            error:
                error.message

        });

    }

});


// ======================================================
// ADD ONE MEDICINE
// ======================================================

app.post('/medicines', async (req, res) => {

    try {

        await initializeDatabase();


        const {
            brand_name,
            composition,
            box_location
        } = req.body || {};


        // --------------------------------------------------
        // VALIDATION
        // --------------------------------------------------

        if (
            !brand_name ||
            !box_location
        ) {

            return res.status(400).json({

                message:
                    'Brand name and box location are required'

            });

        }


        // --------------------------------------------------
        // CLEAN DATA
        // --------------------------------------------------

        const cleanBrandName =
            String(
                brand_name
            ).trim();


        const cleanComposition =
            composition
                ? String(
                    composition
                ).trim()
                : '';


        const cleanBoxLocation =
            String(
                box_location
            )
                .trim()
                .toUpperCase();


        // --------------------------------------------------
        // BRAND NAME VALIDATION
        // --------------------------------------------------

        if (!cleanBrandName) {

            return res.status(400).json({

                message:
                    'Brand name cannot be empty'

            });

        }


        // --------------------------------------------------
        // BOX VALIDATION
        // --------------------------------------------------

        const boxRegex =
            /^[A-Za-z][0-9]+$/;


        if (
            !boxRegex.test(
                cleanBoxLocation
            )
        ) {

            return res.status(400).json({

                message:
                    'Invalid Box Location. Use a format such as A1 or B12.'

            });

        }


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

                args: [
                    cleanBrandName
                ]

            });


        if (
            existing.rows.length > 0
        ) {

            return res.status(409).json({

                message:
                    'Medicine already exists'

            });

        }


        // --------------------------------------------------
        // GET NEXT ID
        //
        // If table is empty:
        // MAX(id) = 0
        // next ID = 1
        //
        // If current IDs are:
        // 263, 264, 265
        // next ID = 266
        // --------------------------------------------------

        const nextId =
            await getNextMedicineId();


        // --------------------------------------------------
        // INSERT WITH EXPLICIT ID
        // --------------------------------------------------

        await db.execute({

            sql: `
                INSERT INTO medicines
                (
                    id,
                    brand_name,
                    composition,
                    box_location
                )
                VALUES (?, ?, ?, ?)
            `,

            args: [

                nextId,

                cleanBrandName,

                cleanComposition,

                cleanBoxLocation

            ]

        });


        // --------------------------------------------------
        // RESPONSE
        // --------------------------------------------------

        return res.json({

            id:
                nextId,

            message:
                'Medicine added successfully'

        });


    } catch (error) {

        console.error(
            'POST /medicines error:',
            error
        );


        return res.status(500).json({

            message:
                'Could not add medicine',

            error:
                error.message

        });

    }

});


// ======================================================
// EXCEL UPLOAD
// ======================================================

app.post(
    '/medicines/upload',
    upload.single('file'),
    async (req, res) => {

        try {

            await initializeDatabase();


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
                        type: 'buffer',
                        raw: false
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


            const worksheet =
                workbook.Sheets[
                    workbook.SheetNames[0]
                ];


            const rows =
                XLSX.utils.sheet_to_json(
                    worksheet,
                    {
                        defval: '',
                        raw: false
                    }
                );


            // --------------------------------------------------
            // EMPTY EXCEL
            // --------------------------------------------------

            if (
                rows.length === 0
            ) {

                return res.status(400).json({

                    message:
                        'Excel file is empty'

                });

            }


            // --------------------------------------------------
            // HEADERS
            // --------------------------------------------------

            const headers =
                Object.keys(
                    rows[0]
                );


            console.log(
                'Excel columns:',
                headers
            );


            // --------------------------------------------------
            // DETECT COLUMNS
            // --------------------------------------------------

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


            // --------------------------------------------------
            // REQUIRE BRAND + LOCATION
            // --------------------------------------------------

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
            // GET EXISTING BRANDS ONCE
            // ==================================================

            const existingResult =
                await db.execute(`
                    SELECT brand_name
                    FROM medicines
                `);


            const existingBrands =
                new Set(
                    existingResult.rows.map(
                        row =>
                            String(
                                row.brand_name
                            )
                                .trim()
                                .toLowerCase()
                    )
                );


            // ==================================================
            // PROCESS EXCEL IN MEMORY
            // ==================================================

            const excelMedicines =
                new Set();


            const recordsToInsert =
                [];


            let duplicates = 0;

            let skipped = 0;


            for (
                const row of rows
            ) {

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


                // ------------------------------------------------
                // SKIP INCOMPLETE
                // ------------------------------------------------

                if (
                    !brandName ||
                    !boxLocation
                ) {

                    skipped++;

                    continue;

                }


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


                // ------------------------------------------------
                // ALREADY IN DATABASE
                // ------------------------------------------------

                if (
                    existingBrands.has(
                        medicineKey
                    )
                ) {

                    duplicates++;

                    continue;

                }


                excelMedicines.add(
                    medicineKey
                );


                recordsToInsert.push({

                    brand_name:
                        brandName.trim(),

                    composition:
                        composition.trim(),

                    box_location:
                        boxLocation
                            .trim()
                            .toUpperCase()

                });

            }


            // ==================================================
            // GET STARTING ID
            // ==================================================

            let nextId =
                await getNextMedicineId();


            // ==================================================
            // CREATE BATCH INSERT STATEMENTS
            // ==================================================

            if (
                recordsToInsert.length > 0
            ) {

                const statements =
                    recordsToInsert.map(
                        record => {

                            const assignedId =
                                nextId;

                            nextId++;


                            return {

                                sql: `
                                    INSERT INTO medicines
                                    (
                                        id,
                                        brand_name,
                                        composition,
                                        box_location
                                    )
                                    VALUES (?, ?, ?, ?)
                                `,

                                args: [

                                    assignedId,

                                    record.brand_name,

                                    record.composition,

                                    record.box_location

                                ]

                            };

                        }
                    );


                // --------------------------------------------------
                // INSERT ALL EXCEL RECORDS
                // --------------------------------------------------

                await db.batch(
                    statements,
                    'write'
                );

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
                recordsToInsert.length
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


            return res.json({

                message:
                    'Excel processed successfully',

                added:
                    recordsToInsert.length,

                duplicatesIgnored:
                    duplicates,

                skipped:
                    skipped,

                totalRows:
                    rows.length,

                detectedColumns:
                    headers,

                recognizedBrandColumn:
                    brandColumn,

                recognizedCompositionColumn:
                    compositionColumn,

                recognizedLocationColumn:
                    locationColumn

            });


        } catch (error) {

            console.error(
                'Excel upload error:',
                error
            );


            return res.status(500).json({

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
        path.join(
            __dirname,
            'index.html'
        )
    );

});


// ======================================================
// TEST TURSO
// ======================================================

app.get(
    '/test-turso',
    async (req, res) => {

        try {

            const result =
                await db.execute(`
                    SELECT COUNT(*) AS count
                    FROM medicines
                `);


            return res.json({

                success: true,

                database:
                    'Turso',

                medicineCount:
                    Number(
                        result.rows[0].count
                    )

            });


        } catch (error) {

            console.error(
                'Turso connection test failed:',
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    'Turso connection failed',

                error:
                    error.message

            });

        }

    }
);


// ======================================================
// START SERVER
// ======================================================

async function startServer() {

    try {

        await initializeDatabase();


        app.listen(
            PORT,
            () => {

                console.log(
                    `Server running on http://localhost:${PORT}`
                );

            }
        );


    } catch (error) {

        console.error(
            'Failed to start server:',
            error
        );

        process.exit(1);

    }

}


startServer();