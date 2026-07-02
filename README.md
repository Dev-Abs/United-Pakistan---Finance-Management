# United Pakistan - Finance Management

A lightweight, full-stack web application for managing the monthly finances of the United Pakistan political party. Replaces manual Excel + WhatsApp operations with a clean admin panel backed by Google Sheets via Google Apps Script.

## Features
- **Dashboard**: High-level stats, recent payments, and quick actions.
- **Member Management**: Add, edit, delete, and search members.
- **Payment Tracking**: Mark payments, handle partial payments, and auto-calculate remaining balances.
- **Reminders**: One-click WhatsApp link generation and bulk copy features.
- **Monthly Rollover**: Create a new month sheet carrying over pending balances with a single click.
- **Export**: Download records in CSV, Excel, or PDF format.

## Architecture
```
Browser (HTML/CSS/Vanilla JS)
        ↓  REST calls
Express.js Server (Node.js, hosted on Vercel as serverless functions)
        ↓  HTTPS POST/GET
Google Apps Script Web App (acts as thin sheet API)
        ↓
Google Sheets (one tab per month, acts as database)
```

## Setup & Deployment Guide

### 1. Google Sheets & Apps Script Setup
1. Create a new Google Spreadsheet.
2. Go to `Extensions > Apps Script`.
3. Copy the contents of `apps-script/Code.gs` from this project and paste it into the editor.
4. Click **Deploy > New deployment**.
5. Select **Web app**.
6. Set **Execute as**: `Me` and **Who has access**: `Anyone`.
7. Click Deploy, authorize the app, and copy the **Web app URL**.
8. In the Apps Script code, note the `SECRET` variable (`unitedpakistan2026` by default). You can change this, but make sure it matches the `.env` file later.

### 2. GitHub Setup
1. Initialize a git repository in this project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
2. Push the code to a new GitHub repository.

### 3. Vercel Deployment
1. Go to [Vercel](https://vercel.com/) and import your new GitHub repository.
2. Add the following Environment Variables in the Vercel dashboard:
   - `ADMIN_USERNAME`: admin
   - `ADMIN_PASSWORD`: (choose a secure password)
   - `SESSION_SECRET`: (any random long string)
   - `APPS_SCRIPT_URL`: (the URL you copied in step 1.7)
   - `APPS_SCRIPT_SECRET`: unitedpakistan2026 (or whatever you set in Code.gs)
3. Click **Deploy**. Vercel will automatically detect `vercel.json` and host your Express API as serverless functions and your frontend as static files.

### 4. Running Locally
If you want to run the project on your own machine:
1. Ensure Node.js (v18+) is installed.
2. Run `npm install` in the project root.
3. Rename `.env.example` to `.env` and fill in the required variables (especially `APPS_SCRIPT_URL`).
4. Run `npm start`.
5. Open `http://localhost:3000` in your browser.

## Project Structure
- `/apps-script/` - Google Apps Script code to paste into Google Sheets.
- `/public/` - Vanilla HTML, CSS, and JS for the frontend. No build step required.
- `/server/` - Express server acting as the API layer and Vercel serverless entry points.

## Settings
You can update your Organization Name, Secretary Name, Easypaisa details, etc., directly from the **Settings** page in the web app. These details are used to dynamically generate the WhatsApp reminder templates.
