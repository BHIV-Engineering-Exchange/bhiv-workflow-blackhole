/**
 * Migration script to update existing data to use blackhole_mumbai branch
 * Run: node scripts/migrateBranches.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const migrateData = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Update Users with old branch codes or no branch
    console.log('📋 Updating Users...');
    const userResult = await db.collection('users').updateMany(
      { $or: [{ branch: 'mumbai' }, { branch: null }, { branch: '' }, { branch: { $exists: false } }] },
      { $set: { branch: 'blackhole_mumbai' } }
    );
    console.log(`   ✅ Users updated: ${userResult.modifiedCount}`);
    
    // Update Attendance records
    console.log('📋 Updating Attendances...');
    const attResult = await db.collection('attendances').updateMany(
      { $or: [{ branch: 'mumbai' }, { branch: null }, { branch: '' }, { branch: { $exists: false } }] },
      { $set: { branch: 'blackhole_mumbai' } }
    );
    console.log(`   ✅ Attendances updated: ${attResult.modifiedCount}`);
    
    // Update Tasks
    console.log('📋 Updating Tasks...');
    const taskResult = await db.collection('tasks').updateMany(
      { $or: [{ branch: 'mumbai' }, { branch: null }, { branch: '' }, { branch: { $exists: false } }] },
      { $set: { branch: 'blackhole_mumbai' } }
    );
    console.log(`   ✅ Tasks updated: ${taskResult.modifiedCount}`);
    
    // Update Leaves
    console.log('📋 Updating Leaves...');
    const leaveResult = await db.collection('leaves').updateMany(
      { $or: [{ branch: 'mumbai' }, { branch: null }, { branch: '' }, { branch: { $exists: false } }] },
      { $set: { branch: 'blackhole_mumbai' } }
    );
    console.log(`   ✅ Leaves updated: ${leaveResult.modifiedCount}`);
    
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
};

migrateData();
