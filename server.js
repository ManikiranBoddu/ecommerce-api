const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Sequelize, DataTypes, Op } = require('sequelize');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
const DATABASE_PATH = process.env.DATABASE_PATH || './ecommerce.db';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from public directory

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: DATABASE_PATH,
  logging: console.log // Enable logging for debugging
});

// Define Models
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('customer', 'admin'), defaultValue: 'customer' },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'Users', timestamps: false });

const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  price: { type: DataTypes.FLOAT, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  image: { type: DataTypes.STRING, defaultValue: '/wireless_bluetooth.jpg' },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'Products', timestamps: false });

const Cart = sequelize.define('Cart', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  total: { type: DataTypes.FLOAT, defaultValue: 0 },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'Carts', timestamps: false });

const CartItem = sequelize.define('CartItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cartId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Cart, key: 'id' } },
  productId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Product, key: 'id' } },
  quantity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
  price: { type: DataTypes.FLOAT, allowNull: false }
}, { tableName: 'CartItems', timestamps: false });

const Order = sequelize.define('Order', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  total: { type: DataTypes.FLOAT, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered'), defaultValue: 'pending' },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'Orders', timestamps: false });

const OrderItem = sequelize.define('OrderItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Order, key: 'id' } },
  productId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Product, key: 'id' } },
  name: { type: DataTypes.STRING, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  price: { type: DataTypes.FLOAT, allowNull: false }
}, { tableName: 'OrderItems', timestamps: false });

// Define Associations
User.hasOne(Cart, { foreignKey: 'userId' });
Cart.belongsTo(User, { foreignKey: 'userId' });
Cart.hasMany(CartItem, { foreignKey: 'cartId' });
CartItem.belongsTo(Cart, { foreignKey: 'cartId' });
CartItem.belongsTo(Product, { foreignKey: 'productId' });
User.hasMany(Order, { foreignKey: 'userId' });
Order.belongsTo(User, { foreignKey: 'userId' });
Order.hasMany(OrderItem, { foreignKey: 'orderId' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId' });

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// Routes
app.get('/', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/validate', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const existingUser = await User.findOne({ where: { [Op.or]: [{ email }, { username }] } });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashedPassword, role: role || 'customer' });
    res.status(201).json({ message: 'User created successfully', userId: user.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Product Routes
app.get('/api/products', async (req, res) => {
  try {
    const { page = 1, limit = 6, search, category } = req.query;
    const where = {};
    if (search) where.name = { [Op.like]: `%${search}%` };
    if (category) where.category = category;

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: (page - 1) * limit,
      order: [['createdAt', 'DESC']]
    });
    res.json({ products: rows, totalPages: Math.ceil(count / limit), currentPage: parseInt(page), total: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, category, stock, image } = req.body;
    console.log('Creating product with image:', image); // Debug log
    const product = await Product.create({ name, description, price, category, stock, image });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, category, stock, image } = req.body;
    console.log('Updating product with image:', image); // Debug log
    const [updated] = await Product.update({ name, description, price, category, stock, image }, { where: { id: req.params.id }, returning: true });
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    const product = await Product.findByPk(req.params.id);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await Product.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cart Routes
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ where: { userId: req.user.userId }, include: [{ model: CartItem, include: [Product] }] });
    if (!cart) return res.json({ items: [], total: 0 });
    res.json({ items: cart.CartItems.map(item => ({ productId: item.Product, quantity: item.quantity, price: item.price })), total: cart.total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cart/add', authenticateToken, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.stock < quantity) return res.status(400).json({ error: 'Insufficient stock' });

    let cart = await Cart.findOne({ where: { userId: req.user.userId } });
    if (!cart) cart = await Cart.create({ userId: req.user.userId });

    const existingItem = await CartItem.findOne({ where: { cartId: cart.id, productId } });
    if (existingItem) {
      existingItem.quantity += quantity;
      await existingItem.save();
    } else {
      await CartItem.create({ cartId: cart.id, productId, quantity, price: product.price });
    }

    const cartItems = await CartItem.findAll({ where: { cartId: cart.id } });
    cart.total = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
    cart.updatedAt = new Date();
    await cart.save();

    const updatedCart = await Cart.findOne({ where: { userId: req.user.userId }, include: [{ model: CartItem, include: [Product] }] });
    res.json({ items: updatedCart.CartItems.map(item => ({ productId: item.Product, quantity: item.quantity, price: item.price })), total: updatedCart.total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/cart/update', authenticateToken, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const cart = await Cart.findOne({ where: { userId: req.user.userId } });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const item = await CartItem.findOne({ where: { cartId: cart.id, productId } });
    if (!item) return res.status(404).json({ error: 'Item not found in cart' });

    if (quantity <= 0) await item.destroy();
    else {
      item.quantity = quantity;
      await item.save();
    }

    const cartItems = await CartItem.findAll({ where: { cartId: cart.id } });
    cart.total = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
    cart.updatedAt = new Date();
    await cart.save();

    const updatedCart = await Cart.findOne({ where: { userId: req.user.userId }, include: [{ model: CartItem, include: [Product] }] });
    res.json({ items: updatedCart.CartItems.map(item => ({ productId: item.Product, quantity: item.quantity, price: item.price })), total: updatedCart.total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cart/remove/:productId', authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ where: { userId: req.user.userId } });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    await CartItem.destroy({ where: { cartId: cart.id, productId: req.params.productId } });
    const cartItems = await CartItem.findAll({ where: { cartId: cart.id } });
    cart.total = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
    cart.updatedAt = new Date();
    await cart.save();

    const updatedCart = await Cart.findOne({ where: { userId: req.user.userId }, include: [{ model: CartItem, include: [Product] }] });
    res.json({ items: updatedCart ? updatedCart.CartItems.map(item => ({ productId: item.Product, quantity: item.quantity, price: item.price })) : [], total: updatedCart ? updatedCart.total : 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Order Routes
app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ where: { userId: req.user.userId }, include: [{ model: CartItem, include: [Product] }] });
    if (!cart || !cart.CartItems || cart.CartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    for (const item of cart.CartItems) {
      if (item.Product.stock < item.quantity) return res.status(400).json({ error: `Insufficient stock for ${item.Product.name}` });
    }

    const order = await Order.create({ userId: req.user.userId, total: cart.total });
    const orderItems = cart.CartItems.map(item => ({ orderId: order.id, productId: item.productId, name: item.Product.name, quantity: item.quantity, price: item.price }));
    await OrderItem.bulkCreate(orderItems);

    for (const item of cart.CartItems) {
      await Product.update({ stock: sequelize.literal(`stock - ${item.quantity}`) }, { where: { id: item.productId } });
    }

    await CartItem.destroy({ where: { cartId: cart.id } });
    await Cart.destroy({ where: { id: cart.id } });

    const createdOrder = await Order.findByPk(order.id, { include: [{ model: OrderItem, include: [Product] }] });
    res.status(201).json(createdOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.findAll({ where: { userId: req.user.userId }, include: [{ model: OrderItem, include: [Product] }], order: [['createdAt', 'DESC']] });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, { include: [{ model: OrderItem, include: [Product] }] });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.user.userId && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Routes
app.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const orders = await Order.findAll({ include: [{ model: User, attributes: ['username', 'email'] }, { model: OrderItem, include: [Product] }], order: [['createdAt', 'DESC']] });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/orders/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const [updated] = await Order.update({ status }, { where: { id: req.params.id }, returning: true });
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    const order = await Order.findByPk(req.params.id);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Categories endpoint
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Product.findAll({ attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('category')), 'category']] });
    res.json(categories.map(c => c.category));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize database and start server
async function initializeDatabase() {
  try {
    await sequelize.sync({ force: true });
    console.log('Database synchronized');
    await initializeSampleData();
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

async function initializeSampleData() {
  try {
    const productCount = await Product.count();
    if (productCount > 0) return;

    const sampleProducts = [
      { name: 'Wireless Bluetooth Headphones', description: 'High-quality wireless headphones with noise cancellation', price: 99.99, category: 'Electronics', stock: 50, image: '/image.png' },
      { name: 'Smart Watch', description: 'Fitness tracking smartwatch with heart rate monitor', price: 199.99, category: 'Electronics', stock: 30, image: '/smartWatch.jpg' },
      { name: 'Coffee Maker', description: 'Programmable coffee maker with timer', price: 79.99, category: 'Kitchen', stock: 25, image: '/coffee_maker.jpg' },
      { name: 'Yoga Mat', description: 'Non-slip yoga mat for home workouts', price: 29.99, category: 'Fitness', stock: 100, image: '/yoga_mat.jpg' },
      { name: 'Laptop Backpack', description: 'Waterproof laptop backpack with multiple compartments', price: 49.99, category: 'Accessories', stock: 75, image: '/laptopBackpack.jpg' }
    ];
    await Product.bulkCreate(sampleProducts);
    console.log('Sample products created with images:', sampleProducts.map(p => p.image)); // Debug log
    const adminExists = await User.findOne({ where: { role: 'admin' } });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({ username: 'admin', email: 'admin@example.com', password: hashedPassword, role: 'admin' });
      console.log('Admin user created: admin@example.com / admin123');
    }
  } catch (error) {
    console.error('Error initializing sample data:', error);
  }
}
app.listen(PORT, async () => {
  await initializeDatabase();
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend available at http://localhost:${PORT}`);
});