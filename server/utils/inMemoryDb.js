import bcrypt from 'bcryptjs';

class InMemoryDatabase {
  constructor() {
    this.users = new Map();
    this.nextId = 1;
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
    return updatedUser;
  }

  async comparePassword(user, password) {
    return await bcrypt.compare(password, user.password);
  }

  toJSON(user) {
    const { password, ...userWithoutPassword } = user;
    return { ...userWithoutPassword, id: user._id };
  }
}

export default new InMemoryDatabase();