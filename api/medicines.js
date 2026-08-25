const { createClient } = require('@libsql/client');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function initDatabase() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS medicines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand_name TEXT NOT NULL UNIQUE,
            composition TEXT,
            box_location TEXT NOT NULL
        )
    `);
}

module.exports = async (req, res) => {

    try {

        await initDatabase();

        // ==========================================================
        // GET ALL MEDICINES
        // ==========================================================

        if (req.method === 'GET') {

            const result = await db.execute(`
                SELECT
                    id,
                    brand_name,
                    composition,
                    box_location
                FROM medicines
                ORDER BY brand_name ASC
            `);

            // Convert BigInt values if returned by Turso
            const medicines = result.rows.map(row => ({
                id: Number(row.id),
                brand_name: row.brand_name,
                composition: row.composition || '',
                box_location: row.box_location
            }));

            return res.status(200).json(medicines);
        }


        // ==========================================================
        // ADD MEDICINE
        // ==========================================================

        if (req.method === 'POST') {

            const {
                brand_name,
                composition,
                box_location
            } = req.body || {};


            // ------------------------------------------------------
            // VALIDATION
            // ------------------------------------------------------

            if (!brand_name || !box_location) {

                return res.status(400).json({
                    message:
                        'Brand name and box location are required'
                });

            }


            // ------------------------------------------------------
            // CLEAN DATA
            // ------------------------------------------------------

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


            // ------------------------------------------------------
            // CHECK DUPLICATE
            // ------------------------------------------------------

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


            if (existing.rows.length > 0) {

                return res.status(409).json({
                    message:
                        'Medicine already exists'
                });

            }


            // ------------------------------------------------------
            // INSERT INTO TURSO
            // ------------------------------------------------------

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


            // ------------------------------------------------------
            // RESPONSE
            // IMPORTANT:
            // Turso can return lastInsertRowid as BigInt.
            // Convert it to Number before JSON response.
            // ------------------------------------------------------

            return res.status(200).json({
                id: Number(result.lastInsertRowid),
                message:
                    'Medicine added successfully'
            });

        }


        // ==========================================================
        // OTHER METHODS
        // ==========================================================

        return res.status(405).json({
            message: 'Method not allowed'
        });


    } catch (error) {

        console.error(
            'Turso database error:',
            error
        );

        return res.status(500).json({
            message:
                'Database error',
            error:
                error.message
        });

    }

};