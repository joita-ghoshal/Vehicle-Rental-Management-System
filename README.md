# 🚗 ZELVORA — Vehicle Rental Management System

### *Every Ride, A New Story.*

**ZELVORA** is a full-stack Vehicle Rental Management System developed as an academic college project using **React.js, Python, and MySQL**.

The application is designed to simplify vehicle rental operations by providing an easy-to-use platform where customers can explore, search, and book vehicles, while administrators can manage vehicles, customers, and rental bookings through a centralized dashboard.

ZELVORA combines practical functionality with a modern, elegant, and responsive user interface.

---

## 📌 Project Information

| Details | Information |
|---|---|
| **Project Name** | ZELVORA |
| **Project Title** | Vehicle Rental Management System |
| **Project Type** | Full-Stack Web Application |
| **Project Category** | Academic / College Project |
| **Institution** | Brainware University |
| **Department** | Computer Science and Engineering |
| **Group** | Group 8 |
| **Project Lead** | Joita Ghoshal |
| **Development Approach** | Modular and Phase-Wise Development |
| **Project Status** | ✅ Completed |

---

## 👥 Contributors & Development Team

**Group 8 — Brainware University**

| Name | Student Code |
|---|---|
| **Joita Ghoshal (Project Lead & Developer)** | BWU/BTS/25/029 |
| Soumili Biswas | BWU/BTS/25/057 |
| Umme Hani | BWU/BTS/25/050 |
| Ambiya Shah | BWU/BTS/25/514 |
| Prarthi Priya | BWU/BTS/25/518 |

---

## 🎯 Project Objectives

The main objectives of ZELVORA are:

1. To develop a simple and efficient online vehicle rental management platform.
2. To allow customers to explore and book vehicles conveniently.
3. To provide an organized system for managing rental bookings.
4. To prevent conflicting confirmed vehicle reservations.
5. To simplify vehicle and customer management for administrators.
6. To maintain rental information securely in a MySQL database.
7. To demonstrate frontend, backend, API, and database integration.
8. To build a visually appealing and responsive web application using beginner-friendly technologies.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React.js, Vite, HTML (JSX), CSS, JavaScript |
| **Backend** | Python 3, Built-in HTTP Server |
| **Database** | MySQL 8.0 |
| **Database Connector** | mysql-connector-python |
| **Development Tools** | Visual Studio Code, MySQL Workbench |
| **Version Control** | Git & GitHub |
| **Package Managers** | npm, pip |

The project uses Core Python for backend API development without Flask, Django, or FastAPI.

---

## ✨ Features

ZELVORA provides a complete vehicle rental management experience through two dedicated modules: Customer and Administrator.

### 👤 Customer Module

- Customer Registration and Login
- Secure Password Storage
- Customer Dashboard
- Browse Cars, Bikes, and Scooters
- Search Vehicles by Name or Brand
- Filter Vehicles by Category and Price
- View Vehicle Details and Rental Charges
- Check Vehicle Availability
- Select Pickup and Return Dates
- Calculate Total Rental Amount
- Submit Vehicle Booking Requests
- View Booking History
- Track Booking Status
- Cancel Eligible Bookings
- View and Update Customer Profile
- Secure Logout

### 🛡️ Admin Module

- Admin Authentication
- Admin Dashboard
- View Total Vehicles, Customers, and Bookings
- Add New Vehicles
- Edit Existing Vehicle Details
- Archive Vehicles
- Manage Vehicle Availability Status
- View Registered Customers
- View All Rental Bookings
- Approve or Reject Booking Requests
- Mark Completed Rentals
- Update Manual Payment Status
- View Completed Rental Revenue

### 🚘 Supported Vehicle Categories

| Category | Description |
|---|---|
| 🚗 Car | Cars available for daily rental |
| 🏍️ Bike | Motorcycles available for daily rental |
| 🛵 Scooter | Scooters available for daily rental |

---

## 🎨 User Interface & Design

ZELVORA features a custom-designed interface with an elegant **Dusty Rose & Deep Plum** visual identity.

### Official Color Palette

| Color | HEX Code | Usage |
|---|---|---|
| Dusty Rose | `#B65D79` | Primary Buttons and Highlights |
| Deep Plum | `#38283F` | Navbar and Headings |
| Warm Ivory | `#F5EFE7` | Main Background |
| Soft Sand | `#E8D8CC` | Cards and Sections |
| Muted Orchid | `#66546C` | Secondary Elements |
| White | `#FFFFFF` | Forms and Inputs |
| Forest Green | `#287A52` | Success Messages |
| Crimson Red | `#C43D48` | Error Messages |
| Amber | `#A56617` | Warning Messages |

### Design Highlights

- Premium and Modern User Interface
- Fully Responsive Layout
- Custom ZELVORA Branding
- Elegant Vehicle Cards
- Clean Navigation
- Interactive Forms
- User-Friendly Dashboards
- Smooth CSS Transitions
- Consistent Typography and Spacing

---

## 🏗️ Project Architecture

ZELVORA follows a simple three-layer architecture:

```text
                 ZELVORA
                     |
                     v
             React.js Frontend
                     |
                     | HTTP Requests
                     v
              Python API Server
                     |
                     | MySQL Connector
                     v
               MySQL Database
                     |
                     | Query Results
                     v
              Python API Server
                     |
                     | JSON Responses
                     v
              React.js Frontend
```

The frontend handles user interaction, the backend processes application logic, and MySQL stores user, vehicle, and booking information.

### Architecture Components

**Frontend Layer**

- User Interface
- Page Navigation
- Form Handling
- Vehicle Listings
- Customer Dashboard
- Admin Dashboard

**Backend Layer**

- Authentication
- API Request Processing
- Business Logic
- Rental Calculations
- Booking Validation
- Database Operations

**Database Layer**

- Customer Information
- Vehicle Records
- Booking Details
- Payment Status
- Rental History

---

## 📂 Project Folder Structure

```text
Vehicle-Rental-Management-System/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── admin/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   └── package.json
│
├── backend/
│   ├── server.py
│   ├── database.py
│   ├── auth.py
│   ├── vehicles.py
│   ├── bookings.py
│   ├── admin.py
│   ├── create_admin.py
│   └── requirements.txt
│
├── database/
│   ├── database.sql
│   └── sample_data.sql
│
├── README.md
├── SETUP.md
└── .gitignore
```

*The structure above represents the project's intended organization. Individual filenames should be checked against the final source code.*

---

## 🗄️ Database Design

ZELVORA uses MySQL for managing and storing application data.

The database is organized around three primary tables.

| Table | Purpose |
|---|---|
| `users` | Stores customer and administrator account information |
| `vehicles` | Stores vehicle details, pricing, and availability status |
| `bookings` | Stores rental reservations, dates, amounts, and booking statuses |

### Database Relationships

- One user can create multiple bookings.
- One vehicle can have multiple bookings across different dates.
- Each booking belongs to one customer and one vehicle.
- Confirmed bookings for the same vehicle cannot overlap.

### Database Operations

The system uses database operations for:

- Customer Registration
- User Authentication
- Vehicle Information Retrieval
- Vehicle Management
- Booking Creation
- Booking Status Updates
- Customer Booking History
- Dashboard Statistics
- Rental Revenue Calculation

MySQL primary keys and foreign keys help maintain relationships between the tables.

---

## 🚀 Development Setup, Installation & System Integration

ZELVORA follows a three-layer full-stack architecture consisting of a React.js frontend, a Python backend API, and a MySQL relational database.

The following sections describe the development environment, project configuration, database integration, API communication, local execution, and GitHub version control workflow.

### 1. Development Environment

The project uses the following development tools and technologies:

- **Visual Studio Code:** Source code editing and project management.
- **Node.js and npm:** Frontend dependency management.
- **React.js and Vite:** Frontend application development.
- **Python 3:** Backend API development.
- **MySQL Server 8.0:** Relational database management.
- **MySQL Workbench:** Database creation and SQL query execution.
- **Git:** Local version control.
- **GitHub:** Remote repository hosting and collaboration.

### 2. Project Directory Setup

The project is organized into separate frontend, backend, and database directories.

```text
Vehicle-Rental-Management-System/
├── frontend/
├── backend/
├── database/
├── README.md
├── SETUP.md
├── step.md
└── .gitignore
```

This structure separates the user interface, application logic, and database operations, making the codebase easier to understand and maintain.

### 3. Frontend Configuration

The frontend is developed using React.js with Vite, JavaScript, JSX, and plain CSS.

The React application manages page navigation, user interactions, vehicle displays, booking forms, customer dashboards, and administrator interfaces.

Frontend dependencies are installed using:

```bash
cd frontend
npm install
```

The development server is started using:

```bash
npm run dev
```

The default Vite development URL is:

```text
http://localhost:5173
```

### 4. MySQL Database Configuration

The database stores application information, including customer accounts, vehicle records, booking details, rental charges, and booking statuses.

Database initialization is performed using the SQL scripts provided in the `database` directory.

**Database initialization:**

1. Start MySQL Server.
2. Open MySQL Workbench.
3. Connect to the local MySQL instance.
4. Execute `database/database.sql` to create the database structure.
5. Execute `database/sample_data.sql` to insert demonstration vehicle records.
6. Verify that the required tables and relationships are available.

The primary database tables are:

- `users`
- `vehicles`
- `bookings`

MySQL primary keys and foreign keys maintain relationships between customer accounts, vehicles, and rental bookings.

### 5. Python Backend Configuration

The backend is developed using Core Python and Python's built-in HTTP server.

It handles:

- Authentication
- Vehicle Information Retrieval
- Booking Requests
- Rental Calculations
- Availability Validation
- Administrator Operations
- Database Communication
- JSON API Responses

Backend dependencies are installed using:

```bash
cd backend
python -m pip install -r requirements.txt
```

The backend requires valid MySQL connection settings, including:

- Database Host
- Database Port
- Database Username
- Database Password
- Database Name

Database credentials must remain outside publicly committed source files.

The Python backend is started using:

```bash
python server.py
```

### 6. Python and MySQL Integration

The Python backend communicates with MySQL using the `mysql-connector-python` library.

The database connection layer is responsible for establishing connections, executing parameterized SQL queries, retrieving records, and saving changes.

**Database communication flow:**

```text
Python Backend
      |
      v
MySQL Connector
      |
      v
MySQL Database
      |
      v
Query Results
      |
      v
Python API Response
```

Database operations include:

- Inserting registered customers.
- Retrieving vehicle information.
- Saving rental bookings.
- Updating booking statuses.
- Modifying vehicle records.
- Retrieving dashboard statistics.

Parameterized SQL queries are used for database operations to reduce SQL injection risks.

### 7. React Frontend and Python API Integration

The React frontend communicates with the Python backend through HTTP requests.

The backend processes requests, interacts with MySQL when necessary, and returns JSON responses.

**Application communication flow:**

```text
React Frontend
      |
      | HTTP Request
      v
Python API Server
      |
      | SQL Query
      v
MySQL Database
      |
      | Query Result
      v
Python Backend
      |
      | JSON Response
      v
React Frontend
```

The integration supports operations such as:

- Customer Registration and Login
- Retrieving Vehicle Listings
- Searching and Filtering Vehicles
- Checking Booking Availability
- Submitting Rental Bookings
- Retrieving Customer Booking History
- Managing Vehicles and Bookings through the Admin Dashboard

The frontend and backend are maintained as separate application layers.

During local development, the frontend can communicate with the backend through the configured Vite development proxy.

### 8. Authentication and Role-Based Access

The application supports two user roles:

**Customer:** Access to vehicle browsing, rental bookings, booking history, and profile management.

**Administrator:** Access to dashboard statistics, vehicle management, customer records, and booking administration.

Authentication and authorization checks are handled by the backend.

Passwords are stored as secure hashes rather than plain text.

Protected operations require valid authentication and appropriate user permissions.

### 9. Vehicle Booking and Database Operations

The booking system connects frontend forms with backend validation and MySQL records.

The booking process includes:

1. Selecting a vehicle.
2. Choosing pickup and return dates.
3. Validating the selected dates.
4. Checking vehicle availability.
5. Calculating the total rental charge.
6. Submitting the booking request.
7. Saving the booking in MySQL.
8. Displaying the booking status.
9. Processing approval or rejection through the Admin Dashboard.

The backend validates booking information before modifying database records.

Overlapping confirmed bookings are prevented through backend availability checks and database transaction handling.

### 10. Running the Complete Application

To run ZELVORA locally, three components must be available:

**Step 1 — Start MySQL**

Ensure that MySQL Server is running and the application database is initialized.

**Step 2 — Start the Python Backend**

Open a terminal:

```bash
cd backend
python server.py
```

**Step 3 — Start the React Frontend**

Open a separate terminal:

```bash
cd frontend
npm run dev
```

**Step 4 — Open the Application**

Open the local development URL displayed by Vite, usually:

```text
http://localhost:5173
```

The React application sends API requests to the Python backend, which processes application logic and communicates with MySQL.

### 11. Git and GitHub Version Control

Git is used to manage source code changes, while GitHub provides a remote repository for maintaining the project.

**Initialize Git:**

```bash
git init
```

**Stage project files:**

```bash
git add .
```

**Create the initial commit:**

```bash
git commit -m "Initial commit - ZELVORA Vehicle Rental Management System"
```

**Set the main branch:**

```bash
git branch -M main
```

**Connect the GitHub repository:**

```bash
git remote add origin <repository-url>
```

**Push the project:**

```bash
git push -u origin main
```

For subsequent updates:

```bash
git add .
git commit -m "Update ZELVORA project"
git push
```

The `.gitignore` file excludes unnecessary local files, installed dependencies, environment files, and sensitive credentials from version control.

### 12. Project Testing and Verification

The application can be verified through functional testing of its major modules.

**Frontend Verification**
- Page Navigation
- Responsive Layouts
- Vehicle Cards
- Forms and Validation
- Customer and Admin Interfaces

**Backend Verification**
- API Request Handling
- Authentication
- Input Validation
- Vehicle CRUD Operations
- Booking Status Updates

**Database Verification**
- Database Connectivity
- Customer Record Storage
- Vehicle Record Retrieval
- Booking Persistence
- Foreign Key Relationships

**Integration Verification**
- React-to-Python Communication
- Python-to-MySQL Communication
- Customer Booking Workflow
- Admin Booking Management
- Dashboard Data Retrieval

### 13. Local Development Notes

ZELVORA uses Python's built-in HTTP server for backend API handling.

This architecture is suitable for local academic demonstrations and educational development.

For public production deployment, additional server infrastructure, HTTPS, stronger security controls, and deployment configuration would be required.

For environment-specific configuration and troubleshooting, refer to `SETUP.md`.

---

## 🔄 Vehicle Booking Workflow

1. Customer registers or logs in.
2. Customer explores available vehicles.
3. Customer selects a vehicle.
4. Customer chooses pickup and return dates.
5. The system calculates the total rental price.
6. Customer submits a booking request.
7. Admin reviews the pending request.
8. The system checks vehicle availability before approval.
9. Admin approves or rejects the booking.
10. The customer can view the updated booking status.
11. After the rental is returned, Admin marks the booking as completed.

### Booking Statuses

- **Pending:** Waiting for administrator approval.
- **Confirmed:** Booking approved.
- **Rejected:** Booking request declined.
- **Cancelled:** Booking cancelled.
- **Completed:** Rental successfully completed.

---

## 💳 Payment System

ZELVORA uses a simple manual payment approach.

**Payment Method: Pay at Pickup**

No real online payment gateway is integrated.

Administrators can update payment status after receiving payment.

This keeps the project simple and suitable for academic demonstration.

---

## 🧪 Testing & Validation

The project covers the following testing areas:

- Customer Registration and Login
- Authentication and Access Control
- Vehicle Search and Filters
- Vehicle Management
- Booking Creation
- Rental Price Calculation
- Booking Availability Validation
- Booking Approval and Cancellation
- MySQL Data Persistence
- Frontend and Backend API Integration
- Responsive Design
- Form Validation and Error Handling

---

## 📋 Development Roadmap & Project Documentation

ZELVORA was organized using a structured, phase-wise development approach.

The development roadmap and implementation records are maintained in:

**[`step.md`](step.md)**

The documentation includes:

- Development Phases and Objectives
- Implementation Tasks
- Frontend and Backend Integration Milestones
- Database Development Activities
- Testing and Verification Requirements
- Technical Decisions
- Completed Tasks and Progress Records

**Project Status: Completed**

The roadmap serves as a reference for the project's development process, technical organization, and implementation history.

---

## 🔐 Security Considerations

The project includes basic security practices such as:

- Password Hashing
- Input Validation
- Parameterized SQL Queries
- Role-Based Access Control
- Backend Authorization Checks
- Session Management
- Restricted Admin Operations

The application uses Python's built-in HTTP server for local academic demonstration.

It is **not intended for production deployment** without additional security hardening, HTTPS configuration, and a production-grade server.

---

## 🔮 Future Enhancements

Possible future improvements include:

- Online Payment Gateway Integration
- Email Booking Notifications
- Customer Reviews and Ratings
- Advanced Rental Reports
- Vehicle Image Uploads
- Invoice Generation
- Automated Booking Reminders
- Public Deployment with Production-Grade Backend Infrastructure

These are future possibilities and are not part of the current project scope.

---

## 🎓 Academic Purpose

ZELVORA is developed as a college-level software project to demonstrate practical knowledge of:

- Full-Stack Web Development
- React.js Frontend Development
- Python Backend Programming
- REST-Style API Development
- MySQL Database Management
- CRUD Operations
- User Authentication
- Booking Management Logic
- Responsive UI/UX Design
- Software Testing
- Team Collaboration
- Project Documentation

**Institution:** Brainware University  
**Department:** Computer Science and Engineering  
**Group:** Group 8  
**Project Lead:** Joita Ghoshal

---

## 📬 Contact & Contributions

For project-related discussions, suggestions, and contributions, contact the development team through the GitHub repository.

**Project Lead:** Joita Ghoshal  
**GitHub:** [github.com/joita-ghoshal](https://github.com/joita-ghoshal)

The development team consists of five members from Group 8, Department of Computer Science and Engineering, Brainware University.

---

## 📄 License

This project is developed for educational and academic purposes.

No open-source license has been assigned yet. Reuse and redistribution permissions will be determined by the project team.

---

### 🚗 ZELVORA

**Every Ride, A New Story.**

*Designed with Creativity. Developed with Dedication.*

**A Full-Stack Academic Project | Brainware University**