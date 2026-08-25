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

function normalizeHeader(header) {
    return String(header || '')
        .toLowerCase()
        .trim()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '');
}

function findColumn(row, aliases) {
    const keys = Object.keys(row);
    const normalizedAliases = aliases.map(normalizeHeader);

    for (const key of keys) {
        if (normalizedAliases.includes(normalizeHeader(key))) {
            return key;
        }
    }

    return null;
}

function getValue(row, aliases) {
    const column = findColumn(row, aliases);

    if (!column) return '';

    return String(row[column] ?? '').trim();
}

// Convert multer callback middleware to Promise
function runMulter(req, res) {
    return new Promise((resolve, reject) => {
        upload.single('file')(req, res, (error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

module.exports = async (req, res) => {

    if (req.method !== 'POST') {
        return res.status(405).json({
            message: 'Method not allowed'
        });
    }

    try {

        await runMulter(req, res);

        if (!req.file) {
            return res.status(400).json({
                message: 'Please upload an Excel file'
            });
        }

        // Read Excel
        const workbook = XLSX.read(req.file.buffer, {
            type: 'buffer'
        });

        if (!workbook.SheetNames?.length) {
            return res.status(400).json({
                message: 'Excel file does not contain a worksheet'
            });
        }

        const worksheet =
            workbook.Sheets[workbook.SheetNames[0]];

        const rows = XLSX.utils.sheet_to_json(
            worksheet,
            { defval: '' }
        );

        if (rows.length === 0) {
            return res.status(400).json({
                message: 'Excel file is empty'
            });
        }

        // Column aliases
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

        const brandColumn =
            findColumn(rows[0], brandAliases);

        const compositionColumn =
            findColumn(rows[0], compositionAliases);

        const locationColumn =
            findColumn(rows[0], locationAliases);

        if (!brandColumn || !locationColumn) {
            return res.status(400).json({
                message:
                    'Could not recognize medicine/brand and box/rack/location columns.',

                detectedColumns:
                    Object.keys(rows[0]),

                recognizedBrandColumn:
                    brandColumn,

                recognizedCompositionColumn:
                    compositionColumn,

                recognizedLocationColumn:
                    locationColumn
            });
        }

        // Make sure table exists in Turso
        await db.execute(`
            CREATE TABLE IF NOT EXISTS medicines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand_name TEXT NOT NULL UNIQUE,
                composition TEXT,
                box_location TEXT NOT NULL
            )
        `);

        let added = 0;
        let duplicates = 0;
        let skipped = 0;

        const excelMedicines = new Set();

        for (const row of rows) {

            const brandName =
                getValue(row, brandAliases);

            const composition =
                getValue(row, compositionAliases);

            const boxLocation =
                getValue(row, locationAliases);

            if (!brandName || !boxLocation) {
                skipped++;
                continue;
            }

            const medicineKey =
                brandName.trim().toLowerCase();

            if (excelMedicines.has(medicineKey)) {
                duplicates++;
                continue;
            }

            excelMedicines.add(medicineKey);

            const existing = await db.execute({
                sql: `
                    SELECT id
                    FROM medicines
                    WHERE LOWER(TRIM(brand_name))
                    = LOWER(TRIM(?))
                `,
                args: [brandName]
            });

            if (existing.rows.length > 0) {
                duplicates++;
                continue;
            }

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
                    boxLocation.trim().toUpperCase()
                ]
            });

            added++;
        }

        return res.status(200).json({
            message: 'Excel processed successfully',
            added,
            duplicatesIgnored: duplicates,
            skipped
        });

    } catch (error) {

        console.error('Excel upload error:', error);

        return res.status(500).json({
            message: 'Error processing Excel file',
            error: error.message
        });
    }
};

// Required because multer handles the request body itself
module.exports.config = {
    api: {
        bodyParser: false
    }
};