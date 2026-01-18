# Book-Tracker - Full Stack Web Application
A secure, full-stack book tracking application featuring OAuth 2.0 authentication, RESTful CRUD operations, and real-time flash notifications.
## Overview

Book Tracker is a full-stack web application that allows users to track books they have read, store personal notes, and manage their reading history. The application includes secure authentication, third-party OAuth login, full CRUD functionality, and external API integration.

This project started as a simple CRUD application and was later expanded to include authentication, authorization, and production-style backend architecture. It is intended as a portfolio project demonstrating full-stack development skills.

---

## Features

### Authentication and Authorization

* User registration and login using email and password
* Password hashing with bcrypt
* Session-based authentication using Passport.js
* Google OAuth 2.0 login
* Protected routes for authenticated users
* Logout functionality

### Book Management (CRUD)

* Create, read, update, and delete book entries
* Store personal notes, ratings, and reading dates
* Sort books by title, rating, or date read

### External API Integration

* Automatic retrieval of book covers using the Open Library API
* Graceful fallback handling when cover data is unavailable

### Backend and Database

* Node.js and Express.js server
* PostgreSQL database for persistent storage
* SQL queries for data management
* Environment-based configuration using dotenv

### Frontend

* Server-side rendering with EJS templates
* Dynamic views based on authentication state
* User feedback via flash messages

---

## Tech Stack

* **Backend:** Node.js, Express.js
* **Authentication:** Passport.js (Local Strategy, Google OAuth 2.0)
* **Database:** PostgreSQL
* **Frontend:** EJS, CSS
* **Security:** bcrypt, express-session
* **APIs:** Open Library API
* **Other Tools:** Axios, dotenv

---

## Installation and Setup

### Prerequisites

* Node.js
* PostgreSQL

### Steps

Clone the repository:

```bash
git clone https://github.com/Neda-Alipour/book-tracker.git
cd book-tracker
```

Install dependencies:

```bash
npm install
```

Create a `.env` file in the root directory and add the following variables:

```env
PG_USER=your_db_user
PG_HOST=localhost
PG_DATABASE=your_db_name
PG_PASSWORD=your_db_password
PG_PORT=5432
SESSION_SECRET=your_session_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Run the application:

```bash
nodemon index.js
```

The application will be available at:

```
http://localhost:3000
```

---

## Project Background

This project is an extended and improved version of an earlier CRUD-only application originally built as part of a web development course. The current version focuses on real-world backend concerns such as authentication, authorization, database persistence, and third-party API integration.

---

## Possible Improvements

* Associate books strictly with individual users
* Add pagination and search functionality
* Improve UI and responsiveness
* Add automated tests
* Deploy to a cloud platform

---

## Author

Developed by Neda Alipour
