const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

/**
 * Database Index Setup Script
 * Run this once to add critical indexes for performance
 * 
 * Usage: node scripts/addIndexes.js
 */

async function addIndexes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    console.log('\n📊 Creating indexes...\n');

    // ============================================
    // USERS COLLECTION
    // ============================================
    console.log('👤 Users indexes...');
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ role: 1 });
    await db.collection('users').createIndex({ department: 1 });
    await db.collection('users').createIndex({ branch: 1 });
    await db.collection('users').createIndex({ stillExist: 1 });
    console.log('  ✅ Users indexes created');

    // ============================================
    // ATTENDANCES COLLECTION (Real-time)
    // ============================================
    console.log('📅 Attendances indexes...');
    await db.collection('attendances').createIndex({ user: 1, date: -1 });
    await db.collection('attendances').createIndex({ date: -1 });
    await db.collection('attendances').createIndex({ user: 1, startDayTime: -1 });
    await db.collection('attendances').createIndex({ endDayTime: 1 });
    await db.collection('attendances').createIndex({ spamStatus: 1 });
    console.log('  ✅ Attendances indexes created');

    // ============================================
    // DAILY ATTENDANCES COLLECTION (Persistent)
    // ============================================
    console.log('📊 Daily Attendances indexes...');
    await db.collection('dailyattendances').createIndex({ user: 1, date: -1 });
    await db.collection('dailyattendances').createIndex({ date: -1 });
    await db.collection('dailyattendances').createIndex({ status: 1 });
    await db.collection('dailyattendances').createIndex({ startDayTime: 1 });
    await db.collection('dailyattendances').createIndex({ user: 1, startDayTime: -1 });
    console.log('  ✅ Daily Attendances indexes created');

    // ============================================
    // TASKS COLLECTION
    // ============================================
    console.log('📋 Tasks indexes...');
    await db.collection('tasks').createIndex({ assignee: 1, status: 1 });
    await db.collection('tasks').createIndex({ department: 1 });
    await db.collection('tasks').createIndex({ dueDate: 1 });
    await db.collection('tasks').createIndex({ status: 1 });
    await db.collection('tasks').createIndex({ priority: 1 });
    await db.collection('tasks').createIndex({ branch: 1 });
    await db.collection('tasks').createIndex({ createdAt: -1 });
    console.log('  ✅ Tasks indexes created');

    // ============================================
    // AIMS COLLECTION
    // ============================================
    console.log('🎯 Aims indexes...');
    await db.collection('aims').createIndex({ user: 1, date: -1 });
    await db.collection('aims').createIndex({ date: -1 });
    await db.collection('aims').createIndex({ user: 1, createdAt: -1 });
    console.log('  ✅ Aims indexes created');

    // ============================================
    // PROGRESS COLLECTION
    // ============================================
    console.log('📈 Progress indexes...');
    await db.collection('progresses').createIndex({ user: 1, date: -1 });
    await db.collection('progresses').createIndex({ task: 1 });
    await db.collection('progresses').createIndex({ date: -1 });
    await db.collection('progresses').createIndex({ createdAt: -1 });
    console.log('  ✅ Progress indexes created');

    // ============================================
    // DEPARTMENTS COLLECTION
    // ============================================
    console.log('🏢 Departments indexes...');
    await db.collection('departments').createIndex({ name: 1 });
    console.log('  ✅ Departments indexes created');

    // ============================================
    // SALARY COLLECTION
    // ============================================
    console.log('💰 Salary indexes...');
    await db.collection('salaries').createIndex({ user: 1, month: -1 });
    await db.collection('salaries').createIndex({ user: 1 });
    console.log('  ✅ Salary indexes created');

    // ============================================
    // EMPLOYEE MASTER COLLECTION
    // ============================================
    console.log('👔 Employee Master indexes...');
    await db.collection('employeemasters').createIndex({ user: 1 }, { unique: true });
    await db.collection('employeemasters').createIndex({ biometric_code: 1 });
    console.log('  ✅ Employee Master indexes created');

    // ============================================
    // SUBMISSIONS COLLECTION
    // ============================================
    console.log('📤 Submissions indexes...');
    await db.collection('tasksubmissions').createIndex({ task: 1 });
    await db.collection('tasksubmissions').createIndex({ user: 1, createdAt: -1 });
    await db.collection('tasksubmissions').createIndex({ status: 1 });
    console.log('  ✅ Submissions indexes created');

    // ============================================
    // NOTIFICATIONS COLLECTION
    // ============================================
    console.log('🔔 Notifications indexes...');
    await db.collection('notifications').createIndex({ user: 1, createdAt: -1 });
    await db.collection('notifications').createIndex({ read: 1 });
    console.log('  ✅ Notifications indexes created');

    console.log('\n✅ All indexes created successfully!\n');

    // Show index statistics
    console.log('📊 Index Statistics:\n');
    const collections = [
      'users', 'attendances', 'dailyattendances', 'tasks', 
      'aims', 'progresses', 'departments', 'salaries', 
      'employeemasters', 'tasksubmissions', 'notifications'
    ];

    for (const collectionName of collections) {
      try {
        const indexes = await db.collection(collectionName).indexes();
        console.log(`  ${collectionName}: ${indexes.length} indexes`);
      } catch (err) {
        console.log(`  ${collectionName}: Collection not found (will be created on first use)`);
      }
    }

    console.log('\n🎉 Database optimization complete!');
    console.log('💡 Your queries should now be 10-100x faster!\n');

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
addIndexes();
