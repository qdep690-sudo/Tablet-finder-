# Smart Pharmacy Box Locator

A simple medicine inventory application for finding tablets and their box locations.

## Features

- Search medicine by brand name
- Search medicine by composition / salt
- Add medicine manually
- Detect duplicate medicines
- Validate box locations such as `A1` and `B12`
- Import medicine data from Excel
- Store production data in Turso
- Local development with Node.js and Express
- Vercel API support

## Required Software

Install these before running the project:

- Node.js
- npm
- Git (for GitHub/version control)

Check installation:

```bash
node --version
npm --version
git --version
```

## Required Node.js Packages

Install all project packages with:

```bash
npm install
```

The project requires:

```text
@libsql/client
better-sqlite3
cors
dotenv
express
multer
xlsx
```

If installing them manually:

```bash
npm install @libsql/client better-sqlite3 cors dotenv express multer xlsx
```

## Project Structure

```text
Tablet-finder-
├── api/
│   ├── medicines.js
│   └── upload.js
├── index.html
├── script.js
├── package.json
├── package-lock.json
├── server.js
├── .gitignore
└── .env
```

## Environment Variables

Create a `.env` file in the project root:

```env
TURSO_DATABASE_URL=your-turso-database-url
TURSO_AUTH_TOKEN=your-turso-auth-token
```

Do not upload `.env` to GitHub.

## Run Locally

Install packages:

```bash
npm install
```

Start the server:

```bash
node server.js
```

Open:

```text
http://localhost:3000
```

## Main API Routes

### Local

```text
GET  /medicines
POST /medicines
POST /medicines/upload
```

### Vercel

```text
GET  /api/medicines
POST /api/medicines
POST /api/upload
```

## Excel Import

The application accepts Excel files containing medicine/brand, composition, and box/rack/location information.

Example columns:

```text
brand_name
composition
box_location
```

## Git

Check changes:

```bash
git status
```

Stage changes:

```bash
git add .
```

Commit:

```bash
git commit -m "Update project"
```

Push:

```bash
git push
```

## Important

- Keep the Turso authentication token private.
- Do not commit `.env`.
- `server.js` is used for local development.
- The `api` folder contains the Vercel API functions.
