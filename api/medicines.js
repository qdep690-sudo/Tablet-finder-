const { createClient } = require('@libsql/client');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});


// ==========================================================
// DATABASE INITIALIZATION
// ==========================================================

let databaseInitialized = false;

async function initDatabase() {

    if (databaseInitialized) {
        return;
    }

    // ------------------------------------------------------
    // CREATE TABLE
    // ------------------------------------------------------

    await db.execute(`
        CREATE TABLE IF NOT EXISTS medicines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand_name TEXT NOT NULL UNIQUE,
            composition TEXT,
            box_location TEXT NOT NULL
        )
    `);


    // ------------------------------------------------------
    // INDEXES
    // ------------------------------------------------------

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
    console.log('Medicines table and indexes ready.');
}


// ==========================================================
// CONVERT TURSO ROWS
// ==========================================================

function formatMedicine(row) {

    return {
        id: Number(row.id),
        brand_name: row.brand_name || '',
        composition: row.composition || '',
        box_location: row.box_location || ''
    };

}


// ==========================================================
// API HANDLER
// ==========================================================

module.exports = async (req, res) => {

    try {

        await initDatabase();


        // ==================================================
        // GET MEDICINES
        // ==================================================

        if (req.method === 'GET') {

            const search =
                String(
                    req.query.search || ''
                )
                    .trim()
                    .toLowerCase();


            // ------------------------------------------------
            // SEARCH MODE
            // ------------------------------------------------

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
                                LOWER(brand_name)
                                LIKE ?

                                OR

                                LOWER(composition)
                                LIKE ?

                            ORDER BY
                                brand_name ASC

                            LIMIT 50
                        `,

                        args: [
                            searchPattern,
                            searchPattern
                        ]

                    });


                const medicines =
                    result.rows.map(
                        formatMedicine
                    );


                return res.status(200).json(
                    medicines
                );

            }


            // ------------------------------------------------
            // NORMAL GET
            // ------------------------------------------------

            const result =
                await db.execute(`
                    SELECT
                        id,
                        brand_name,
                        composition,
                        box_location
                    FROM medicines
                    ORDER BY brand_name ASC
                    LIMIT 100
                `);


            const medicines =
                result.rows.map(
                    formatMedicine
                );


            return res.status(200).json(
                medicines
            );

        }


        // ==================================================
        // ADD MEDICINE
        // ==================================================

        if (req.method === 'POST') {

            const {
                brand_name,
                composition,
                box_location
            } = req.body || {};


            // ------------------------------------------------
            // VALIDATION
            // ------------------------------------------------

            if (
                !brand_name ||
                !box_location
            ) {

                return res.status(400).json({

                    message:
                        'Brand name and box location are required'

                });

            }


            // ------------------------------------------------
            // CLEAN DATA
            // ------------------------------------------------

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


            // ------------------------------------------------
            // BOX LOCATION VALIDATION
            // ------------------------------------------------

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


            // ------------------------------------------------
            // CHECK DUPLICATE
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


            // ------------------------------------------------
            // INSERT
            // ------------------------------------------------

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


            // ------------------------------------------------
            // BIGINT FIX
            // ------------------------------------------------

            return res.status(200).json({

                id:
                    Number(
                        result.lastInsertRowid
                    ),

                message:
                    'Medicine added successfully'

            });

        }


        // ==================================================
        // METHOD NOT ALLOWED
        // ==================================================

        return res.status(405).json({

            message:
                'Method not allowed'

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