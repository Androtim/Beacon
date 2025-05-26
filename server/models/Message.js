import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true,
    maxLength: 1000
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
messageSchema.index({ from: 1, to: 1, timestamp: -1 });
messageSchema.index({ to: 1, read: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;