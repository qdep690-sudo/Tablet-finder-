Smart Pharmacy Box Locator

Install Packages

Run:

npm install

Required packages:

@libsql/client
better-sqlite3
cors
dotenv
express
multer
xlsx

Or install them manually:

npm install @libsql/client better-sqlite3 cors dotenv express multer xlsx

Environment Variables

Create a .env file in the project root:

TURSO_DATABASE_URL=your-turso-database-url
TURSO_AUTH_TOKEN=your-turso-auth-token

Do not commit the .env file to GitHub.

Run the Project

Start the server:

node server.js

Open:

http://localhost:3000