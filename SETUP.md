# ZELVORA Setup Guide (Windows)

Follow the steps in order. Each step says what you should see when it works.

## 1. Install the required software

1. **Python 3.10 or newer**: https://www.python.org/downloads/
   During install, tick **"Add python.exe to PATH"**.
2. **Node.js (LTS)**: https://nodejs.org/ (this also installs `npm`).
3. **MySQL Community Server 8.0 or newer** and **MySQL Workbench**: https://dev.mysql.com/downloads/installer/
   During setup you choose a password for the `root` user. **Write it down.**
4. **VS Code** (optional but recommended): https://code.visualstudio.com/

Check in a new Command Prompt:

```
python --version
node --version
npm --version
```

## 2. Create the MySQL database

1. Open **MySQL Command Line Client** from the Start menu and enter your root password.
2. Run these two lines (change the folder to where you saved the project):

```
source C:/Users/YourName/Vehicle-Rental-Management-System/database/database.sql
source C:/Users/YourName/Vehicle-Rental-Management-System/database/sample_data.sql
```

Use forward slashes `/` in the path. Then check:

```
USE zelvora_db;
SELECT name, category FROM vehicles;
```

You should see 12 vehicles.

(Using MySQL Workbench instead? Open each `.sql` file and click the lightning-bolt button.)

## 3. Configure database credentials

1. Open the `backend` folder.
2. Copy `.env.example` and name the copy `.env`.
3. Open `.env` and change `ZELVORA_DB_PASSWORD` to your MySQL root password.

The `.env` file stays on your computer. Git ignores it, and the browser never sees it.

## 4. Install Python dependencies

```
cd Vehicle-Rental-Management-System\backend
pip install -r requirements.txt
```

## 5. Start the Python backend

```
python server.py
```

You should see:

```
MySQL connection OK.
ZELVORA API running at http://127.0.0.1:8000
```

Leave this window open.

## 6. Install the frontend dependencies

Open a **second** Command Prompt:

```
cd Vehicle-Rental-Management-System\frontend
npm install
```

## 7. Start React

```
npm run dev
```

## 8. Open the application

Go to **http://localhost:5173** in your browser. The ZELVORA homepage should show real vehicles.

## 9. Create the local admin account

In a third Command Prompt (the backend does not need to be stopped):

```
cd Vehicle-Rental-Management-System\backend
python create_admin.py
```

Type a name, email, phone and password (the password is hidden while you type). Then log in on the
website with that email and password. You will be taken to the admin area.

Customers register themselves on the **Create account** page.

## 10. Optional: run the automated tests

With the backend running:

```
cd backend
python test_api.py
```

It creates temporary test data, checks 78 things (login, bookings, double-booking protection, admin
permissions, revenue and more) and deletes the test data afterwards.

## 11. Troubleshooting

| Problem | What to do |
|---|---|
| `Could not connect to MySQL` | Make sure MySQL is running (Windows Services, "MySQL80"), and check the password in `backend\.env`. |
| `Access denied for user 'root'` | The password in `.env` is wrong. |
| `Unknown database 'zelvora_db'` | Step 2 was not done. Run `database.sql` again. |
| `ModuleNotFoundError: mysql` | Run `pip install -r requirements.txt` in the `backend` folder. |
| `python` is not recognized | Reinstall Python and tick "Add python.exe to PATH". Then open a new Command Prompt. |
| Website says "Cannot reach the server" | The backend is not running. Start it with `python server.py`. |
| Port 8000 already in use | Close other programs using it, or set `ZELVORA_API_PORT=8001` in `.env` and change the port in `frontend/vite.config.js`. |
| Port 5173 busy | Vite will offer another port. Use the address it prints. |
| Everyone got logged out | The backend was restarted. Sessions live in memory, so log in again. |
| Fonts look plain | The fonts load from Google Fonts. Without internet, a fallback font is used. |
| Want to start over | In MySQL run `DROP DATABASE zelvora_db;` then repeat step 2. |
