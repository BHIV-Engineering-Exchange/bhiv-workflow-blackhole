require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('No MONGODB_URI in environment. Check server/.env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');
    console.log('DB name:', mongoose.connection.name);
    console.log('DB host:', mongoose.connection.host);

    const db = mongoose.connection.db;

    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name).join(', '));

    // Print counts for collections that commonly break after Atlas cutover
    const names = ['users', 'tasks', 'departments', 'branches', 'attendance'];
    for (const n of names) {
      try {
        const count = await db.collection(n).countDocuments();
        console.log(`${n}: ${count}`);
      } catch (err) {
        // ignore if collection doesn't exist
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Connection error:', err.message || err);
    process.exit(2);
  }
}

run();