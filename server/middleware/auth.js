import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import inMemoryDb from '../utils/inMemoryDb.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // In express middleware, req.app is usually available
    // But in some contexts it might not be, so we check
    const usingMongoDB = req.app ? req.app.locals.usingMongoDB : !!mongoose.connection.readyState;
    
    let user;
    if (usingMongoDB) {
      user = await User.findById(decoded.userId);
    } else {
      user = await inMemoryDb.findUserById(decoded.userId);
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
