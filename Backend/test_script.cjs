const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'c:/Users/PRAMOD/OneDrive/Desktop/gym man/Backend/.env' });

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gym-man');
  const Member = mongoose.model('Member', new mongoose.Schema({}, { strict: false }));
  const allMembers = await Member.find({}, 'name expiryDate');
  console.log('Total members:', allMembers.length);
  const now = new Date();
  const ninetyThreeDaysAgo = new Date(now.getTime() - (93 * 24 * 60 * 60 * 1000));
  const expiredMembers = await Member.find({ expiryDate: { $lt: ninetyThreeDaysAgo } }, 'name expiryDate');
  console.log('Members < 93 days ago:', expiredMembers.length);
  console.log('93 days ago date:', ninetyThreeDaysAgo);
  
  for (let m of allMembers) {
    if (!m.expiryDate) continue;
    const diff = now - new Date(m.expiryDate);
    const days = Math.floor(diff / (1000*60*60*24));
    if (days > 93) {
      console.log('MANUAL MATCH:', m.name, m.expiryDate, 'daysExpired:', days);
    }
  }
  process.exit(0);
}
run();
