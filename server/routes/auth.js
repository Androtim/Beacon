import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import db from '../utils/inMemoryDb.js';

const router = express.Router();

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usingMongoDB = req.app.locals.usingMongoDB;
    
    let user;
    if (usingMongoDB) {
      user = await User.findById(decoded.userId);
    } else {
      user = await db.findUserById(decoded.userId);
    }

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const usingMongoDB = req.app.locals.usingMongoDB;
    let user, token;

    if (usingMongoDB) {
      // Check for existing user
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        const field = existingUser.email === email ? 'email' : 'username';
        return res.status(400).json({ message: `This ${field} is already taken` });
      }

      user = new User({ username, email, password });
      await user.save();
      token = generateToken(user._id);

      res.status(201).json({
        message: 'Account created successfully',
        token,
        user: user.toJSON()
      });
    } else {
      user = await db.createUser({ username, email, password });
      token = generateToken(user._id);

      res.status(201).json({
        message: 'Account created successfully',
        token,
        user: db.toJSON(user)
      });
    }
  } catch (error) {
    console.error('Signup error:', error);
    if (error.message.includes('already exists') || error.message.includes('already taken')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error during signup' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const usingMongoDB = req.app.locals.usingMongoDB;
    let user, isValidPassword;

    if (usingMongoDB) {
      user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      user.isOnline = true;
      user.lastSeen = new Date();
      await user.save();

      const token = generateToken(user._id);
      res.json({
        message: 'Login successful',
        token,
        user: user.toJSON()
      });
    } else {
      user = await db.findUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      isValidPassword = await db.comparePassword(user, password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      await db.updateUser(user._id, { isOnline: true, lastSeen: new Date() });
      const token = generateToken(user._id);

      res.json({
        message: 'Login successful',
        token,
        user: db.toJSON(user)
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const usingMongoDB = req.app.locals.usingMongoDB;
    
    if (usingMongoDB) {
      res.json({ user: req.user.toJSON() });
    } else {
      res.json({ user: db.toJSON(req.user) });
    }
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const usingMongoDB = req.app.locals.usingMongoDB;

    if (usingMongoDB) {
      req.user.isOnline = false;
      req.user.lastSeen = new Date();
      await req.user.save();
    } else {
      await db.updateUser(req.user._id, { isOnline: false, lastSeen: new Date() });
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
});

export default router;