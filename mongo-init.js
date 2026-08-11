// =============================================================================
// MONGO INITIALIZATION SCRIPT
// Executes automatically on first container startup when /data/db is empty.
// Creates a dedicated application user with restricted readWrite privileges.
// =============================================================================

const dbName = process.env.MONGO_INITDB_DATABASE || 'niyantran';
const appUser = process.env.MONGO_APP_USERNAME;
const appPassword = process.env.MONGO_APP_PASSWORD;

if (appUser && appPassword) {
  const appDb = db.getSiblingDB(dbName);
  
  // Check if user already exists before creating
  const existingUser = appDb.getUser(appUser);
  if (!existingUser) {
    appDb.createUser({
      user: appUser,
      pwd: appPassword,
      roles: [
        { role: 'readWrite', db: dbName }
      ]
    });
    print(`[Mongo Init] Dedicated user '${appUser}' created with readWrite role on database '${dbName}'.`);
  } else {
    print(`[Mongo Init] Dedicated user '${appUser}' already exists on database '${dbName}'.`);
  }
} else {
  print('[Mongo Init] Warning: MONGO_APP_USERNAME or MONGO_APP_PASSWORD missing in environment.');
}
