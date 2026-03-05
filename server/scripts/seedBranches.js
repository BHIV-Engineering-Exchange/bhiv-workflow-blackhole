/**
 * Seed script to create initial branches (Mumbai & Pune)
 * Run: node scripts/seedBranches.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Branch = require('../models/Branch');

const branches = [
  {
    name: 'Blackhole Mumbai',
    code: 'blackhole_mumbai',
    address: 'Blackhole Infiverse, Kali Gali, 176/1410, Rd Number 3, near Hathi Circle, above Bright Connection, Motilal Nagar II, Goregaon West, Mumbai, Maharashtra 400104',
    latitude: 19.160122,
    longitude: 72.839720,
    radius: 1000,
    isActive: true
  }
];

const seedBranches = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🗑️ Clearing existing branches...');
    await Branch.deleteMany({});
    
    console.log('🌱 Seeding branches...');
    const createdBranches = await Branch.insertMany(branches);
    
    console.log('✅ Branches seeded successfully!');
    console.log('📋 Created branches:');
    createdBranches.forEach(branch => {
      console.log(`   - ${branch.name} (${branch.code})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding branches:', error);
    process.exit(1);
  }
};

seedBranches();
