import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/nirman';

const projectSchema = new mongoose.Schema({
  title: String,
  currentCode: String,
  status: String
}, { strict: false });

const Project = mongoose.model('Project', projectSchema);

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const projects = await Project.find().sort({ updatedAt: -1 }).limit(5);
    for (const p of projects) {
      console.log(`\n=============================`);
      console.log(`Project: ${p.title} (${p._id})`);
      console.log(`Status: ${p.status}`);
      console.log(`pipelineState:`, JSON.stringify(p.pipelineState, null, 2));
      console.log(`designAudit:`, JSON.stringify(p.designAudit, null, 2));
      console.log(`=============================\n`);
    }
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
