# 🏡 Airbnb DBMS Project

A full-stack Airbnb-style property booking system built using **Node.js, PostgreSQL, and Vanilla JavaScript**.
This project allows users to browse properties, make bookings, leave reviews, and enables hosts to manage their listings.

---

## 🚀 Features

### 👤 User Features

* Register & Login (JWT Authentication)
* Browse available properties
* Book properties with check-in/check-out dates
* View booking history
* Leave reviews & ratings
* View reviews for each property

### 🏠 Host Features

* Add new properties
* View and manage listed properties
* Delete properties
* View reviews for their properties

---

## 🛠 Tech Stack

* **Frontend:** HTML, CSS, JavaScript
* **Backend:** Node.js, Express.js
* **Database:** PostgreSQL (Neon DB)
* **Authentication:** JWT (JSON Web Tokens)
* **Deployment:**

  * Backend → Render
  * Frontend → Netlify

---

## 🗄 Database Design

Main Tables:

* **users** (user_id, full_name, email, password, role)
* **properties** (property_id, host_id, title, location, price_per_night, image_url)
* **bookings** (booking_id, property_id, guest_id, check_in, check_out)
* **reviews** (review_id, booking_id, rating, comment)

---

## 🔗 Live Demo

* 🌐 Frontend: https://stellar-flan-713e37.netlify.app/
* ⚙️ Backend API: https://airbnb-dbms-project.onrender.com

---

## ⚙️ Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/airbnb-dbms-project.git
cd airbnb-dbms-project
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup environment variables

Create a `.env` file:

```env
DATABASE_URL=your_postgres_connection_string
JWT_SECRET=your_secret_key
```

### 4. Run the server

```bash
npm start
```

---

## 📡 API Endpoints (Important)

### Auth

* `POST /register`
* `POST /login`

### Properties

* `GET /properties`
* `POST /properties`
* `DELETE /properties/:id`

### Bookings

* `POST /bookings`
* `GET /bookings/user`

### Reviews

* `POST /reviews`
* `GET /reviews/property/:id`

---

## 🎯 Key Functionalities

* Dynamic property listing with ratings
* Booking system with date handling
* Review system linked via **booking_id**
* Role-based access (User / Host)
* Clean UI with modal-based review display

---

## 🧠 Learning Outcomes

* Implemented relational database design with proper joins
* Built RESTful APIs using Express.js
* Integrated frontend with backend APIs
* Deployed full-stack application
* Debugged real-world issues like:

  * API errors (500)
  * Schema mismatches
  * JSON handling

---

## 📸 Screenshots

(Add your screenshots here)

---

## 👨‍💻 Author

**Ayush Srivastava**
Computer Science Student

---

## ⭐ Future Improvements

* Image upload instead of URL
* Booking conflict handling
* Better UI/UX (animations, cards)
* Admin dashboard
* Payment integration

---

## 📌 Note

This project was developed as part of a **DBMS course** to demonstrate practical implementation of database concepts in a real-world application.

---
