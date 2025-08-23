import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  action: String,
  details: String,
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('AuditLog', auditLogSchema);