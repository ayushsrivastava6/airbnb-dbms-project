require("dotenv").config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) =>
{
    const authHeader = req.headers.authorization;

    if (!authHeader)
    {
        return res.status(401).send('Access denied. No token provided.');
    }

    const token = authHeader.split(' ')[1];

    try
    {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err)
    {
        res.status(400).send('Invalid token');
    }
};

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool(
{
    connectionString: process.env.DATABASE_URL,
    ssl:
    {
        rejectUnauthorized: false
    }
});

app.get('/', (req, res) => {
    res.send('Airbnb Backend Running');
});

app.get('/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});
app.post('/register', async (req, res) => {
    try {
        const { full_name, email, password, role } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        console.log("Original password:", password);
        console.log("Hashed password:", hashedPassword);

        const result = await pool.query(
            'INSERT INTO users (full_name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING user_id, full_name, email, role',
            [full_name, email, hashedPassword, role]
        );

        res.json(result.rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).send('Error registering user');
    }
});
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const userResult = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rowCount === 0) {
            return res.status(400).send('User not found');
        }

        const user = userResult.rows[0];

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return res.status(400).send('Invalid password');
        }

        const token = jwt.sign(
            {
                user_id: user.user_id,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token });

    } catch (err) {
        console.error(err);
        res.status(500).send('Login failed');
    }
});
app.post('/add-property', authMiddleware, async (req, res) =>
{
    if (req.user.role !== 'host')
    {
        return res.status(403).send('Only hosts can add property');
    }

    const host_id = req.user.user_id;

    try
    {
        const { title, description, location, price_per_night, max_guests, image_url } = req.body;

        const result = await pool.query(
            `
            INSERT INTO properties
            (host_id, title, description, location, price_per_night, max_guests, image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            `,
            [host_id, title, description, location, price_per_night, max_guests, image_url]
        );

        res.json(result.rows[0]);
    }
    catch (err)
    {
        console.error(err);
        res.status(500).send('Error adding property');
    }
});

app.post('/book', authMiddleware, async (req, res) =>
{
    try
    {
        if (req.user.role !== 'guest')
        {
            return res.status(403).json({ message: 'Only guests can book properties' });
        }

        const guest_id = req.user.user_id;

        const { property_id, check_in, check_out } = req.body;

        if (!property_id || !check_in || !check_out)
        {
            return res.status(400).json({ message: 'Missing booking details' });
        }

        /* ===== CHECK DATE CONFLICT ===== */

        const conflict = await pool.query(
        `
        SELECT 1 FROM bookings
        WHERE property_id = $1
        AND booking_status = 'Confirmed'
        AND (
            ($2 BETWEEN check_in AND check_out)
            OR
            ($3 BETWEEN check_in AND check_out)
            OR
            (check_in BETWEEN $2 AND $3)
        )
        `,
        [property_id, check_in, check_out]
        );

        if (conflict.rowCount > 0)
        {
            return res.status(400).json({ message: 'Property already booked for these dates' });
        }

        /* ===== GET PROPERTY PRICE ===== */

        const priceResult = await pool.query(
            `SELECT price_per_night FROM properties WHERE property_id = $1`,
            [property_id]
        );

        if (priceResult.rowCount === 0)
        {
            return res.status(404).json({ message: 'Property not found' });
        }

        const price = priceResult.rows[0].price_per_night;

        /* ===== CALCULATE NIGHTS ===== */

        const nights =
            (new Date(check_out) - new Date(check_in)) /
            (1000 * 60 * 60 * 24);

        if (nights <= 0)
        {
            return res.status(400).json({ message: 'Invalid booking dates' });
        }

        /* ===== CALCULATE TOTAL PRICE ===== */

        const total_price = nights * price;

        /* ===== INSERT BOOKING ===== */

        const result = await pool.query(
        `
        INSERT INTO bookings
        (property_id, guest_id, check_in, check_out, total_price, booking_status)
        VALUES ($1, $2, $3, $4, $5, 'Confirmed')
        RETURNING *
        `,
        [property_id, guest_id, check_in, check_out, total_price]
        );

        res.status(201).json(result.rows[0]);
    }
    catch (err)
    {
        console.error(err);
        res.status(500).json({ message: 'Error creating booking' });
    }
});

app.get('/properties', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                p.property_id,
                p.title,
                p.location,
                p.price_per_night,
                p.max_guests,
                u.full_name AS host_name
            FROM properties p
            JOIN users u ON p.host_id = u.user_id
        `);

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching properties');
    }
});

app.get('/bookings', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                b.booking_id,
                u.full_name AS guest_name,
                p.title AS property_title,
                b.check_in,
                b.check_out,
                b.total_price,
                b.booking_status
            FROM bookings b
            JOIN users u ON b.guest_id = u.user_id
            JOIN properties p ON b.property_id = p.property_id
        `);

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching bookings');
    }
});



app.post('/review', authMiddleware, async (req, res) =>
{
    try
    {
        if (req.user.role !== 'guest')
        {
            return res.status(403).json({ message: 'Only guests can leave reviews' });
        }

        const guest_id = req.user.user_id;
        const { booking_id, rating, comment } = req.body;

        if (!booking_id || !rating)
        {
            return res.status(400).json({ message: 'Missing review details' });
        }

        const bookingCheck = await pool.query(
            `
            SELECT * FROM bookings
            WHERE booking_id = $1
            AND guest_id = $2
            AND booking_status = 'Confirmed'
            `,
            [booking_id, guest_id]
        );

        if (bookingCheck.rowCount === 0)
        {
            return res.status(403).json({ message: 'Invalid booking or not authorized' });
        }

        const existingReview = await pool.query(
            `SELECT * FROM reviews WHERE booking_id = $1`,
            [booking_id]
        );

        if (existingReview.rowCount > 0)
        {
            return res.status(400).json({ message: 'Review already exists for this booking' });
        }

        const result = await pool.query(
            `
            INSERT INTO reviews (booking_id, rating, comment)
            VALUES ($1, $2, $3)
            RETURNING *
            `,
            [booking_id, rating, comment]
        );

        res.status(201).json(result.rows[0]);
    }
    catch (err)
    {
        console.error(err);
        res.status(500).json({ message: 'Error adding review' });
    }
});

app.get('/properties-with-rating', async (req, res) =>
{
    try
    {
        const result = await pool.query(`
            SELECT 
                p.property_id,
                p.title,
                p.location,
                p.price_per_night,
                p.image_url,
                u.full_name AS host_name,
                COALESCE(AVG(r.rating), 0) AS average_rating
            FROM properties p
            JOIN users u ON p.host_id = u.user_id
            LEFT JOIN bookings b 
                ON p.property_id = b.property_id
            LEFT JOIN reviews r 
                ON b.booking_id = r.booking_id
            GROUP BY 
                p.property_id,
                p.title,
                p.location,
                p.price_per_night,
                p.image_url,
                u.full_name
            ORDER BY p.property_id DESC
        `);

        res.json(result.rows);
    }
    catch (err)
    {
        console.error(err);
        res.status(500).json({ message: 'Error fetching properties' });
    }
});

app.get('/search', async (req, res) => {
    try {
        const { location, min_price, max_price, guests } = req.query;

        let query = `
            SELECT 
                p.property_id,
                p.title,
                p.location,
                p.price_per_night,
                p.max_guests,
                u.full_name AS host_name
            FROM properties p
            JOIN users u ON p.host_id = u.user_id
            WHERE 1=1
        `;

        let values = [];
        let index = 1;

        if (location) {
            query += ` AND p.location ILIKE $${index++}`;
            values.push(`%${location}%`);
        }

        if (min_price) {
            query += ` AND p.price_per_night >= $${index++}`;
            values.push(min_price);
        }

        if (max_price) {
            query += ` AND p.price_per_night <= $${index++}`;
            values.push(max_price);
        }

        if (guests) {
            query += ` AND p.max_guests >= $${index++}`;
            values.push(guests);
        }

        const result = await pool.query(query, values);
        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).send('Search failed');
    }
});

app.get('/host-dashboard/:hostId', authMiddleware, async (req, res) =>
{
    try
    {
        if (req.user.role !== 'host')
        {
            return res.status(403).json({ message: 'Only hosts can access dashboard' });
        }

        const hostId = req.user.user_id;

        const result = await pool.query(
        `
        SELECT
            COUNT(DISTINCT p.property_id) AS total_properties,
            COUNT(b.booking_id) AS total_bookings,
            COALESCE(SUM(b.total_price),0) AS total_earnings
        FROM properties p
        LEFT JOIN bookings b
            ON p.property_id = b.property_id
        WHERE p.host_id = $1
        `,
        [hostId]
        );

        res.json(result.rows[0]);
    }
    catch (err)
    {
        console.error(err);
        res.status(500).json({ message: 'Error loading dashboard' });
    }
});



app.delete('/delete-property/:id', authMiddleware, async (req, res) =>
{
    try
    {
        if (req.user.role !== 'host')
        {
            return res.status(403).json({ message: 'Only hosts can delete properties' });
        }

        const propertyId = req.params.id;
        const hostId = req.user.user_id;

        // Ensure property belongs to logged-in host
        const check = await pool.query(
            `SELECT * FROM properties WHERE property_id = $1 AND host_id = $2`,
            [propertyId, hostId]
        );

        if (check.rowCount === 0)
        {
            return res.status(403).json({ message: 'Unauthorized deletion attempt' });
        }

        await pool.query(
            `DELETE FROM properties WHERE property_id = $1`,
            [propertyId]
        );

        res.json({ message: 'Property deleted successfully' });
    }
    catch (err)
    {
        console.error(err);
        res.status(500).json({ message: 'Error deleting property' });
    }
});
app.get('/my-bookings', authMiddleware, async (req, res) =>
{
    try
    {
        const guest_id = req.user.user_id;

        const result = await pool.query(
        `
        SELECT 
            b.booking_id,
            p.title,
            p.image_url,
            b.check_in,
            b.check_out,
            b.total_price,
            b.booking_status
        FROM bookings b
        JOIN properties p ON b.property_id = p.property_id
        WHERE b.guest_id = $1
        ORDER BY b.booking_id DESC
        `,
        [guest_id]);

        res.json(result.rows);
    }
    catch (err)
    {
        console.error(err);
        res.status(500).json({ message: 'Error fetching bookings' });
    }
});
app.get("/reviews/property/:propertyId", async (req, res) =>
{
    const { propertyId } = req.params;

    try
    {
        const result = await pool.query(
        `
        SELECT r.rating, r.comment, u.email
        FROM reviews r
        JOIN bookings b ON r.booking_id = b.booking_id
        JOIN users u ON b.user_id = u.user_id
        WHERE b.property_id = $1
        `,
        [propertyId]);

        res.json(result.rows);
    }
    catch (err)
{
    console.error("ERROR:", err.message);
    res.status(500).json({ error: err.message });
}
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>
{
    console.log(`Server running on port ${PORT}`);
});
