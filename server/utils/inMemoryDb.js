import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

class InMemoryDatabase {
  constructor() {
    this.users = new Map();
    this.messages = new Map();
    this.nextId = 1;
    this.nextMessageId = 1;
    this.dbPath = path.join(process.cwd(), 'data', 'db.json');
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
        
        // Load users
        if (data.users) {
          data.users.forEach(user => {
            this.users.set(user._id, user);
            const idInt = parseInt(user._id);
            if (idInt >= this.nextId) this.nextId = idInt + 1;
          });
        }
        
        // Load messages
        if (data.messages) {
          data.messages.forEach(msg => {
            this.messages.set(msg._id, msg);
            const idInt = parseInt(msg._id);
            if (idInt >= this.nextMessageId) this.nextMessageId = idInt + 1;
          });
        }
        
        console.log(`✅ Loaded ${this.users.size} users and ${this.messages.size} messages from ${this.dbPath}`);
      }
    } catch (err) {
      console.error('❌ Error loading database:', err);
    }
  }

  save() {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const data = {
        users: Array.from(this.users.values()),
        messages: Array.from(this.messages.values())
      };
      
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('❌ Error saving database:', err);
    }
  }

  async createUser(userData) {
    const { username, email, password } = userData;
    
    // Check for existing user
    for (const user of this.users.values()) {
      if (user.email === email) {
        throw new Error('Email already exists');
      }
      if (user.username === username) {
        throw new Error('Username already exists');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = {
      _id: this.nextId.toString(),
      username,
      email,
      password: hashedPassword,
      isOnline: false,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.users.set(this.nextId.toString(), user);
    this.nextId++;
    
    this.save();
    return user;
  }

  async findUserByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async findUserById(id) {
    return this.users.get(id) || null;
  }

  async updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user) return null;

    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    this.save();
    return updatedUser;
  }

  async comparePassword(user, password) {
    return await bcrypt.compare(password, user.password);
  }

  toJSON(user) {
    const { password, ...userWithoutPassword } = user;
    return { ...userWithoutPassword, id: user._id };
  }

  // Message methods
  async createMessage(messageData) {
    const message = {
      _id: this.nextMessageId.toString(),
      ...messageData,
      timestamp: messageData.timestamp || new Date(),
      read: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.messages.set(message._id, message);
    this.nextMessageId++;
    this.save();
    return message;
  }
  
  async getMessages(userId1, userId2, limit = 50) {
    const messages = Array.from(this.messages.values())
      .filter(msg => 
        (msg.from === userId1 && msg.to === userId2) ||
        (msg.from === userId2 && msg.to === userId1)
      )
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit)
      .reverse(); // Reverse to get chronological order
      
    return messages;
  }
  
  async getConversations(userId) {
    const conversationMap = new Map();
    
    // Get all messages involving this user
    Array.from(this.messages.values())
      .filter(msg => msg.from === userId || msg.to === userId)
      .forEach(msg => {
        const otherUserId = msg.from === userId ? msg.to : msg.from;
        if (!conversationMap.has(otherUserId)) {
          conversationMap.set(otherUserId, {
            userId: otherUserId,
            lastMessage: msg,
            unreadCount: 0
          });
        } else {
          const conv = conversationMap.get(otherUserId);
          if (new Date(msg.timestamp) > new Date(conv.lastMessage.timestamp)) {
            conv.lastMessage = msg;
          }
        }
        
        // Count unread messages
        if (msg.to === userId && !msg.read) {
          conversationMap.get(otherUserId).unreadCount++;
        }
      });
    
    return Array.from(conversationMap.values());
  }
  
  async markMessagesAsRead(userId, fromUserId) {
    Array.from(this.messages.values())
      .filter(msg => msg.to === userId && msg.from === fromUserId && !msg.read)
      .forEach(msg => {
        msg.read = true;
        msg.updatedAt = new Date();
      });
    this.save();
  }
}

export default new InMemoryDatabase();