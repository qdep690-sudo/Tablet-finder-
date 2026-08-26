const { createClient } = require('@libsql/client');
const multer = require('multer');
const XLSX = require('xlsx');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

const upload = multer({
    storage: multer.memoryStorage()
});


// ======================================================
// NORMALIZE EXCEL HEADER
// ======================================================

function normalizeHeader(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '');
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

    // Exact normalized match
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
// GET VALUE
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
// HANDLE MULTER
// ======================================================

function handleUpload(req, res) {

    return new Promise(
        (resolve, reject) => {

            upload.single('file')(
                req,
                res,
                error => {

                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }

                }
            );

        }
    );
}


// ======================================================
// BRAND / MEDICINE COLUMN ALIASES
// ======================================================

const brandAliases = [

    // Standard
    'brand_name',
    'brand name',
    'brand',
    'brandname',

    // Medicine
    'medicine_name',
    'medicine name',
    'medicine',
    'medicinename',

    // Tablet
    'tablet_name',
    'tablet name',
    'tablet',
    'tabletname',

    // Drug
    'drug_name',
    'drug name',
    'drug',
    'drugname',

    // Product
    'product_name',
    'product name',
    'product',
    'productname',

    // Item
    'item_name',
    'item name',
    'item',
    'itemname',

    // Common alternatives
    'medicine title',
    'tablet title',
    'drug title',
    'product title',
    'item title',

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


// ======================================================
// COMPOSITION COLUMN ALIASES
// ======================================================

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


// ======================================================
// LOCATION COLUMN ALIASES
// ======================================================

const locationAliases = [

    // Box
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

    // Rack
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

    // Rack + Box
    'rack/box',
    'rack box',

    'rack/box location',
    'rack box location',

    'rack_box_location',

    // Storage
    'storage',
    'storage_location',
    'storage location',

    'storage_bin',
    'storage bin',

    'storage_position',
    'storage position',

    'storage_place',
    'storage place',

    // Shelf
    'shelf',
    'shelf_location',
    'shelf location',

    'shelf_no',
    'shelf no',

    'shelf_number',
    'shelf number',

    // Bin
    'bin',
    'bin_location',
    'bin location',

    'bin_no',
    'bin no',

    'bin_number',
    'bin number',

    // Position
    'position',
    'position_code',
    'position code',

    // Location
    'location',
    'location_code',
    'location code',

    'location_name',
    'location name',

    // Cabinet
    'cabinet',
    'cabinet_location',
    'cabinet location',

    // Other common names
    'storage_location_code',
    'storage location code',
    'storage_location_name',
    'storage location name'
];


// ======================================================
// MAIN API
// ======================================================

module.exports = async function handler(req, res) {

    // --------------------------------------------------
    // ONLY POST
    // --------------------------------------------------

    if (req.method !== 'POST') {

        return res.status(405).json({
            message: 'Method not allowed'
        });

    }


    try {

        // ==================================================
        // RECEIVE EXCEL FILE
        // ==================================================

        await handleUpload(
            req,
            res
        );


        if (!req.file) {

            return res.status(400).json({
                message:
                    'Please upload an Excel file'
            });

        }


        console.log(
            'Excel received:',
            req.file.originalname
        );


        // ==================================================
        // READ EXCEL
        // ==================================================

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


        // First worksheet
        const sheetName =
            workbook.SheetNames[0];

        const worksheet =
            workbook.Sheets[sheetName];


        const rows =
            XLSX.utils.sheet_to_json(
                worksheet,
                {
                    defval: '',
                    raw: false
                }
            );


        if (!rows.length) {

            return res.status(400).json({
                message:
                    'Excel file is empty'
            });

        }


        // ==================================================
        // READ HEADERS
        // ==================================================

        const headers =
            Object.keys(rows[0]);


        console.log(
            'Excel columns:',
            headers
        );


        // ==================================================
        // FIND COLUMNS
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

                recognizedCompositionColumn:
                    compositionColumn,

                recognizedLocationColumn:
                    locationColumn,

                supportedBrandColumns: [
                    'brand',
                    'brand_name',
                    'medicine',
                    'medicine_name',
                    'tablet',
                    'tablet_name',
                    'drug',
                    'drug_name',
                    'product',
                    'product_name',
                    'item',
                    'item_name',
                    'name',
                    'Medicine',
                    'Product,Salt'

                ],

                supportedCompositionColumns: [
                    'composition',
                    'salt',
                    'salt_name',
                    'active_ingredient',
                    'ingredient',
                    'generic_name',
                    'Ingredient,Rack'
                    
                ],

                supportedLocationColumns: [
                    'box',
                    'box_location',
                    'rack',
                    'rack_location',
                    'shelf',
                    'bin',
                    'location',
                    'location_code',
                    'storage_location',
                    'position',
                    'Drawer'
                ]

            });

        }


        // ==================================================
        // CREATE TABLE IF NEEDED
        // ==================================================

        await db.execute(`
            CREATE TABLE IF NOT EXISTS medicines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand_name TEXT NOT NULL UNIQUE,
                composition TEXT,
                box_location TEXT NOT NULL
            )
        `);


        // ==================================================
        // GET EXISTING MEDICINES ONCE
        // ==================================================

        const existingResult =
            await db.execute(`
                SELECT brand_name
                FROM medicines
            `);


        // ==================================================
        // CREATE FAST EXISTING-BRAND SET
        // ==================================================

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
        // PROCESS EXCEL
        // ==================================================

        const excelBrands =
            new Set();

        const recordsToInsert =
            [];

        let duplicates = 0;
        let skipped = 0;


        for (const row of rows) {

            // ------------------------------------------------
            // BRAND
            // ------------------------------------------------

            const brandName =
                getValue(
                    row,
                    brandAliases
                );


            // ------------------------------------------------
            // COMPOSITION
            // ------------------------------------------------

            const composition =
                getValue(
                    row,
                    compositionAliases
                );


            // ------------------------------------------------
            // LOCATION
            // ------------------------------------------------

            const boxLocation =
                getValue(
                    row,
                    locationAliases
                );


            // ------------------------------------------------
            // SKIP EMPTY ROW
            // ------------------------------------------------

            if (
                !brandName ||
                !boxLocation
            ) {

                skipped++;

                continue;

            }


            // ------------------------------------------------
            // NORMALIZE BRAND
            // ------------------------------------------------

            const medicineKey =
                brandName
                    .trim()
                    .toLowerCase();


            // ------------------------------------------------
            // DUPLICATE IN SAME EXCEL
            // ------------------------------------------------

            if (
                excelBrands.has(
                    medicineKey
                )
            ) {

                duplicates++;

                continue;

            }


            // ------------------------------------------------
            // DUPLICATE IN TURSO
            // ------------------------------------------------

            if (
                existingBrands.has(
                    medicineKey
                )
            ) {

                duplicates++;

                continue;

            }


            excelBrands.add(
                medicineKey
            );


            // ------------------------------------------------
            // PREPARE INSERT
            // ------------------------------------------------

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
        // BATCH INSERT
        // ==================================================

        if (
            recordsToInsert.length > 0
        ) {

            const statements =
                recordsToInsert.map(
                    record => ({

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
                            record.brand_name,
                            record.composition,
                            record.box_location
                        ]

                    })
                );


            await db.batch(
                statements,
                'write'
            );

        }


        // ==================================================
        // FINAL RESPONSE
        // ==================================================

        return res.status(200).json({

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

};


// ======================================================
// VERCEL CONFIGURATION
// ======================================================

module.exports.config = {
    api: {
        bodyParser: false
    }
};