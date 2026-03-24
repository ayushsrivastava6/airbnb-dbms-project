const API_URL = "https://airbnb-dbms-project.onrender.com";

let selectedPropertyId = null;
let selectedPrice = 0;

/* ===================== TOAST ===================== */

function showToast(message)
{
    const toast = document.getElementById("toast");
    if (!toast) return;

    toast.innerText = message;
    toast.style.display = "block";

    setTimeout(() =>
    {
        toast.style.display = "none";
    }, 3000);
}

/* ===================== AUTH ===================== */

function getToken()
{
    return localStorage.getItem("token");
}

function decodeToken()
{
    const token = getToken();
    if (!token) return null;

    return JSON.parse(atob(token.split('.')[1]));
}

function logout()
{
    localStorage.removeItem("token");
    window.location.href = "index.html";
}

/* ===================== NAVBAR ===================== */

function updateNavbar()
{
    const token = getToken();
    const payload = decodeToken();

    const loginLink = document.getElementById("loginLink");
    const registerLink = document.getElementById("registerLink");
    const logoutLink = document.getElementById("logoutLink");
    const userGreeting = document.getElementById("userGreeting");
    const addLink = document.getElementById("addLink");
    const dashLink = document.getElementById("dashLink");
    const bookingLink = document.getElementById("bookingLink");

    if (!token)
    {
        if (loginLink) loginLink.style.display = "inline";
        if (registerLink) registerLink.style.display = "inline";
        if (logoutLink) logoutLink.style.display = "none";

        if (addLink) addLink.style.display = "none";
        if (dashLink) dashLink.style.display = "none";
        if (bookingLink) bookingLink.style.display = "none";

        return;
    }

    if (loginLink) loginLink.style.display = "none";
    if (registerLink) registerLink.style.display = "none";
    if (logoutLink) logoutLink.style.display = "inline";

    if (userGreeting)
    {
        userGreeting.innerText = `👤 ${payload.role.toUpperCase()}`;
    }

    if (payload.role === "guest")
    {
        if (addLink) addLink.style.display = "none";
        if (dashLink) dashLink.style.display = "none";
        if (bookingLink) bookingLink.style.display = "inline";
    }

    if (payload.role === "host")
    {
        if (addLink) addLink.style.display = "inline";
        if (dashLink) dashLink.style.display = "inline";
        if (bookingLink) bookingLink.style.display = "none";
    }
}
/* ===================== LOAD PROPERTIES ===================== */

async function loadProperties(url = "/properties-with-rating")
{
    try
    {
        const response = await fetch(API_URL + url);
        const data = await response.json();

        const container = document.getElementById("properties");
        if (!container) return;

        container.innerHTML = "";

        if (data.length === 0)
        {
            container.innerHTML = "<p>No properties found.</p>";
            return;
        }

        const payload = decodeToken();

        data.forEach(property =>
        {
            const stars = "⭐".repeat(Math.round(property.average_rating || 0));

            let deleteButton = "";

            if (payload && payload.role === "host")
            {
                deleteButton = `
                    <button onclick="deleteProperty(${property.property_id})"
                            style="background:#444;margin-left:10px;">
                        Delete
                    </button>
                `;
            }

            const card = document.createElement("div");
            card.className = "card";

            card.innerHTML = `
                <img class="property-img"
                     src="${property.image_url || 'https://source.unsplash.com/600x400/?house'}" />
                <h3>${property.title}</h3>
                <div class="stars">${stars}</div>
                <p><strong>Location:</strong> ${property.location}</p>
                <p><strong>Price:</strong> ₹${property.price_per_night}</p>
                <p><strong>Host:</strong> ${property.host_name}</p>
                <button onclick="openBookingModal(${property.property_id}, ${property.price_per_night})">
                    Book
                </button>
                ${deleteButton}
            `;

            container.appendChild(card);
        });
    }
    catch (err)
    {
        console.error(err);
        showToast("Error loading properties");
    }
}

/* ===================== SEARCH ===================== */

function searchProperties()
{
    const location = document.getElementById("searchLocation")?.value.trim();

    if (!location)
    {
        loadProperties();
        return;
    }

    loadProperties(`/search?location=${encodeURIComponent(location)}`);
}

/* ===================== BOOKING ===================== */

function openBookingModal(propertyId, price)
{
    if (!getToken())
    {
        showToast("Please login first");
        return;
    }

    selectedPropertyId = propertyId;
    selectedPrice = parseFloat(price);

    const modal = document.getElementById("bookingModal");
    if (modal)
    {
        modal.style.display = "flex";
    }

    document.getElementById("bookingSummary").innerHTML = "";
}

function closeModal()
{
    const modal = document.getElementById("bookingModal");
    if (modal)
    {
        modal.style.display = "none";
    }
}

function calculateBooking()
{
    const checkIn = document.getElementById("checkIn").value;
    const checkOut = document.getElementById("checkOut").value;

    if (!checkIn || !checkOut) return;

    const start = new Date(checkIn);
    const end = new Date(checkOut);

    const diffTime = end - start;
    const nights = diffTime / (1000 * 60 * 60 * 24);

    if (nights <= 0)
    {
        document.getElementById("bookingSummary").innerHTML =
            `<p style="color:red;">Check-out must be after check-in.</p>`;
        return;
    }

    const total = nights * selectedPrice;

    document.getElementById("bookingSummary").innerHTML =
    `
    <div class="booking-summary-card">
        <div class="summary-row">
            <span>${nights} nights</span>
            <span>₹${selectedPrice} × ${nights}</span>
        </div>

        <div class="summary-divider"></div>

        <div class="summary-row total-row">
            <span>Total</span>
            <span>₹${total}</span>
        </div>
    </div>
    `;
}

async function confirmBooking()
{
    try
    {
        const token = getToken();

        const check_in = document.getElementById("checkIn").value;
        const check_out = document.getElementById("checkOut").value;

        if (!check_in || !check_out)
        {
            showToast("Please select dates");
            return;
        }

        const response = await fetch(API_URL + "/book",
        {
            method: "POST",
            headers:
            {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                property_id: selectedPropertyId,
                check_in,
                check_out
            })
        });

        const data = await response.json();

        if (!response.ok)
        {
            showToast(data.message || "Booking failed");
            return;
        }

        showToast("Booking successful!");
        closeModal();
    }
    catch (err)
    {
        console.error(err);
        showToast("Error creating booking");
    }
}

/* ===================== ADD PROPERTY ===================== */

async function addProperty()
{
    try
    {
        const token = getToken();

        if (!token)
        {
            showToast("Please login as host");
            return;
        }

        const title = document.getElementById("title").value.trim();
        const description = document.getElementById("description").value.trim();
        const location = document.getElementById("location").value.trim();
        const price_per_night = document.getElementById("price").value;
        const max_guests = document.getElementById("guests").value;
        const image_url = document.getElementById("image_url").value.trim();

        const response = await fetch(API_URL + "/add-property",
        {
            method: "POST",
            headers:
            {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                title,
                description,
                location,
                price_per_night,
                max_guests,
                image_url
            })
        });

        const data = await response.json();

        if (!response.ok)
        {
            showToast(data.message || "Failed to add property");
            return;
        }

        showToast("Property added successfully!");

        setTimeout(() =>
        {
            window.location.href = "index.html";
        }, 1000);
    }
    catch (err)
    {
        console.error(err);
        showToast("Error adding property");
    }
}

/* ===================== DELETE PROPERTY ===================== */

async function deleteProperty(propertyId)
{
    try
    {
        const token = getToken();

        if (!confirm("Are you sure you want to delete this property?"))
            return;

        const response = await fetch(API_URL + "/delete-property/" + propertyId,
        {
            method: "DELETE",
            headers:
            {
                "Authorization": "Bearer " + token
            }
        });

        const data = await response.json();

        if (!response.ok)
        {
            showToast(data.message || "Delete failed");
            return;
        }

        showToast("Property deleted successfully");
        loadProperties();
    }
    catch (err)
    {
        console.error(err);
        showToast("Error deleting property");
    }
}
async function loadMyBookings()
{
    try
    {
        const token = getToken();

        const response = await fetch(API_URL + "/my-bookings",
        {
            headers:
            {
                "Authorization": "Bearer " + token
            }
        });

        const data = await response.json();

        const container = document.getElementById("bookings");

        if (!container) return;

        container.innerHTML = "";

        if (data.length === 0)
        {
            container.innerHTML = "<p>No bookings yet.</p>";
            return;
        }

        data.forEach(booking =>
    {
        const card = document.createElement("div");
        card.className = "card";

        const checkIn = new Date(booking.check_in).toLocaleDateString('en-IN');
        const checkOut = new Date(booking.check_out).toLocaleDateString('en-IN');

        card.innerHTML = `
    <img class="property-img"
        src="${booking.image_url || 'https://source.unsplash.com/600x400/?house'}">

    <h3>${booking.title}</h3>
    <p><strong>Check-in:</strong> ${checkIn}</p>
    <p><strong>Check-out:</strong> ${checkOut}</p>
    <p><strong>Total:</strong> ₹${booking.total_price}</p>
    <p><strong>Status:</strong> ${booking.booking_status}</p>

    <button onclick="openReviewModal(${booking.booking_id})">
        Leave Review
    </button>
    `;

        container.appendChild(card);
    });
    }
    catch (err)
    {
        console.error(err);
        showToast("Error loading bookings");
    }
}
let selectedBookingId = null;

function openReviewModal(bookingId)
{
    selectedBookingId = bookingId;
    document.getElementById("reviewModal").style.display = "flex";
}

function closeReviewModal()
{
    document.getElementById("reviewModal").style.display = "none";
}

async function submitReview()
{
    const token = getToken();

    const rating = document.getElementById("rating").value;
    const comment = document.getElementById("comment").value;

    const response = await fetch(API_URL + "/review",
    {
        method: "POST",
        headers:
        {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            booking_id: selectedBookingId,
            rating,
            comment
        })
    });

    const data = await response.json();

    if(!response.ok)
    {
        showToast(data.message || "Review failed");
        return;
    }

    showToast("Review submitted!");

    closeReviewModal();
}

/* ===================== PAGE LOAD ===================== */

document.addEventListener("DOMContentLoaded", () =>
{
    updateNavbar();

    if (document.getElementById("properties"))
    {
        loadProperties();
    }

    if (document.getElementById("bookings"))
    {
        loadMyBookings();
    }
});