Simple E-commerce API
A Node.js/Express-based e-commerce API with SQLite, JWT authentication, product listings, cart management, and order creation. Includes a basic HTML frontend for interaction.
Features

Product listings with pagination and search by name or category
Cart management (add, update, remove items)
Order creation from cart
User authentication with JWT
Two user roles: Customer (view products, manage cart, place orders) and Admin (manage products)
Basic frontend for API interaction

Prerequisites

Node.js (v16 or higher)
npm

Installation

Clone the repository or create the project directory:
git clone <repository-url>
cd ecommerce-api


Install dependencies:
npm install


Create a .env file in the root directory with the following:
PORT=3000
DATABASE_PATH=./ecommerce.db
JWT_SECRET=your-secret-key-here



Running the Application

Start the server:
npm start

Or, for development with auto-restart:
npm run dev


Access the frontend:

Open http://localhost:3000 in your browser.
Use the demo admin credentials: admin@example.com / admin123
Or register a new customer account.



Folder Structure
ecommerce-api/
├── public/
│   └── index.html        # Frontend HTML/CSS/JS
├── .env                  # Environment variables
├── package.json          # Project metadata and dependencies
├── server.js             # Backend API server
└── README.md             # Project documentation

API Endpoints
Authentication

POST /api/register - Register a new user
POST /api/login - Login and receive JWT

Products

GET /api/products - List products (with pagination and search)
GET /api/products/:id - Get product details
POST /api/products - Create product (Admin)
PUT /api/products/:id - Update product (Admin)
DELETE /api/products/:id - Delete product (Admin)
GET /api/categories - Get available categories

Cart

GET /api/cart - Get user's cart
POST /api/cart/add - Add item to cart
PUT /api/cart/update - Update item quantity
DELETE /api/cart/remove/:productId - Remove item from cart

Orders

POST /api/orders - Create order from cart
GET /api/orders - Get user's orders
GET /api/orders/:id - Get order details
GET /api/admin/orders - Get all orders (Admin)
PUT /api/admin/orders/:id/status - Update order status (Admin)

Notes

The application initializes with sample products and an admin user (admin@example.com / admin123) if the database is empty.
The SQLite database is stored in ecommerce.db in the project root.
Ensure the JWT_SECRET in .env is a strong, unique key in production.
The frontend uses a simple HTML/CSS/JS interface with no external frameworks.


If database errors occur, ensure the DATABASE_PATH is correct and the directory is writable.
For CORS issues, ensure the cors middleware is correctly configured.
If JWT errors occur, verify the JWT_SECRET matches between server and client requests.
If dependencies fail to install, ensure Node.js version is v16 or higher and run npm install again.
